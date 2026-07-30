import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState("Completing Google sign-in...");

  useEffect(() => {
    const completeSignIn = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDescription = params.get("error_description") || params.get("error");

      if (errorDescription) {
        toast({ title: "Google sign-in failed", description: errorDescription, variant: "destructive" });
        navigate("/", { replace: true });
        return;
      }

      if (!code) {
        setMessage("No OAuth code was returned. Redirecting...");
        navigate("/", { replace: true });
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
        navigate("/", { replace: true });
        return;
      }

      toast({ title: "Welcome!", description: "Signed in with Google." });
      navigate("/", { replace: true });
    };

    completeSignIn();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {message}
      </div>
    </div>
  );
};

export default AuthCallback;
