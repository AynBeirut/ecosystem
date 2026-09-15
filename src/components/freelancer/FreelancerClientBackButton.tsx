import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/useAuth';
import { getFreelancerPortalPath, isFreelancerClientSubAccount } from '@/lib/webBuilderAccess';
import { cn } from '@/lib/utils';

export function useReturnToFreelancerPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const canReturn = isFreelancerClientSubAccount(user);

  const returnToPortal = () => {
    if (!user?.id || !canReturn || busy) return;
    setBusy(true);
    try {
      localStorage.removeItem('subAccountInfo');
      localStorage.removeItem('sellerInfo');
      // Navigate while still sub_account — admin routes reject role=freelancer and send users to /.
      // FreelancerPortal restores portal identity on mount.
      navigate(getFreelancerPortalPath(), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not return to client list');
    } finally {
      setBusy(false);
    }
  };

  return { canReturn, returnToPortal, busy };
}

type FreelancerClientBackButtonProps = {
  variant?: 'sidebar' | 'sidebar-collapsed' | 'header' | 'compact';
  className?: string;
  onNavigate?: () => void;
};

const FreelancerClientBackButton: React.FC<FreelancerClientBackButtonProps> = ({
  variant = 'sidebar',
  className,
  onNavigate,
}) => {
  const { canReturn, returnToPortal, busy } = useReturnToFreelancerPortal();

  if (!canReturn) return null;

  const handleClick = () => {
    returnToPortal();
    onNavigate?.();
  };

  if (variant === 'header') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('text-white hover:bg-white/10 gap-1.5', className)}
        disabled={busy}
        onClick={handleClick}
      >
        <ArrowLeft className="h-4 w-4" />
        {busy ? 'Returning…' : 'Your clients'}
      </Button>
    );
  }

  if (variant === 'compact') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('gap-1.5', className)}
        disabled={busy}
        onClick={handleClick}
      >
        <Users className="h-3.5 w-3.5" />
        {busy ? 'Returning…' : 'Your clients'}
      </Button>
    );
  }

  if (variant === 'sidebar-collapsed') {
    return (
      <button
        type="button"
        title="Your clients"
        disabled={busy}
        onClick={handleClick}
        className={cn(
          'flex items-center justify-center rounded-lg py-2.5 transition w-full',
          'text-violet-300 hover:bg-violet-500/15',
          className,
        )}
      >
        <Users className="h-4 w-4 shrink-0" />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center px-3 py-2.5 rounded-xl border transition mb-3',
        'bg-violet-500/15 text-violet-200 border-violet-500/25 hover:bg-violet-500/25 hover:text-white',
        className,
      )}
    >
      <Users className="h-4 w-4 mr-3 shrink-0" />
      <span className="text-sm font-medium">{busy ? 'Returning…' : 'Your clients'}</span>
    </button>
  );
};

export default FreelancerClientBackButton;
