import { Building2, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/context/AppContext";
import { toast } from "sonner";

const OrgSwitcher = () => {
  const { organizations, activeOrganizationId, setActiveOrganizationId, currentUserRole } = useAppContext();

  if (!organizations || organizations.length === 0) return null;

  const active = organizations.find(o => o.id === activeOrganizationId);

  const handleSwitch = async (id: string) => {
    if (id === activeOrganizationId) return;
    await setActiveOrganizationId(id);
    toast.success(`Switched to ${organizations.find(o => o.id === id)?.name}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[220px]">
          <Building2 className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{active?.name || "Select org"}</span>
          {currentUserRole && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
              {currentUserRole}
            </span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map(org => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => handleSwitch(org.id)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{org.name}</span>
            {org.id === activeOrganizationId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default OrgSwitcher;
