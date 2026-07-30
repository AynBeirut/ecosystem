
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
} from "firebase/auth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Hero from "@/components/Hero";
import LoginForm from "@/components/LoginForm";
import { useAppContext } from "@/context/AppContext";
import { getFinanceAuth } from "@/integrations/firebase/client";
import {
  markGoogleAuthPending,
} from "@/lib/grabio/googleAuth";

const Index = () => {
  const { isLoggedIn, login } = useAppContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(getFinanceAuth(), email.trim(), password);
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
      await createUserWithEmailAndPassword(getFinanceAuth(), email.trim(), password);
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
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      markGoogleAuthPending();
      await signInWithRedirect(getFinanceAuth(), provider);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Try again.";
      toast({ title: "Google sign-in failed", description: message, variant: "destructive" });
      setLoading(false);
    }
  };

  if (isLoggedIn) {
    return <Navigate to="/invoices" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-8">
          <Hero />
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
