
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleAuth() {
      // If there is a hash, convert it to a query string and reload
        if (window.location.hash) {
          const newUrl = window.location.pathname + window.location.hash.replace('#', '?');
          navigate(newUrl, { replace: true });
          return;
        }
    }
    handleAuth();
  }, [navigate]);

  // This route is no longer needed for Firebase authentication.
  return (
    <div>
      <p>Authentication callback not required for Firebase.</p>
    </div>
  );
}
