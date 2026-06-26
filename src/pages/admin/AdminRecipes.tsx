import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
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
import { StoreProfile } from '@/types/storeProfile';
import { logAction } from '@/lib/auditLog';
import { enforceAndConsumeTrialOperation } from '@/lib/subscriptionEnforcement';
import { getActualStoreId } from '@/lib/storeUtils';
import AdminPageShell from '@/components/admin/AdminPageShell';
import AdminPanel from '@/components/admin/AdminPanel';

const AdminRecipes: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);
  const [categories, setCategories] = useState<string[]>(['Uncategorized']);
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    description: '',
    category: 'Uncategorized',
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

      // Fetch store profile for categories
      const profileDocIds = Array.from(new Set([
        getActualStoreId(user),
        user.storeId,
        user.id,
      ].filter(Boolean)));

      for (const profileDocId of profileDocIds) {
        const profileSnap = await getDoc(doc(db, 'storeProfiles', profileDocId));
        if (!profileSnap.exists()) continue;

        const profileData = profileSnap.data() as StoreProfile;
        setStoreProfile(profileData);
        setCategories(profileData.productCategories || ['Food', 'Beverages', 'Desserts', 'Bakery', 'Manufactured Goods', 'Electronics', 'Clothing', 'Services', 'Package', 'Box', 'Bag', 'Uncategorized', 'Other']);
        break;
      }

      // Fetch recipes
      const recipesRef = collection(db, 'recipes');
      const recipesQuery = query(recipesRef, where('storeId', '==', user.storeId));
      const recipesSnapshot = await getDocs(recipesQuery);
      const recipesList: Recipe[] = recipesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        } as Recipe;
      });
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

  const calculateRecipeCost = (ingredients?: RecipeIngredient[]): number => {
    return (ingredients ?? []).reduce((total, ing) => {
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

    // Validate output quantity is not zero or negative
    if (!newRecipe.outputQuantity || newRecipe.outputQuantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Output quantity must be greater than zero",
        variant: "destructive"
      });
      return;
    }

    // Validate ingredients have cost
    const totalCost = calculateRecipeCost(newRecipe.ingredients);
    if (totalCost <= 0) {
      toast({
        title: "Validation Error",
        description: "Recipe total cost must be greater than zero. Please ensure all ingredients have valid costs.",
        variant: "destructive"
      });
      return;
    }

    try {
      const db = getFirestore();
      await enforceAndConsumeTrialOperation(db, user.storeId, 'recipe');
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
        category: 'Uncategorized',
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
    console.log('handleUpdateRecipe called');
    console.log('editingRecipe:', editingRecipe);
    console.log('user:', user);
    console.log('user.storeId:', user?.storeId);

    if (!editingRecipe || !user?.storeId) {
      console.log('Early return - missing editingRecipe or storeId');
      if (!editingRecipe) {
        toast({
          title: "Error",
          description: "No recipe selected for editing",
          variant: "destructive"
        });
      }
      if (!user?.storeId) {
        toast({
          title: "Error",
          description: "Store ID not found. Please refresh and try again.",
          variant: "destructive"
        });
      }
      return;
    }

    console.log('Output quantity:', editingRecipe.outputQuantity);
    
    // Validate output quantity is not zero or negative
    const outputQty = parseFloat(String(editingRecipe.outputQuantity));
    if (!outputQty || isNaN(outputQty) || outputQty <= 0) {
      console.log('Failed validation: output quantity', editingRecipe.outputQuantity);
      toast({
        title: "Validation Error",
        description: "Output quantity must be greater than zero",
        variant: "destructive"
      });
      return;
    }

    // Validate ingredients
    if (!editingRecipe.ingredients || editingRecipe.ingredients.length === 0) {
      console.log('Failed validation: no ingredients');
      toast({
        title: "Validation Error",
        description: "Recipe must have at least one ingredient",
        variant: "destructive"
      });
      return;
    }

    // Check for invalid ingredients
    const invalidIngredients = editingRecipe.ingredients.filter(ing => {
      if (!ing.rawMaterialId) return true;
      const material = rawMaterials.find(m => m.id === ing.rawMaterialId);
      if (!material) return true;
      if (!ing.quantity || parseFloat(String(ing.quantity)) <= 0) return true;
      return false;
    });

    if (invalidIngredients.length > 0) {
      console.log('Failed validation: invalid ingredients', invalidIngredients);
      toast({
        title: "Validation Error",
        description: "Some ingredients are missing material, quantity, or the material no longer exists. Please fix or remove them.",
        variant: "destructive"
      });
      return;
    }

    // Validate ingredients have cost
    const totalCost = calculateRecipeCost(editingRecipe.ingredients);
    console.log('Total cost calculated:', totalCost);
    
    if (totalCost <= 0) {
      console.log('Failed validation: total cost is zero');
      
      // Check which ingredients have zero cost
      const zeroCostIngredients = editingRecipe.ingredients.map(ing => {
        const material = rawMaterials.find(m => m.id === ing.rawMaterialId);
        return { material: material?.name, cost: material?.costPerUnit };
      }).filter(x => !x.cost || x.cost === 0);
      
      console.log('Ingredients with zero cost:', zeroCostIngredients);
      
      toast({
        title: "Validation Error",
        description: `Recipe total cost is zero. Please ensure all raw materials have a cost per unit set. Materials with zero cost: ${zeroCostIngredients.map(x => x.material).join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Starting recipe update...');
      const shouldContinue = window.confirm(
        'This update applies from the beginning for this recipe. For changes only from now, create a new recipe and link the product to it. Continue?'
      );
      if (!shouldContinue) return;

      const db = getFirestore();
      const recipeRef = doc(db, 'recipes', editingRecipe.id);

      const costPerUnit = totalCost / outputQty;
      console.log('Cost per unit:', costPerUnit);

      // Extract only data fields (exclude 'id' which is the document ID)
      const { id: _, ...recipeData } = editingRecipe;
      const updateData = {
        ...recipeData,
        outputQuantity: outputQty, // Use the validated number
        totalCost,
        costPerUnit,
        updatedAt: new Date().toISOString(),
      };

      console.log('Updating recipe with data:', updateData);
      await updateDoc(recipeRef, updateData);
      console.log('Recipe updated in Firestore');
      
      // Update local state with full object including ID
      const updatedRecipe = { ...editingRecipe, ...updateData };
      setRecipes(recipes.map(r => r.id === editingRecipe.id ? updatedRecipe : r));

      // Audit log
      const oldRecipe = recipes.find(r => r.id === editingRecipe.id);
      await logAction(
        user.id,
        user.name,
        user.role,
        'update',
        'recipe',
        editingRecipe.id,
        { oldValue: oldRecipe, newValue: updatedRecipe },
        user.storeId
      );

      console.log('Recipe update completed successfully');
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
    <AdminPageShell
      title="Recipes"
      description="Manage your product recipes and their raw material composition"
      eyebrow="Inventory"
      backTo="/admin/inventory"
      backLabel="Back to Inventory"
      actions={
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
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newRecipe.category}
                    onValueChange={(value) => setNewRecipe({ ...newRecipe, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Categories can be managed in Store Profile settings
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="outputQuantity">Output Quantity *</Label>
                    <Input
                      id="outputQuantity"
                      type="text"
                      inputMode="decimal"
                      value={newRecipe.outputQuantity === 0 ? '' : newRecipe.outputQuantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setNewRecipe({ ...newRecipe, outputQuantity: val === '' ? 0 : val });
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const num = parseFloat(val);
                        if (!isNaN(num) && num > 0) {
                          setNewRecipe({ ...newRecipe, outputQuantity: num });
                        } else if (val === '') {
                          setNewRecipe({ ...newRecipe, outputQuantity: 0 });
                        }
                      }}
                      placeholder="1.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="outputUnit">Output Unit</Label>
                    <Select
                      value={newRecipe.outputUnit}
                      onValueChange={(value) => setNewRecipe({ ...newRecipe, outputUnit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="liter">liter</SelectItem>
                        <SelectItem value="piece">piece</SelectItem>
                        <SelectItem value="batch">batch</SelectItem>
                      </SelectContent>
                    </Select>
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
                            type="text"
                            inputMode="decimal"
                            value={ingredient.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Allow empty, numbers, and partial decimals during typing
                              if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                updateIngredient(index, 'quantity', val);
                              }
                            }}
                            onBlur={(e) => {
                              // Parse to number on blur for validation
                              const val = e.target.value;
                              const num = parseFloat(val);
                              if (!isNaN(num) && num > 0) {
                                updateIngredient(index, 'quantity', num);
                              } else if (val === '') {
                                updateIngredient(index, 'quantity', 0);
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Unit</Label>
                          <Select
                            value={ingredient.unit}
                            onValueChange={(value) => updateIngredient(index, 'unit', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="liter">liter</SelectItem>
                              <SelectItem value="piece">piece</SelectItem>
                              <SelectItem value="batch">batch</SelectItem>
                            </SelectContent>
                          </Select>
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
                        <span className="font-bold">
                          ${newRecipe.outputQuantity > 0 
                            ? (calculateRecipeCost(newRecipe.ingredients) / newRecipe.outputQuantity).toFixed(2)
                            : '0.00'}
                        </span>
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
      }
    >

        {/* Recipes List */}
        <div className="grid gap-4">
          {recipes.length === 0 ? (
            <AdminPanel>
              <CardContent className="py-12 text-center">
                <ChefHat className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">No recipes yet. Create your first recipe to get started.</p>
              </CardContent>
            </AdminPanel>
          ) : (
            recipes.map((recipe) => (
              <AdminPanel key={recipe.id}>
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
                        onClick={() => setEditingRecipe({
                          ...recipe,
                          // Ensure default values for fields that might be missing
                          outputQuantity: recipe.outputQuantity || 1,
                          outputUnit: recipe.outputUnit || 'piece',
                          ingredients: recipe.ingredients || [],
                          category: recipe.category || 'Uncategorized',
                          preparationTime: recipe.preparationTime || 0,
                        })}
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
                      <p className="font-bold text-lg">${calculateRecipeCost(recipe.ingredients).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Cost Per Unit</p>
                      <p className="font-bold text-lg">${recipe.outputQuantity ? (calculateRecipeCost(recipe.ingredients) / recipe.outputQuantity).toFixed(2) : '0.00'}</p>
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
              </AdminPanel>
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
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Editing a recipe applies to this recipe from the beginning. If you need changes only from now, create a new recipe and then update the product to use the new recipe.
                </div>
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
                  <Label htmlFor="edit-category">Category</Label>
                  <Select
                    value={editingRecipe.category || 'Uncategorized'}
                    onValueChange={(value) => setEditingRecipe({ ...editingRecipe, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Categories can be managed in Store Profile settings
                  </p>
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
                      type="text"
                      inputMode="decimal"
                      value={editingRecipe.outputQuantity ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setEditingRecipe({ ...editingRecipe, outputQuantity: val === '' ? 0 : val });
                        }
                      }}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const num = parseFloat(val);
                        if (!isNaN(num) && num > 0) {
                          setEditingRecipe({ ...editingRecipe, outputQuantity: num });
                        } else if (val === '') {
                          setEditingRecipe({ ...editingRecipe, outputQuantity: 1 });
                        }
                      }}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-outputUnit">Output Unit</Label>
                    <Select
                      value={editingRecipe.outputUnit}
                      onValueChange={(value) => setEditingRecipe({ ...editingRecipe, outputUnit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="liter">liter</SelectItem>
                        <SelectItem value="piece">piece</SelectItem>
                        <SelectItem value="batch">batch</SelectItem>
                      </SelectContent>
                    </Select>
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
                            type="text"
                            inputMode="decimal"
                            value={ingredient.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Allow empty, numbers, and partial decimals during typing
                              if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                updateEditIngredient(editingRecipe, index, 'quantity', val);
                              }
                            }}
                            onBlur={(e) => {
                              // Parse to number on blur for validation
                              const val = e.target.value;
                              const num = parseFloat(val);
                              if (!isNaN(num) && num > 0) {
                                updateEditIngredient(editingRecipe, index, 'quantity', num);
                              } else if (val === '') {
                                updateEditIngredient(editingRecipe, index, 'quantity', 0);
                              }
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Unit</Label>
                          <Select
                            value={ingredient.unit}
                            onValueChange={(value) => updateEditIngredient(editingRecipe, index, 'unit', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="liter">liter</SelectItem>
                              <SelectItem value="piece">piece</SelectItem>
                              <SelectItem value="batch">batch</SelectItem>
                            </SelectContent>
                          </Select>
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
                        <span className="font-bold">
                          ${editingRecipe.outputQuantity > 0 
                            ? (calculateRecipeCost(editingRecipe.ingredients) / editingRecipe.outputQuantity).toFixed(2)
                            : '0.00'}
                        </span>
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
                <Button onClick={handleUpdateRecipe}>Update Recipe (From Beginning)</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
    </AdminPageShell>
  );
};

export default AdminRecipes;
