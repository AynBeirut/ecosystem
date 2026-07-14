import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAppContext, ComposedProductComponent } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { 
  Package, 
  Tag, 
  AlertTriangle, 
  TrendingUp, 
  Search,
  Edit,
  Trash2,
  Plus,
  DollarSign,
  BoxIcon,
  AlertCircle,
  Factory,
  Layers,
  X,
  Hammer
} from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["product", "service", "composed"]).default("product"),
  category: z.string().optional(),
  rawPrice: z.coerce.number().min(0, "Cost must be 0 or greater").optional(),
  salePrice: z.coerce.number().min(0.01, "Sale price must be greater than 0"),
  stockQuantity: z.coerce.number().min(0, "Stock must be 0 or greater").optional(),
  lowStockAlert: z.coerce.number().min(0).optional(),
  serviceCost: z.coerce.number().min(0, "Service cost must be 0 or greater").optional(),
});

const Inventory = () => {
  const { products, addProduct, logout, updateProduct, deleteProduct, manufactureProduct, calculateComposedProductCost } = useAppContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  
  // Composed product component management
  const [selectedComponents, setSelectedComponents] = useState<ComposedProductComponent[]>([]);
  const [componentProductId, setComponentProductId] = useState("");
  const [componentQuantity, setComponentQuantity] = useState(1);
  
  // Manufacturing dialog
  const [isManufactureDialogOpen, setIsManufactureDialogOpen] = useState(false);
  const [productToManufacture, setProductToManufacture] = useState<any>(null);
  const [manufactureQuantity, setManufactureQuantity] = useState(1);

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      type: "product",
      category: "",
      rawPrice: undefined,
      salePrice: undefined,
      stockQuantity: 0,
      lowStockAlert: 10,
      serviceCost: 0,
    },
  });

  const productType = form.watch("type");

  // Filter by types
  const productItems = products.filter(p => p.type === "product");
  const serviceItems = products.filter(p => p.type === "service");
  const composedItems = products.filter(p => p.type === "composed");
  
  const totalProducts = productItems.length;
  const totalServices = serviceItems.length;
  const totalComposed = composedItems.length;
  
  // Calculate stock value including composed products
  const totalStockValue = [...productItems, ...composedItems].reduce((sum, p) => {
    const cost = p.type === "composed" ? calculateComposedProductCost(p) : (p.rawPrice || 0);
    const stock = p.stockQuantity || 0;
    return sum + (cost * stock);
  }, 0);
  
  const totalRetailValue = [...productItems, ...composedItems].reduce((sum, p) => {
    const price = p.salePrice || 0;
    const stock = p.stockQuantity || 0;
    return sum + (price * stock);
  }, 0);
  
  const potentialProfit = totalRetailValue - totalStockValue;
  
  const lowStockProducts = [...productItems, ...composedItems].filter(p => {
    const threshold = p.lowStockAlert || 10;
    return (p.stockQuantity || 0) > 0 && (p.stockQuantity || 0) <= threshold;
  });
  
  const outOfStockProducts = [...productItems, ...composedItems].filter(p => (p.stockQuantity || 0) === 0);

  // Filter products by search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogout = () => {
    logout();
    toast({ title: "Logged out", description: "You've been successfully logged out" });
  };

  const calculateProfitMargin = (rawPrice: number, salePrice: number): number => {
    if (!rawPrice || rawPrice === 0) return 100;
    if (salePrice <= rawPrice) return 0;
    return parseFloat((((salePrice - rawPrice) / salePrice) * 100).toFixed(2));
  };

  const addComponent = () => {
    if (!componentProductId) {
      toast({ title: "Error", description: "Please select a product", variant: "destructive" });
      return;
    }
    
    const product = productItems.find(p => p.id === componentProductId);
    if (!product) {
      toast({ title: "Error", description: "Product not found", variant: "destructive" });
      return;
    }
    
    // Check if already added
    if (selectedComponents.some(c => c.productId === componentProductId)) {
      toast({ title: "Error", description: "This component is already added", variant: "destructive" });
      return;
    }
    
    setSelectedComponents(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      quantity: componentQuantity,
      unitCost: product.rawPrice || 0,
    }]);
    
    setComponentProductId("");
    setComponentQuantity(1);
  };
  
  const removeComponent = (productId: string) => {
    setSelectedComponents(prev => prev.filter(c => c.productId !== productId));
  };
  
  const calculateTotalComponentCost = (): number => {
    return selectedComponents.reduce((sum, c) => sum + (c.quantity * c.unitCost), 0);
  };

  const onSubmit = async (values: z.infer<typeof productSchema>) => {
    const productData: any = {
      name: values.name,
      description: values.description || "",
      type: values.type,
      rawPrice: values.rawPrice,
      salePrice: values.salePrice,
      sku: values.sku,
      category: values.category,
      lowStockAlert: values.lowStockAlert,
    };

    if (values.type === "composed") {
      productData.components = selectedComponents;
      productData.serviceCost = values.serviceCost ?? 0;
      // Raw cost is calculated from components + service cost
      productData.rawPrice = calculateTotalComponentCost() + (values.serviceCost || 0);
    }

    if (editingProduct) {
      if (updateProduct) {
        // On edit we allow stock changes (this is the inventory page).
        if (values.type === "product" || values.type === "composed") {
          productData.stockQuantity = values.stockQuantity ?? editingProduct.stockQuantity ?? 0;
        }
        updateProduct(editingProduct.id, productData);
        toast({
          title: "Updated",
          description: `${values.type === "product" ? "Product" : values.type === "service" ? "Service" : "Composed Product"} has been updated`,
        });
      }
      setEditingProduct(null);
    } else {
      // Stock is intentionally ignored on create — always starts at 0.
      const id = await addProduct(productData);
      if (!id) return; // toast already shown
      toast({
        title: "Added",
        description: `${values.type === "product" ? "Product" : values.type === "service" ? "Service" : "Composed Product"} added with 0 stock. Use Purchase Orders or stock adjustments to add units.`,
      });
    }

    form.reset();
    setSelectedComponents([]);
    setActiveTab("products");
  };


  const handleEdit = (product: any) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      sku: product.sku || "",
      description: product.description || "",
      type: product.type,
      category: product.category || "",
      rawPrice: product.rawPrice,
      salePrice: product.salePrice,
      stockQuantity: product.stockQuantity,
      lowStockAlert: product.lowStockAlert || 10,
      serviceCost: product.serviceCost || 0,
    });
    setSelectedComponents(product.components || []);
    setActiveTab("add");
  };

  const handleDelete = (productId: string) => {
    setProductToDelete(productId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (productToDelete && deleteProduct) {
      deleteProduct(productToDelete);
      toast({
        title: "Deleted",
        description: "Item has been deleted",
      });
    }
    setIsDeleteDialogOpen(false);
    setProductToDelete(null);
  };
  
  const openManufactureDialog = (product: any) => {
    setProductToManufacture(product);
    setManufactureQuantity(1);
    setIsManufactureDialogOpen(true);
  };
  
  const handleManufacture = async () => {
    if (!productToManufacture) return;

    const result = await manufactureProduct(productToManufacture.id, manufactureQuantity);
    if (result.success) {
      toast({
        title: "Manufacturing Complete",
        description: `Successfully manufactured ${manufactureQuantity}x ${productToManufacture.name}`,
      });
    } else {
      toast({
        title: "Manufacturing Failed",
        description: result.error,
        variant: "destructive",
      });
    }

    setIsManufactureDialogOpen(false);
    setProductToManufacture(null);
  };

  const StockStatusBadge = ({ product }: { product: any }) => {
    if (product.type === "service") {
      return <Badge variant="secondary">Service</Badge>;
    }
    
    const stock = product.stockQuantity || 0;
    const threshold = product.lowStockAlert || 10;
    
    if (stock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (stock <= threshold) {
      return <Badge className="bg-amber-500 hover:bg-amber-600">Low Stock ({stock})</Badge>;
    }
    return <Badge className="bg-green-600 hover:bg-green-700">In Stock ({stock})</Badge>;
  };
  
  const TypeBadge = ({ type }: { type: string }) => {
    if (type === "composed") {
      return <Badge className="bg-purple-600 hover:bg-purple-700">Composed</Badge>;
    }
    if (type === "service") {
      return <Badge variant="secondary">Service</Badge>;
    }
    return <Badge className="bg-blue-600 hover:bg-blue-700">Product</Badge>;
  };

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
            <p className="text-muted-foreground">Manage products, services, composed products, and stock levels</p>
          </div>
          <Button 
            onClick={() => {
              setEditingProduct(null);
              form.reset();
              setSelectedComponents([]);
              setActiveTab("add");
            }}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="products">All Items</TabsTrigger>
            <TabsTrigger value="composed">Composed Products</TabsTrigger>
            <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
            <TabsTrigger value="add">{editingProduct ? "Edit Item" : "Add Item"}</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Raw Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProducts}</div>
                  <p className="text-xs text-muted-foreground">Physical raw items</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Composed Products</CardTitle>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalComposed}</div>
                  <p className="text-xs text-muted-foreground">Manufactured items</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Services</CardTitle>
                  <Tag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalServices}</div>
                  <p className="text-xs text-muted-foreground">Non-stock items</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stock Value (Cost)</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalStockValue, "USD")}</div>
                  <p className="text-xs text-muted-foreground">Total inventory cost</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Potential Profit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(potentialProfit, "USD")}</div>
                  <p className="text-xs text-muted-foreground">If all stock sold</p>
                </CardContent>
              </Card>
            </div>

            {/* Alerts */}
            {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
              <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    Stock Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {outOfStockProducts.length > 0 && (
                      <div>
                        <h4 className="font-medium text-red-600 mb-2">Out of Stock ({outOfStockProducts.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {outOfStockProducts.map(p => (
                            <Badge key={p.id} variant="destructive">{p.name}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {lowStockProducts.length > 0 && (
                      <div>
                        <h4 className="font-medium text-amber-600 mb-2">Low Stock ({lowStockProducts.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {lowStockProducts.map(p => (
                            <Badge key={p.id} className="bg-amber-500">{p.name} ({p.stockQuantity})</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Items */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Items</CardTitle>
                <CardDescription>Latest products and services</CardDescription>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BoxIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>No items yet. Add your first product or service!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {products.slice(0, 5).map(product => (
                      <div key={product.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                        <div className="flex items-center gap-4">
                          {product.type === "composed" ? (
                            <Layers className="h-8 w-8 text-purple-600" />
                          ) : product.type === "product" ? (
                            <Package className="h-8 w-8 text-blue-600" />
                          ) : (
                            <Tag className="h-8 w-8 text-green-600" />
                          )}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(product.salePrice, "USD")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TypeBadge type={product.type} />
                          <StockStatusBadge product={product} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No items match your search" : "No items added yet"}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Name</th>
                          <th className="text-left py-3 px-2">Type</th>
                          <th className="text-right py-3 px-2">Cost</th>
                          <th className="text-right py-3 px-2">Sale Price</th>
                          <th className="text-right py-3 px-2">Margin</th>
                          <th className="text-center py-3 px-2">Stock</th>
                          <th className="text-right py-3 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map(product => {
                          const cost = product.type === "composed" ? calculateComposedProductCost(product) : (product.rawPrice || 0);
                          return (
                            <tr key={product.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-2">
                                <div>
                                  <p className="font-medium">{product.name}</p>
                                  {product.description && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description}</p>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <TypeBadge type={product.type} />
                              </td>
                              <td className="py-3 px-2 text-right">
                                {cost ? formatCurrency(cost, "USD") : "-"}
                              </td>
                              <td className="py-3 px-2 text-right">{formatCurrency(product.salePrice, "USD")}</td>
                              <td className="py-3 px-2 text-right text-green-600">
                                {cost ? `${calculateProfitMargin(cost, product.salePrice)}%` : "-"}
                              </td>
                              <td className="py-3 px-2 text-center">
                                <StockStatusBadge product={product} />
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="flex justify-end gap-2">
                                  {product.type === "composed" && (
                                    <Button variant="ghost" size="sm" className="text-purple-600" onClick={() => openManufactureDialog(product)}>
                                      <Factory className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(product.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="composed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-500" />
                  Composed / Manufactured Products
                </CardTitle>
                <CardDescription>
                  Products made from raw materials and labor. Click the factory icon to manufacture more.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {composedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Factory className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p>No composed products yet.</p>
                    <Button 
                      className="mt-4" 
                      variant="outline"
                      onClick={() => {
                        form.reset({ type: "composed" });
                        setSelectedComponents([]);
                        setActiveTab("add");
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Composed Product
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {composedItems.map(product => {
                      const totalCost = calculateComposedProductCost(product);
                      const margin = calculateProfitMargin(totalCost, product.salePrice);
                      return (
                        <div key={product.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Layers className="h-8 w-8 text-purple-600" />
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Cost: {formatCurrency(totalCost, "USD")} | 
                                  Sale: {formatCurrency(product.salePrice, "USD")} | 
                                  Margin: {margin}%
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <StockStatusBadge product={product} />
                              <Button size="sm" variant="outline" className="text-purple-600" onClick={() => openManufactureDialog(product)}>
                                <Factory className="mr-2 h-4 w-4" />
                                Manufacture
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* Components breakdown */}
                          <div className="bg-muted/50 rounded p-3 mt-2">
                            <p className="text-sm font-medium mb-2">Components:</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {product.components?.map((c: ComposedProductComponent) => (
                                <div key={c.productId} className="text-sm">
                                  <span className="text-muted-foreground">{c.quantity}x</span> {c.productName}
                                  <span className="text-muted-foreground ml-1">({formatCurrency(c.unitCost * c.quantity, "USD")})</span>
                                </div>
                              ))}
                            </div>
                            {product.serviceCost > 0 && (
                              <p className="text-sm mt-2">
                                <span className="text-muted-foreground">Labor/Service Cost:</span> {formatCurrency(product.serviceCost, "USD")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="low-stock" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Low Stock & Out of Stock Items
                </CardTitle>
                <CardDescription>Items that need restocking attention</CardDescription>
              </CardHeader>
              <CardContent>
                {[...outOfStockProducts, ...lowStockProducts].length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>All products are well stocked! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {outOfStockProducts.map(product => (
                      <div key={product.id} className="flex items-center justify-between p-4 border border-red-200 dark:border-red-900 rounded-lg bg-red-50 dark:bg-red-950/20">
                        <div className="flex items-center gap-4">
                          {product.type === "composed" ? (
                            <Layers className="h-8 w-8 text-red-600" />
                          ) : (
                            <Package className="h-8 w-8 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-red-600">Out of Stock</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {product.type === "composed" && (
                            <Button size="sm" variant="outline" onClick={() => openManufactureDialog(product)}>
                              <Factory className="mr-2 h-4 w-4" />
                              Manufacture
                            </Button>
                          )}
                          <Button size="sm" onClick={() => handleEdit(product)}>
                            Update Stock
                          </Button>
                        </div>
                      </div>
                    ))}
                    {lowStockProducts.map(product => (
                      <div key={product.id} className="flex items-center justify-between p-4 border border-amber-200 dark:border-amber-900 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                        <div className="flex items-center gap-4">
                          {product.type === "composed" ? (
                            <Layers className="h-8 w-8 text-amber-600" />
                          ) : (
                            <Package className="h-8 w-8 text-amber-600" />
                          )}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-amber-600">Only {product.stockQuantity} left (Alert: {product.lowStockAlert || 10})</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {product.type === "composed" && (
                            <Button size="sm" variant="outline" onClick={() => openManufactureDialog(product)}>
                              <Factory className="mr-2 h-4 w-4" />
                              Manufacture
                            </Button>
                          )}
                          <Button size="sm" onClick={() => handleEdit(product)}>
                            Update Stock
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="add">
            <Card>
              <CardHeader>
                <CardTitle>{editingProduct ? "Edit Item" : "Add New Item"}</CardTitle>
                <CardDescription>
                  {editingProduct ? "Update item details" : "Add a new product, service, or composed product to your inventory"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Type Toggle */}
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <FormControl>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                type="button"
                                variant={field.value === "product" ? "default" : "outline"}
                                onClick={() => field.onChange("product")}
                                className="flex-1 min-w-[120px]"
                              >
                                <Package className="mr-2 h-4 w-4" />
                                Product
                              </Button>
                              <Button
                                type="button"
                                variant={field.value === "service" ? "default" : "outline"}
                                onClick={() => field.onChange("service")}
                                className="flex-1 min-w-[120px]"
                              >
                                <Tag className="mr-2 h-4 w-4" />
                                Service
                              </Button>
                              <Button
                                type="button"
                                variant={field.value === "composed" ? "default" : "outline"}
                                onClick={() => field.onChange("composed")}
                                className="flex-1 min-w-[120px]"
                              >
                                <Layers className="mr-2 h-4 w-4" />
                                Composed
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="sku"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SKU (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., PRD-001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Components section - only for composed products */}
                    {productType === "composed" && (
                      <div className="space-y-4 p-4 border rounded-lg bg-purple-50 dark:bg-purple-950/20">
                        <div className="flex items-center gap-2">
                          <Hammer className="h-5 w-5 text-purple-600" />
                          <h3 className="font-medium">Bill of Materials (Components)</h3>
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                          <Select value={componentProductId} onValueChange={setComponentProductId}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select raw product" />
                            </SelectTrigger>
                            <SelectContent>
                              {productItems.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({formatCurrency(p.rawPrice || 0, "USD")})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <NumericInput
                            allowDecimal={false}
                            value={componentQuantity}
                            onValueChange={(n) => setComponentQuantity(n ?? 0)}
                            className="w-20"
                            placeholder="Qty"
                          />
                          <Button type="button" variant="outline" onClick={addComponent}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {selectedComponents.length > 0 && (
                          <div className="space-y-2">
                            {selectedComponents.map(c => (
                              <div key={c.productId} className="flex items-center justify-between p-2 bg-background rounded border">
                                <span>{c.quantity}x {c.productName} = {formatCurrency(c.quantity * c.unitCost, "USD")}</span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeComponent(c.productId)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <p className="text-sm font-medium">
                              Components Cost: {formatCurrency(calculateTotalComponentCost(), "USD")}
                            </p>
                          </div>
                        )}
                        
                        <FormField
                          control={form.control}
                          name="serviceCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Labor / Service Cost</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <NumericInput
                                    placeholder="0.00"
                                    className="pl-8"
                                    value={field.value as number | null | undefined}
                                    onValueChange={(n) => field.onChange(n ?? 0)}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <p className="text-sm font-medium text-purple-600">
                          Total Production Cost: {formatCurrency(calculateTotalComponentCost() + (form.watch("serviceCost") || 0), "USD")}
                        </p>
                      </div>
                    )}

                    {/* Cost/Price fields - not for composed (calculated) */}
                    {productType !== "composed" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="rawPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cost Price (Buy Price)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <NumericInput
                                    placeholder="0.00"
                                    className="pl-8"
                                    value={field.value as number | null | undefined}
                                    onValueChange={(n) => field.onChange(n)}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="salePrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sale Price *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Tag className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                  <NumericInput
                                    placeholder="0.00"
                                    className="pl-8"
                                    value={field.value as number | null | undefined}
                                    onValueChange={(n) => field.onChange(n)}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Sale price for composed */}
                    {productType === "composed" && (
                      <FormField
                        control={form.control}
                        name="salePrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sale Price *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Tag className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <NumericInput
                                  placeholder="0.00"
                                  className="pl-8"
                                  value={field.value as number | null | undefined}
                                  onValueChange={(n) => field.onChange(n)}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Stock fields - only for products and composed */}
                    {(productType === "product" || productType === "composed") && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="stockQuantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Stock Quantity {productType === "composed" && "(Initial)"}</FormLabel>
                              <FormControl>
                                <NumericInput
                                  allowDecimal={false}
                                  placeholder="0"
                                  value={field.value as number | null | undefined}
                                  onValueChange={(n) => field.onChange(n ?? 0)}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="lowStockAlert"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Low Stock Alert Threshold</FormLabel>
                              <FormControl>
                                <NumericInput
                                  allowDecimal={false}
                                  placeholder="10"
                                  value={field.value as number | null | undefined}
                                  onValueChange={(n) => field.onChange(n ?? 0)}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Category for services */}
                    {productType === "service" && (
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Consulting, Maintenance" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Enter description"
                              {...field} 
                              className="resize-none min-h-[100px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-4">
                      <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                        {editingProduct ? "Update" : "Add"} {productType === "product" ? "Product" : productType === "service" ? "Service" : "Composed Product"}
                      </Button>
                      {editingProduct && (
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => {
                            setEditingProduct(null);
                            form.reset();
                            setSelectedComponents([]);
                            setActiveTab("products");
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Manufacture Dialog */}
      <Dialog open={isManufactureDialogOpen} onOpenChange={setIsManufactureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-purple-600" />
              Manufacture {productToManufacture?.name}
            </DialogTitle>
            <DialogDescription>
              This will consume raw materials and produce finished products.
            </DialogDescription>
          </DialogHeader>
          
          {productToManufacture && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Required Materials (per unit):</p>
                {productToManufacture.components?.map((c: ComposedProductComponent) => {
                  const rawProduct = products.find(p => p.id === c.productId);
                  const currentStock = rawProduct?.stockQuantity || 0;
                  const requiredTotal = c.quantity * manufactureQuantity;
                  const hasEnough = currentStock >= requiredTotal;
                  return (
                    <div key={c.productId} className="flex justify-between text-sm">
                      <span>{c.productName}</span>
                      <span className={hasEnough ? "text-green-600" : "text-red-600"}>
                        {c.quantity}x × {manufactureQuantity} = {requiredTotal} (have: {currentStock})
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <div>
                <label className="text-sm font-medium">Quantity to Manufacture</label>
                <NumericInput
                  allowDecimal={false}
                  value={manufactureQuantity}
                  onValueChange={(n) => setManufactureQuantity(n ?? 0)}
                  className="mt-1"
                  placeholder="0"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManufactureDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleManufacture}>
              <Factory className="mr-2 h-4 w-4" />
              Manufacture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Inventory;
