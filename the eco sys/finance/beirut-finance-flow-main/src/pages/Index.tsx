
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Hero from "@/components/Hero";
import Dashboard from "@/components/Dashboard";
import AppLayout from "@/components/AppLayout";
import LoginForm from "@/components/LoginForm";
import { useAppContext } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { isLoggedIn, user, login, logout } = useAppContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Try Supabase Auth sign-in first
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // If user doesn't exist, auto-register
        if (error.message.includes("Invalid login credentials")) {
          const { error: signUpError } = await supabase.auth.signUp({ email, password });
          if (signUpError) {
            toast({ title: "Error", description: signUpError.message, variant: "destructive" });
            setLoading(false);
            return;
          }
          toast({ title: "Account created!", description: "You're now signed in." });
        } else {
          toast({ title: "Error", description: error.message, variant: "destructive" });
          setLoading(false);
          return;
        }
      }
      // Sync AppContext state
      login(email, password);
      toast({ title: "Ahlan wa sahlan! 👋", description: "You're now logged in to AYN BEIRUT" });
    } catch (err) {
      toast({ title: "Error", description: "Login failed. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      // Auto-login after registration (auto-confirm is enabled)
      login(email, password);
      toast({ title: "Account created! 🎉", description: "Welcome to AYN BEIRUT" });
    } catch (err) {
      toast({ title: "Error", description: "Registration failed.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    toast({ title: "Logged out", description: "You've been successfully logged out" });
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      return;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Try again.";
      toast({ title: "Google sign-in failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-950">
      {isLoggedIn ? (
        <AppLayout onLogout={handleLogout}>
          <Dashboard />
        </AppLayout>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <Hero />
          <Card className="mx-auto max-w-md p-6 mt-8 shadow-lg border-t-4 border-indigo-500">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />
              </TabsContent>
              <TabsContent value="register">
                <LoginForm onLogin={handleRegister} onGoogleLogin={handleGoogleLogin} isRegister />
              </TabsContent>
            </Tabs>
          </Card>
          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>AYN BEIRUT Development - Financial tools for Lebanese businesses</p>
            <p className="mt-1">Made in Lebanon 🇱🇧</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
