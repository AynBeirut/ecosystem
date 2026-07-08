
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Hero from "@/components/Hero";
import LoginForm from "@/components/LoginForm";
import { useAppContext } from "@/context/AppContext";
import { auth } from "@/integrations/firebase/client";
import {
  markGoogleAuthPending,
  shouldUseGoogleRedirect,
} from "@/lib/grabio/googleAuth";
import { isFinanceInAppShell } from "@/lib/playStoreNavScope";

const Index = () => {
  const { isLoggedIn, login, startGuestDemo } = useAppContext();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleTryDemo = () => {
    startGuestDemo();
    toast({
      title: "Demo mode",
      description: "Explore with one of each: client, product, invoice, estimate, receipt, and purchase.",
    });
    navigate("/invoices");
  };

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      login(email, password);
      toast({ title: "Welcome back", description: "Signed in to Grabio Invoice Manager" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (email: string, password: string) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      login(email, password);
      toast({ title: "Account created", description: "Welcome to Grabio Invoice Manager" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (shouldUseGoogleRedirect()) {
        markGoogleAuthPending();
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
      toast({ title: "Welcome", description: "Signed in with Google" });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (
        e.code === 'auth/popup-blocked' ||
        e.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        markGoogleAuthPending();
        await signInWithRedirect(auth, provider);
        return;
      }
      const message = err instanceof Error ? err.message : "Try again.";
      toast({ title: "Google sign-in failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inShell = isFinanceInAppShell();

  if (isLoggedIn) {
    return <Navigate to="/invoices" replace />;
  }

  // Compact login when inside Grabio Admin app — no marketing sections
  if (inShell) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <p className="text-2xl font-bold text-white">Invoice Manager</p>
            <p className="text-sm text-gray-400 mt-1">Sign in to continue</p>
          </div>
          <Card className="p-6 bg-gray-900 border-gray-800">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-gray-800">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} loading={loading} />
              </TabsContent>
              <TabsContent value="register">
                <LoginForm onLogin={handleRegister} onGoogleLogin={handleGoogleLogin} isRegister loading={loading} />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-8">
          <Hero onTryDemo={handleTryDemo} />
          <Card className="mx-auto max-w-md p-6 mt-8 shadow-lg border-t-4 border-[#38B2AC]">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} loading={loading} />
              </TabsContent>
              <TabsContent value="register">
                <LoginForm
                  onLogin={handleRegister}
                  onGoogleLogin={handleGoogleLogin}
                  isRegister
                  loading={loading}
                />
              </TabsContent>
            </Tabs>
            <div className="mt-4 pt-4 border-t text-center">
              <button className="text-sm text-[#38B2AC] hover:underline bg-transparent border-none cursor-pointer" onClick={handleTryDemo}>
                Try demo without signing in
              </button>
            </div>
          </Card>
          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Grabio Invoice Manager — part of the Grabio ecosystem</p>
            <p className="mt-1">Same account as grabio.space</p>
          </div>
        </div>
    </div>
  );
};

export default Index;
