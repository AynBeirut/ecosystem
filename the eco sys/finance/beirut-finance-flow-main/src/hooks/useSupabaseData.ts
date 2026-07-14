import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Scope = "user" | "organization";

interface UseSupabaseTableOptions {
  scope?: Scope;
  organizationId?: string | null;
}

// Generic hook for Supabase CRUD on any table.
// Default scope: "user" (filters by user_id) — used by user-personal tables (e.g. currency_settings).
// scope: "organization" filters by organization_id and stamps both user_id + organization_id on inserts.
export function useSupabaseTable<T extends { id: string }>(
  tableName: string,
  userId: string | undefined,
  options: UseSupabaseTableOptions = {}
) {
  const scope: Scope = options.scope ?? "user";
  const organizationId = options.organizationId ?? null;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!userId) { setData([]); setLoading(false); return; }
    if (scope === "organization" && !organizationId) {
      setData([]); setLoading(false); return;
    }
    setLoading(true);
    const query = supabase.from(tableName as any).select("*");
    const filtered = scope === "organization"
      ? query.eq("organization_id", organizationId as string)
      : query.eq("user_id", userId);
    const { data: rows, error } = await filtered.order("created_at", { ascending: false });

    if (error) {
      console.error(`[${tableName}] fetch error:`, error);
      toast({ title: "Error", description: `Failed to load ${tableName}`, variant: "destructive" });
    } else {
      setData((rows as any[]) || []);
    }
    setLoading(false);
  }, [userId, tableName, toast, scope, organizationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const insert = async (row: Omit<T, "id" | "created_at" | "updated_at">) => {
    if (scope === "organization" && !organizationId && !(row as any).organization_id) {
      toast({ title: "Error", description: "No active organization selected", variant: "destructive" });
      return null;
    }
    const payload: any = { ...row, user_id: userId };
    if (scope === "organization" && !payload.organization_id) {
      payload.organization_id = organizationId;
    }
    const { data: inserted, error } = await supabase
      .from(tableName as any)
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error(`[${tableName}] insert error:`, error);
      toast({ title: "Error", description: error.message || `Failed to create ${tableName} record`, variant: "destructive" });
      return null;
    }
    const result = inserted as unknown as T;
    setData(prev => [result, ...prev]);
    return result;
  };

  const update = async (id: string, updates: Partial<T>) => {
    // Never allow client to attempt switching organization_id (DB trigger also blocks it)
    const safeUpdates: any = { ...updates };
    delete safeUpdates.organization_id;
    const { error } = await supabase
      .from(tableName as any)
      .update(safeUpdates)
      .eq("id", id);

    if (error) {
      console.error(`[${tableName}] update error:`, error);
      toast({ title: "Error", description: error.message || `Failed to update record`, variant: "destructive" });
      return false;
    }
    setData(prev => prev.map(item => (item.id === id ? { ...item, ...safeUpdates } : item)));
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from(tableName as any)
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`[${tableName}] delete error:`, error);
      toast({ title: "Error", description: error.message || `Failed to delete record`, variant: "destructive" });
      return false;
    }
    setData(prev => prev.filter(item => item.id !== id));
    return true;
  };

  return { data, loading, fetchData, insert, update, remove, setData };
}

// Hook to get current Supabase auth user ID
export function useSupabaseUserId() {
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  return userId;
}
