
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sun, Moon, LogOut, Mail } from "lucide-react";
import DataImportDialog from "@/components/DataImportDialog";
import SimImportDialog from "@/components/SimImportDialog";
import { BRAND } from "@/lib/branding";

const Settings = () => {
  const { user, isDarkMode, toggleDarkMode, logout } = useAppContext();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: false
  });

  const [privacy, setPrivacy] = useState({
    dataSharing: false,
    analytics: true
  });

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You've been successfully logged out",
    });
  };

  const handleToggleDarkMode = () => {
    toggleDarkMode();
    toast({
      title: isDarkMode ? "Light Mode" : "Dark Mode",
      description: isDarkMode ? "Use a bright theme for daylight viewing" : "Use a dark theme for better night viewing",
    });
  };

  const handleNotificationChange = (type: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type]
    }));

    toast({
      title: "Notifications Updated",
      description: `${type.charAt(0).toUpperCase() + type.slice(1)} ${notifications[type] ? "Disabled" : "Enabled"}`,
    });
  };

  const handlePrivacyChange = (type: keyof typeof privacy) => {
    setPrivacy(prev => ({
      ...prev,
      [type]: !prev[type]
    }));

    toast({
      title: "Privacy Settings Updated",
      description: `${type === 'dataSharing' ? "Data Sharing" : "Analytics"} ${privacy[type] ? "Disabled" : "Enabled"}`,
    });
  };

  const handleLanguageChange = (lang: string) => {
    // Language functionality removed
    toast({
      title: "Language Updated",
      description: `Language changed to: ${lang}`,
    });
  };

  const handleToggleDemoAccount = () => {
    // Toggle handled in AppContext
    toast({
      title: user?.isDemoAccount ? "Demo Mode Disabled" : "Demo Mode Enabled",
      description: user?.isDemoAccount ? "No longer bypassing limits" : "Bypassing free-tier limits",
    });
  };

  const handleToggleDeveloperProMode = () => {
    // Toggle handled in AppContext  
    toast({
      title: user?.plan === "pro" ? "Developer Pro Mode Disabled" : "Developer Pro Mode Enabled", 
      description: user?.plan === "pro" ? "Switched to Free mode" : "Switched to Pro mode",
    });
  };

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your account settings</p>
        </div>
        
        <Tabs defaultValue="general">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Company &amp; invoice branding</CardTitle>
                <CardDescription>
                  Store name, logo, email, website, and invoice template are managed in Grabio Admin.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={`${BRAND.ecosystemUrl}/admin/profile`}
                  className="inline-flex items-center text-sm font-medium text-[#38B2AC] hover:underline"
                >
                  Open Business &amp; Invoice Settings in Grabio Admin →
                </a>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {isDarkMode ? (
                      <div className="bg-gray-800 text-white p-2 rounded-md">
                        <Moon className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="bg-amber-100 text-amber-700 p-2 rounded-md">
                        <Sun className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{isDarkMode ? "Dark Mode" : "Light Mode"}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isDarkMode ? "Use a dark theme for better night viewing" : "Use a bright theme for daylight viewing"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={handleToggleDarkMode}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Language</CardTitle>
                <CardDescription>Set your preferred language</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    variant="default"
                    className="bg-indigo-600"
                    onClick={() => handleLanguageChange("en")}
                  >
                    English
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleLanguageChange("ar")}
                  >
                    العربية
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleLanguageChange("fr")}
                  >
                    Français
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Developer Settings</CardTitle>
                <CardDescription>Testing and development options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Label>Demo Account Mode</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Bypass all credit deductions for testing
                    </p>
                  </div>
                  <Switch
                    checked={user?.isDemoAccount || false}
                    onCheckedChange={handleToggleDemoAccount}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Label>Developer Pro Mode</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Toggle between Free and Pro plans for testing
                    </p>
                  </div>
                  <Switch
                    checked={user?.plan === "pro" || false}
                    onCheckedChange={handleToggleDeveloperProMode}
                  />
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p><strong>Current Status:</strong></p>
                  <p>Plan: {user?.plan || "free"}</p>
                  <p>Demo Mode: {user?.isDemoAccount ? "Enabled" : "Disabled"}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Account Settings</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive"
                  className="w-full sm:w-auto flex items-center"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="notifications" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>How would you like to be notified?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="email-notif">Email Notifications</Label>
                      <p className="text-sm text-gray-500">Get notified via email about important updates</p>
                    </div>
                    <Switch
                      id="email-notif"
                      checked={notifications.email}
                      onCheckedChange={() => handleNotificationChange('email')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="push-notif">Push Notifications</Label>
                      <p className="text-sm text-gray-500">Get notified directly in your browser</p>
                    </div>
                    <Switch
                      id="push-notif"
                      checked={notifications.push}
                      onCheckedChange={() => handleNotificationChange('push')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="sms-notif">SMS Notifications</Label>
                      <p className="text-sm text-gray-500">Get notified via SMS for critical alerts</p>
                    </div>
                    <Switch
                      id="sms-notif"
                      checked={notifications.sms}
                      onCheckedChange={() => handleNotificationChange('sms')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="privacy" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>Control how your information is used</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="data-sharing">Data Sharing</Label>
                      <p className="text-sm text-gray-500">Allow us to share your usage data with our partners</p>
                    </div>
                    <Switch
                      id="data-sharing"
                      checked={privacy.dataSharing}
                      onCheckedChange={() => handlePrivacyChange('dataSharing')}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="analytics">Analytics</Label>
                      <p className="text-sm text-gray-500">Allow us to collect usage data to improve our service</p>
                    </div>
                    <Switch
                      id="analytics"
                      checked={privacy.analytics}
                      onCheckedChange={() => handlePrivacyChange('analytics')}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                  <a href={BRAND.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-[#38B2AC] hover:underline">
                    Privacy Policy
                  </a>
                  {' '}— how Grabio handles your data.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Support</CardTitle>
                <CardDescription>Get help with your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-start space-y-4">
                  <p>Having issues or questions?</p>
                  
                  <a href={`mailto:${BRAND.supportEmail}`}>
                    <Button className="bg-[#38B2AC] hover:bg-[#2C9A94] text-white">
                      <Mail className="mr-2 h-4 w-4" />
                      Email our support team
                    </Button>
                  </a>
                  
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg w-full">
                    <h3 className="font-medium mb-2">Support Hours</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
                      Monday to Friday, 9am to 5pm EST
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Import data</CardTitle>
                <CardDescription>
                  Bring your existing records into this organization from a CSV file.
                  Supported entities: clients, suppliers, and products. Choose whether
                  duplicates should be skipped or updated each time you import.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <DataImportDialog />
                <SimImportDialog />
                <p className="text-xs text-muted-foreground">
                  CSV imports use normal app limits. SIM migration imports historical records directly
                  so invoice and inventory calculations are not replayed.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
