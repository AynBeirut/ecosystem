import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { useAppContext } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/csvExport";
import { toast } from "sonner";
import { getReadableError } from "@/lib/error-utils";

const ExportMenu = () => {
  const { activeOrganizationId, currentUserRole } = useAppContext();
  const canExport = currentUserRole === "owner" || currentUserRole === "admin";
  if (!canExport || !activeOrganizationId) return null;

  const handle = async (table: "invoices" | "clients" | "payment_audit_logs" | "organization_members") => {
    try {
      const { data, error } = await supabase
        .from(table as any)
        .select("*")
        .eq("organization_id", activeOrganizationId);
      if (error) throw error;
      if (!data?.length) { toast.info("No data to export."); return; }
      downloadCSV(`${table}-${new Date().toISOString().slice(0,10)}.csv`, data as any[]);
      toast.success(`Exported ${table}`);
    } catch (e) {
      toast.error(getReadableError(e));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handle("invoices")}>Invoices CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("clients")}>Clients CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("payment_audit_logs")}>Payment audit CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handle("organization_members")}>Members CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportMenu;
