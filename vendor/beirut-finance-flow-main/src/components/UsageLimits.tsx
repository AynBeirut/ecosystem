import { useAppContext } from "@/context/AppContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FileText, Receipt, FileSpreadsheet, ShoppingCart, Users, Package } from "lucide-react";

const UsageLimits = () => {
  const { user, checkLimit } = useAppContext();

  if (!user || user.plan === "pro" || user.isDemoAccount) {
    return null; // Don't show limits for pro users or demo accounts
  }

  const limits = [
    { type: "invoices" as const, label: "Invoices", icon: FileText },
    { type: "estimates" as const, label: "Estimates", icon: FileSpreadsheet },
    { type: "receipts" as const, label: "Receipts", icon: Receipt },
    { type: "purchaseOrders" as const, label: "Purchase Orders", icon: ShoppingCart },
    { type: "clients" as const, label: "Clients", icon: Users },
    { type: "products" as const, label: "Products/Services", icon: Package },
  ];

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border-amber-200 dark:border-amber-800">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Usage This Month</h3>
          <Badge variant="secondary">Free Plan</Badge>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {limits.map(({ type, label, icon: Icon }) => {
            const { current, limit } = checkLimit(type);
            const percentage = limit === Infinity ? 0 : (current / limit) * 100;
            const isNearLimit = percentage >= 80;
            const isAtLimit = percentage >= 100;

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <span className={`text-sm font-semibold ${isAtLimit ? "text-red-600" : isNearLimit ? "text-amber-600" : "text-muted-foreground"}`}>
                    {current}/{limit === Infinity ? "∞" : limit}
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className={isAtLimit ? "bg-red-100 dark:bg-red-950" : isNearLimit ? "bg-amber-100 dark:bg-amber-950" : ""}
                />
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Limits reset at the start of each month. Upgrade to remove all limits.
        </p>
      </CardContent>
    </Card>
  );
};

export default UsageLimits;
