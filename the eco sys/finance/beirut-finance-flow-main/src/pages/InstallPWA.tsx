import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Download, CheckCircle } from "lucide-react";
import { pwaInstaller } from "@/lib/pwaInstall";
import AppLayout from "@/components/AppLayout";
import { useNavigate } from "react-router-dom";
import { BRAND } from "@/lib/branding";

const InstallPWA = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [instructions, setInstructions] = useState({ platform: '', steps: [] as string[] });
  const navigate = useNavigate();

  useEffect(() => {
    setCanInstall(pwaInstaller.canInstall());
    setIsInstalled(pwaInstaller.isAppInstalled());
    setInstructions(pwaInstaller.getInstallInstructions());
  }, []);

  const handleInstall = async () => {
    const success = await pwaInstaller.showInstallPrompt();
    if (success) {
      setIsInstalled(true);
      setCanInstall(false);
    }
  };

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <AppLayout onLogout={handleLogout}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Install App</h1>
          <p className="text-muted-foreground">
            Install {BRAND.shortName} on your device — syncs with your Grabio store via Firebase
          </p>
        </div>

        {isInstalled ? (
          <Card className="border-green-500">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <CardTitle>App Installed!</CardTitle>
              </div>
              <CardDescription>
                The app is installed and ready to use offline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your invoices and clients sync to your Grabio store in the cloud.
                On Android, search <strong>Grabio Invoice</strong> on Google Play once published.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-6 w-6" />
                  <CardTitle>Install on {instructions.platform}</CardTitle>
                </div>
                <CardDescription>
                  Follow these steps to install the app on your device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {instructions.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="font-semibold min-w-[24px]">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                {canInstall && (
                  <div className="mt-6">
                    <Button onClick={handleInstall} size="lg" className="w-full">
                      <Download className="mr-2 h-5 w-5" />
                      Install Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Why Install?</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Cloud sync:</strong> Same login as grabio.space — data in your store</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>PDF export:</strong> Save invoices and estimates as PDF from any screen</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Google Play:</strong> Android app ({BRAND.playStorePackage}) — updates ship via the web, no reinstall</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default InstallPWA;
