
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";
import { BRAND } from "@/lib/branding";

const PremiumUpgrade = () => {
  const { user, logout } = useAppContext();
  const { toast } = useToast();

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    });
  };


  const PremiumFeature = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center space-x-2">
      <CheckCircle2 className="h-5 w-5 text-green-500" />
      <span>{children}</span>
    </div>
  );

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Premium Upgrade</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage modules and billing on your Grabio subscription
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle>Free Plan</CardTitle>
              <CardDescription>Your current plan</CardDescription>
              <div className="mt-4">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-gray-500 dark:text-gray-400">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>Basic invoice management</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>Basic receipt tracking</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>Limited operations (50 credits)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>Company profile management</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user?.plan === "pro" ? "You've upgraded to Premium" : "Limited to 10 documents per month"}
              </p>
            </CardFooter>
          </Card>

          <Card className={`border-2 ${user?.plan === "pro" ? "border-green-500" : "border-amber-500"} shadow-lg`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Premium Plan</CardTitle>
                  <CardDescription>Recommended for businesses</CardDescription>
                </div>
                {user?.plan === "pro" && (
                  <span className="px-2.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs font-medium rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">$5</span>
                <span className="text-gray-500 dark:text-gray-400">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <PremiumFeature>Everything in Free plan</PremiumFeature>
                <PremiumFeature>Unlimited operations</PremiumFeature>
                <PremiumFeature>Advanced reporting</PremiumFeature>
                <PremiumFeature>Sub-user management</PremiumFeature>
                <PremiumFeature>Export to PDF/Excel</PremiumFeature>
                <PremiumFeature>Priority support</PremiumFeature>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                asChild
                disabled={user?.plan === "pro"}
                className={`w-full ${user?.plan === "pro" ? "bg-green-600" : "bg-[#38B2AC] hover:bg-[#2C9A94] text-white"}`}
              >
                {user?.plan === "pro" ? (
                  <span>Already Subscribed</span>
                ) : (
                  <a href={BRAND.subscriptionUrl} target="_blank" rel="noopener noreferrer">
                    Manage on Grabio
                  </a>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium">What happens when I upgrade?</h3>
              <p className="text-gray-500 dark:text-gray-400">
                You'll get immediate access to all premium features, including unlimited operations.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Can I cancel anytime?</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Yes, you can cancel your subscription at any time from the settings menu.
              </p>
            </div>
            <div>
              <h3 className="font-medium">How do sub-users work?</h3>
              <p className="text-gray-500 dark:text-gray-400">
                With premium, you can invite team members to access your account with limited permissions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PremiumUpgrade;
