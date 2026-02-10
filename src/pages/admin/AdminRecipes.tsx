import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Edit3, ChefHat, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Recipe, RecipeIngredient, RawMaterial } from '@/types/inventory';
import { logAction } from '@/lib/auditLog';
import MobileHeader from '@/components/MobileHeader';
import BackButton from '@/components/BackButton';
import { useIsMobile } from '@/hooks/use-mobile';

const AdminRecipes: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    description: '',
    outputQuantity: 1,
    outputUnit: 'piece',
    preparationTime: 30,
    instructions: '',
    ingredients: [] as RecipeIngredient[],
  });

  // Load recipes and raw materials
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.storeId) return;
      const db = getFirestore();

      // Fetch recipes
      const recipesRef = collection(db, 'recipes');
      const recipesQuery = query(recipesRef, where('storeId', '==', user.storeId));
      const recipesSnapshot = await getDocs(recipesQuery);
      const recipesList: Recipe[] = recipesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Recipe));
      setRecipes(recipesList);

      // Fetch raw materials for ingredient selection
      const materialsRef = collection(db, 'rawMaterials');
      const materialsQuery = query(materialsRef, where('storeId', '==', user.storeId));
      const materialsSnapshot = await getDocs(materialsQuery);
      const materialsList: RawMaterial[] = materialsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RawMaterial));
      setRawMaterials(materialsList);
    };
    fetchData();
  }, [user?.storeId]);

  const calculateRecipeCost = (ingredients: RecipeIngredient[]): number => {
    return ingredients.reduce((total, ing) => {
      const material = rawMaterials.find(m => m.id === ing.rawMaterialId);
      if (!material) return total;
      return total + (ing.quantity * (material.costPerUnit || 0));
    }, 0);
  };

  const addIngredient = () => {
    setNewRecipe({
      ...newRecipe,
      ingredients: [
        ...newRecipe.ingredients,
        { rawMaterialId: '', quantity: '' as any, unit: 'kg' }
      ]
    });
  };

  const removeIngredient = (index: number) => {
    setNewRecipe({
      ...newRecipe,
      ingredients: newRecipe.ingredients.filter((_, i) => i !== index)
    });
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: any) => {
    const updated = [...newRecipe.ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setNewRecipe({ ...newRecipe, ingredients: updated });
  };

  const handleAddRecipe = async () => {
    if (!newRecipe.name || newRecipe.ingredients.length === 0 || !user?.storeId) {
      toast({ title: "Error", description: "Recipe name and at least one ingredient required", variant: "destructive" });
      return;
    }

    try {
      const db = getFirestore();
      const totalCost = calculateRecipeCost(newRecipe.ingredients);
      const costPerUnit = totalCost / newRecipe.outputQuantity;

      const recipeData = {
        ...newRecipe,
        totalCost,
        costPerUnit,
        storeId: user.storeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'recipes'), recipeData);
      setRecipes([...recipes, { id: docRef.id, ...recipeData }]);

      // Audit log
      await logAction(
        user.id,
        user.name,
        user.role,
        'create',
        'recipe',
        docRef.id,
        { newValue: recipeData },
        user.storeId
      );

      setNewRecipe({
        name: '',
        description: '',
        outputQuantity: 1,
        outputUnit: 'piece',
        preparationTime: 30,
        instructions: '',
        ingredients: [],
      });
      setIsAddingRecipe(false);
      toast({ title: "Success", description: "Recipe created successfully!" });
    } catch (error) {
      console.error('Error adding recipe:', error);
      toast({ title: "Error", description: "Failed to create recipe", variant: "destructive" });
    }
  };

  const handleUpdateRecipe = async () => {
    if (!editingRecipe || !user?.storeId) return;

    try {
      const db = getFirestore();
      const recipeRef = doc(db, 'recipes', editingRecipe.id);

      const totalCost = calculateRecipeCost(editingRecipe.ingredients);
      const costPerUnit = totalCost / editingRecipe.outputQuantity;

      const updatedData = {
        ...editingRecipe,
        totalCost,
        costPerUnit,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(recipeRef, updatedData);
      setRecipes(recipes.map(r => r.id === editingRecipe.id ? updatedData : r));

      // Audit log
      const oldRecipe = recipes.find(r => r.id === editingRecipe.id);
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'recipe',
        editingRecipe.id,
        { oldValue: oldRecipe, newValue: updatedData },
        user.storeId
      );

      setEditingRecipe(null);
      toast({ title: "Success", description: "Recipe updated successfully!" });
    } catch (error) {
      console.error('Error updating recipe:', error);
      toast({ title: "Error", description: "Failed to update recipe", variant: "destructive" });
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    const deletedRecipe = recipes.find(r => r.id === recipeId);
    
    // Check if recipe is used in any composed products
    try {
      const db = getFirestore();
      const composedRef = collection(db, 'composedProducts');
      const composedQuery = query(composedRef, where('storeId', '==', user?.storeId), where('recipeId', '==', recipeId));
      const composedSnapshot = await getDocs(composedQuery);
      
      if (!composedSnapshot.empty) {
        const productCount = composedSnapshot.size;
        toast({ 
          title: "Cannot Delete", 
          description: `This recipe is used by ${productCount} composed product(s). Delete those products first or unlink them from this recipe.`,
          variant: "destructive" 
        });
        return;
      }
    } catch (error) {
      console.error('Error checking recipe usage:', error);
    }
    
    if (!confirm(`Are you sure you want to delete "${deletedRecipe?.name}"?`)) return;

    try {
      const db = getFirestore();
      await deleteDoc(doc(db, 'recipes', recipeId));
      setRecipes(recipes.filter(r => r.id !== recipeId));

      // Audit log
      if (deletedRecipe && user) {
        await logAction(
          user.id,
          user.name,
          user.role,
          'delete',
          'recipe',
          recipeId,
          { oldValue: deletedRecipe },
          user.storeId
        );
      }

      toast({ title: "Success", description: "Recipe deleted successfully!" });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast({ title: "Error", description: "Failed to delete recipe", variant: "destructive" });
    }
  };

  const addEditIngredient = (recipe: Recipe) => {
    const currentIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    setEditingRecipe({
      ...recipe,
      ingredients: [
        ...currentIngredients,
        { rawMaterialId: '', quantity: '' as any, unit: 'kg' }
      ]
    });
  };

  const removeEditIngredient = (recipe: Recipe, index: number) => {
    const currentIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    setEditingRecipe({
      ...recipe,
      ingredients: currentIngredients.filter((_, i) => i !== index)
    });
  };

  const updateEditIngredient = (recipe: Recipe, index: number, field: keyof RecipeIngredient, value: any) => {
    const currentIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const updated = [...currentIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setEditingRecipe({ ...recipe, ingredients: updated });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobile ? <MobileHeader title="Recipes" showBackButton={true} /> : null}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isMobile && <BackButton to="/admin/inventory" label="Back to Inventory" />}
            <h1 className="text-2xl font-bold">Recipes</h1>
          </div>
          <Dialog open={isAddingRecipe} onOpenChange={setIsAddingRecipe}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Recipe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Recipe</DialogTitle>
                <DialogDescription>Define ingredients and preparation details</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Recipe Name *</Label>
                    <Input
                      id="name"
                      value={newRecipe.name}
                      onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                      placeholder="e.g., Chocolate Cake"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preparationTime">Prep Time (minutes)</Label>
                    <Input
                      id="preparationTime"
                      type="number"
                      min="0"
                      value={newRecipe.preparationTime === 0 ? '' : newRecipe.preparationTime}
                      onChange={(e) => setNewRecipe({ ...newRecipe, preparationTime: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newRecipe.description}
                    onChange={(e) => setNewRecipe({ ...newRecipe, description: e.target.value })}
                    placeholder="Brief description of the recipe"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="outputQuantity">Output Quantity *</Label>
                    <Input
                      id="outputQuantity"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newRecipe.outputQuantity === 0 ? '' : newRecipe.outputQuantity}
                      onChange={(e) => setNewRecipe({ ...newRecipe, outputQuantity: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 1) })}
                      placeholder="1.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="outputUnit">Output Unit</Label>
                    <Input
                      id="outputUnit"
                      value={newRecipe.outputUnit}
                      onChange={(e) => setNewRecipe({ ...newRecipe, outputUnit: e.target.value })}
                      placeholder="e.g., piece, kg, batch"
                    />
                  </div>
                </div>

                {/* Ingredients Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Ingredients *</Label>
                    <Button type="button" size="sm" onClick={addIngredient}>
                      <Plus className="h-4 w-4 mr-1" /> Add Ingredient
                    </Button>
                  </div>
                  {(newRecipe.ingredients || []).map((ingredient, index) => {
                    const material = rawMaterials.find(m => m.id === ingredient.rawMaterialId);
                    const cost = material ? ingredient.quantity * (material.costPerUnit || 0) : 0;

                    return (
                      <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-5">
                          <Label className="text-xs">Material</Label>
                          <Select
                            value={ingredient.rawMaterialId}
                            onValueChange={(value) => updateIngredient(index, 'rawMaterialId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              {rawMaterials.map(mat => (
                                <SelectItem key={mat.id} value={mat.id}>
                                  {mat.name} (${ (mat.costPerUnit || 0)}/{mat.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={ingredient.quantity === 0 ? '' : ingredient.quantity}
                            onChange={(e) => updateIngredient(index, 'quantity', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Unit</Label>
                          <Input
                            value={ingredient.unit}
                            onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-xs">Cost</Label>
                          <p className="text-sm font-medium">${cost.toFixed(2)}</p>
                        </div>
                        <div className="col-span-1">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeIngredient(index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {(newRecipe.ingredients || []).length > 0 && (
                    <div className="mt-2 p-3 bg-gray-100 rounded">
                      <div className="flex justify-between text-sm">
                        <span>Total Cost:</span>
                        <span className="font-bold">${calculateRecipeCost(newRecipe.ingredients).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Cost Per Unit:</span>
                        <span className="font-bold">${(calculateRecipeCost(newRecipe.ingredients) / newRecipe.outputQuantity).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="instructions">Preparation Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={newRecipe.instructions}
                    onChange={(e) => setNewRecipe({ ...newRecipe, instructions: e.target.value })}
                    placeholder="Step-by-step preparation instructions..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingRecipe(false)}>Cancel</Button>
                <Button onClick={handleAddRecipe}>Create Recipe</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Recipes List */}
        <div className="grid gap-4">
          {recipes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ChefHat className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No recipes yet. Create your first recipe to get started.</p>
              </CardContent>
            </Card>
          ) : (
            recipes.map((recipe) => (
              <Card key={recipe.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{recipe.name}</CardTitle>
                      <CardDescription>{recipe.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRecipe(recipe)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRecipe(recipe.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Output</p>
                      <p className="font-medium">{recipe.outputQuantity} {recipe.outputUnit}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Prep Time</p>
                      <p className="font-medium">{recipe.preparationTime} min</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Cost</p>
                      <p className="font-bold text-lg">${(recipe.totalCost || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Cost Per Unit</p>
                      <p className="font-bold text-lg">${(recipe.costPerUnit || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2">Ingredients:</p>
                    <ul className="space-y-1">
                      {(recipe.ingredients || []).map((ing, idx) => {
                        const material = rawMaterials.find(m => m.id === ing.rawMaterialId);
                        return (
                          <li key={idx} className="text-sm flex justify-between">
                            <span>{material?.name || 'Unknown'}: {ing.quantity} {ing.unit}</span>
                            <span className="text-gray-500">${material ? (ing.quantity * (material.costPerUnit || 0)).toFixed(2) : '0.00'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Edit Recipe Dialog */}
        {editingRecipe && (
          <Dialog open={!!editingRecipe} onOpenChange={() => setEditingRecipe(null)}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Recipe</DialogTitle>
                <DialogDescription>Update recipe details and ingredients</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-name">Recipe Name *</Label>
                    <Input
                      id="edit-name"
                      value={editingRecipe.name}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-preparationTime">Prep Time (minutes)</Label>
                    <Input
                      id="edit-preparationTime"
                      type="number"
                      min="0"
                      value={editingRecipe.preparationTime}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, preparationTime: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={editingRecipe.description}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-outputQuantity">Output Quantity *</Label>
                    <Input
                      id="edit-outputQuantity"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editingRecipe.outputQuantity}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, outputQuantity: parseFloat(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-outputUnit">Output Unit</Label>
                    <Input
                      id="edit-outputUnit"
                      value={editingRecipe.outputUnit}
                      onChange={(e) => setEditingRecipe({ ...editingRecipe, outputUnit: e.target.value })}
                    />
                  </div>
                </div>

                {/* Edit Ingredients */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Ingredients *</Label>
                    <Button type="button" size="sm" onClick={() => addEditIngredient(editingRecipe)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Ingredient
                    </Button>
                  </div>
                  {(editingRecipe.ingredients || []).map((ingredient, index) => {
                    const material = rawMaterials.find(m => m.id === ingredient.rawMaterialId);
                    const cost = material ? ingredient.quantity * (material.costPerUnit || 0) : 0;

                    return (
                      <div key={index} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-5">
                          <Label className="text-xs">Material</Label>
                          <Select
                            value={ingredient.rawMaterialId}
                            onValueChange={(value) => updateEditIngredient(editingRecipe, index, 'rawMaterialId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              {rawMaterials.map(mat => (
                                <SelectItem key={mat.id} value={mat.id}>
                                  {mat.name} (${(mat.costPerUnit || 0)}/{mat.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={ingredient.quantity === 0 ? '' : ingredient.quantity}
                            onChange={(e) => updateEditIngredient(editingRecipe, index, 'quantity', e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Unit</Label>
                          <Input
                            value={ingredient.unit}
                            onChange={(e) => updateEditIngredient(editingRecipe, index, 'unit', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1">
                          <Label className="text-xs">Cost</Label>
                          <p className="text-sm font-medium">${cost.toFixed(2)}</p>
                        </div>
                        <div className="col-span-1">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeEditIngredient(editingRecipe, index)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {(editingRecipe.ingredients || []).length > 0 && (
                    <div className="mt-2 p-3 bg-gray-100 rounded">
                      <div className="flex justify-between text-sm">
                        <span>Total Cost:</span>
                        <span className="font-bold">${calculateRecipeCost(editingRecipe.ingredients).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Cost Per Unit:</span>
                        <span className="font-bold">${(calculateRecipeCost(editingRecipe.ingredients) / editingRecipe.outputQuantity).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="edit-instructions">Preparation Instructions</Label>
                  <Textarea
                    id="edit-instructions"
                    value={editingRecipe.instructions}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, instructions: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingRecipe(null)}>Cancel</Button>
                <Button onClick={handleUpdateRecipe}>Update Recipe</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default AdminRecipes;
