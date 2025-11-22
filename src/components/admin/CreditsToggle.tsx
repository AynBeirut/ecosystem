
import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from '@/components/ui/sonner';

interface CreditsToggleProps {
  allowsCredits: boolean;
  onToggle: (value: boolean) => void;
}

const CreditsToggle = ({ allowsCredits, onToggle }: CreditsToggleProps) => {
  const handleToggle = (checked: boolean) => {
    onToggle(checked);
    toast.success(`Video reward credits ${checked ? 'enabled' : 'disabled'} for your store`);
  };

  return (
    <div className="flex items-center space-x-4">
      <Switch
        id="credits-toggle"
        checked={allowsCredits}
        onCheckedChange={handleToggle}
      />
      <Label htmlFor="credits-toggle">
        Allow customers to use video reward credits in your store
      </Label>
    </div>
  );
};

export default CreditsToggle;
