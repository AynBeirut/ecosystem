import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/useAuth";

interface BackButtonProps {
  to?: string;
  label?: string;
}

export default function BackButton({ to, label }: BackButtonProps = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const handleBack = () => {
    if (to) {
      navigate(to);
    } else {
      // Default behavior: Sub-accounts go to /team/dashboard, admins go to /admin/dashboard
      if (user?.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user?.role === 'sub_account') {
        navigate('/team/dashboard');
      } else {
        navigate('/');
      }
    }
  };
  
  return (
    <Button
      variant="outline"
      onClick={handleBack}
      className="gap-2"
      type="button"
    >
      <ArrowLeft className="h-4 w-4" /> {label || 'Back to Dashboard'}
    </Button>
  );
}
