
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import FinancePageShell from "@/components/FinancePageShell";
import { useAppContext } from "@/context/AppContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Tag, DollarSign } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

const productSchema = z.object({
  name: z.string().min(1, "Product/Service name is required"),
  description: z.string().optional(),
  type: z.enum(["product", "service"]).default("product"),
  rawPrice: z.coerce.number().min(0, "Cost must be 0 or greater").optional(),
  salePrice: z.coerce.number().min(0.01, "Sale price must be greater than 0"),
});

const ProductsManager = () => {
  const { products, addProduct, logout } = useAppContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("list");

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "product",
      rawPrice: undefined,
      salePrice: undefined,
    },
  });

  const productType = form.watch("type");

  const calculateProfitMargin = (rawPrice: number, salePrice: number): number => {
    if (rawPrice === 0) return 100;
    if (salePrice <= rawPrice) return 0;
    return parseFloat((((salePrice - rawPrice) / salePrice) * 100).toFixed(2));
  };

  const onSubmit = async (values: z.infer<typeof productSchema>) => {
    // Stock is intentionally NOT set here — new products start at 0 and only change
    // via purchase orders, manufacturing, or inventory adjustments.
    const productData: any = {
      name: values.name,
      description: values.description || "",
      type: values.type,
      rawPrice: values.rawPrice,
      salePrice: values.salePrice,
    };

    const id = await addProduct(productData);
    if (!id) return; // error toast already shown by context

    toast({
      title: `${values.type === "product" ? "Product" : "Service"} Added`,
      description: values.type === "product"
        ? "Product added with 0 stock. Use Purchase Orders or Inventory to add stock."
        : "Service has been successfully added",
    });

    form.reset();
    setActiveTab("list");
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    });
  };

  return (
    <FinancePageShell onLogout={handleLogout}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Products & Services</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your products and services</p>
          </div>
          <Button 
            className="mt-4 sm:mt-0 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setActiveTab("add")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        <Card>
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
            <CardHeader>
              <TabsList>
                <TabsTrigger value="list">Product List</TabsTrigger>
                <TabsTrigger value="add">Add Product</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
            <TabsContent value="list">
              {products.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No products added yet. Add your first product or service!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{product.name}</h3>
                        {product.type === "product" ? (
                          <Package className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Tag className="h-4 w-4 text-purple-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2 capitalize">{product.type}</p>
                      <div className="flex justify-between mt-1">
                        <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                          {formatCurrency(product.salePrice, "USD")}
                        </p>
                        {product.rawPrice !== undefined && (
                          <p className="text-sm text-gray-500">
                            Cost: {formatCurrency(product.rawPrice, "USD")}
                          </p>
                        )}
                      </div>
                      {product.type === "product" && product.stockQuantity !== undefined && (
                        <p className="mt-1 text-sm">
                          <span className={product.stockQuantity < 10 ? "text-red-600 font-semibold" : "text-gray-600"}>
                            Stock: {product.stockQuantity} units
                          </span>
                        </p>
                      )}
                      {product.rawPrice !== undefined && product.salePrice !== undefined && (
                        <p className="mt-1 text-green-600 text-sm">
                          Margin: {calculateProfitMargin(product.rawPrice, product.salePrice)}%
                        </p>
                      )}
                      {product.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          {product.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="add">
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
                          <div className="flex gap-4">
                            <Button
                              type="button"
                              variant={field.value === "product" ? "default" : "outline"}
                              onClick={() => field.onChange("product")}
                              className="flex-1"
                            >
                              <Package className="mr-2 h-4 w-4" />
                              Product
                            </Button>
                            <Button
                              type="button"
                              variant={field.value === "service" ? "default" : "outline"}
                              onClick={() => field.onChange("service")}
                              className="flex-1"
                            >
                              <Tag className="mr-2 h-4 w-4" />
                              Service
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{productType === "product" ? "Product" : "Service"} Name</FormLabel>
                        <FormControl>
                          <Input placeholder={`Enter ${productType === "product" ? "product" : "service"} name`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="rawPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost {productType === "service" && "(Optional)"}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
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
                          <FormLabel>Sale Price</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Tag className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
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

                  {productType === "product" && (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      Stock starts at 0. Add stock via Purchase Orders, Manufacturing, or Inventory adjustments.
                    </div>
                  )}


                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={`Enter ${productType === "product" ? "product" : "service"} description`}
                            {...field} 
                            className="resize-none min-h-[100px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      Add {productType === "product" ? "Product" : "Service"}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </CardContent>
          </Tabs>
        </Card>
      </div>
    </FinancePageShell>
  );
};

export default ProductsManager;
