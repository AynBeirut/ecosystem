import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRedirectResult } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { auth, authReady } from "@/integrations/firebase/client";
import { clearGoogleAuthPending } from "@/lib/grabio/googleAuth";
import { useToast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    const completeSignIn = async () => {
      try {
        await authReady;
        const result = await getRedirectResult(auth);
        clearGoogleAuthPending();
        if (result?.user) {
          toast({ title: "Welcome", description: "Signed in with Google." });
          navigate("/invoices", { replace: true });
          return;
        }
        navigate("/", { replace: true });
      } catch (err: unknown) {
        const description = err instanceof Error ? err.message : "Google sign-in failed";
        toast({ title: "Google sign-in failed", description, variant: "destructive" });
        setMessage("Redirecting...");
        navigate("/", { replace: true });
      }
    };

    void completeSignIn();
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
