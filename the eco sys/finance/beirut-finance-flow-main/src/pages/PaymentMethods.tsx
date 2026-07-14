import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { CreditCard, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAppContext } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";

type PMType = "stripe" | "paypal" | "wish" | "omt" | "bank" | "card";
type PM = {
  id: string;
  organization_id: string;
  type: PMType;
  label: string | null;
  config: Record<string, any>;
  is_active: boolean;
};

const TYPE_LABEL: Record<PMType, string> = {
  stripe: "Stripe (cards)",
  paypal: "PayPal",
  wish: "Wish Money",
  omt: "OMT",
  bank: "Bank transfer",
  card: "Visa / Mastercard",
};

const PaymentMethods = () => {
  const { activeOrganizationId, hasPermission } = useAppContext();
  const canManage = hasPermission("manage_payment_methods");

  const [items, setItems] = useState<PM[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [type, setType] = useState<PMType>("stripe");
  const [label, setLabel] = useState("");
  const [stripeKey, setStripeKey] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrganizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_methods" as any)
      .select("id, organization_id, type, label, is_active")
      .eq("organization_id", activeOrganizationId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(((data as any[]) || []) as PM[]);
    setLoading(false);
  }, [activeOrganizationId]);

  useEffect(() => { load(); }, [load]);

  if (!activeOrganizationId) return <Navigate to="/" replace />;

  const buildConfig = (): Record<string, any> => {
    switch (type) {
      case "stripe":
      case "card":
        return { secret_key: stripeKey.trim() };
      case "paypal":
        return { email: paypalEmail.trim() };
      case "wish":
      case "omt":
        return { phone: phone.trim() };
      case "bank":
        return { details: bankDetails.trim() };
    }
  };

  const handleAdd = async () => {
    if (!canManage) return;
    const config = buildConfig();
    // Minimal validation per type
    if ((type === "stripe" || type === "card") && !String(config.secret_key || "").startsWith("sk_")) {
      toast.error("Stripe secret key must start with sk_");
      return;
    }
    if (type === "paypal" && !config.email) { toast.error("PayPal email required"); return; }
    if ((type === "wish" || type === "omt") && !config.phone) { toast.error("Phone number required"); return; }
    if (type === "bank" && !config.details) { toast.error("Bank details required"); return; }

    setSaving(true);
    const { error } = await supabase
      .from("payment_methods" as any)
      .insert({
        organization_id: activeOrganizationId,
        type,
        label: label.trim() || null,
        config,
        is_active: true,
      });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment method added");
    setLabel(""); setStripeKey(""); setPaypalEmail(""); setPhone(""); setBankDetails("");
    load();
  };

  const handleToggle = async (pm: PM, active: boolean) => {
    const { error } = await supabase
      .from("payment_methods" as any)
      .update({ is_active: active })
      .eq("id", pm.id);
    if (error) { toast.error(error.message); return; }
    setItems(items.map((i) => (i.id === pm.id ? { ...i, is_active: active } : i)));
  };

  const handleDelete = async (pm: PM) => {
    if (!confirm(`Delete ${TYPE_LABEL[pm.type]}?`)) return;
    const { error } = await supabase.from("payment_methods" as any).delete().eq("id", pm.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  return (
    <AppLayout onLogout={() => supabase.auth.signOut()}>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-indigo-600" /> Payment Methods
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure how customers can pay your invoices.
          </p>
        </div>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add a payment method
              </CardTitle>
              <CardDescription>
                Stripe keys are stored privately and only used server-side to create checkout sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABEL) as PMType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Label (optional, e.g. Main Stripe)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
              </div>

              {(type === "stripe" || type === "card") && (
                <Input
                  type="password"
                  placeholder="sk_live_… or sk_test_…"
                  value={stripeKey}
                  onChange={(e) => setStripeKey(e.target.value)}
                />
              )}
              {type === "paypal" && (
                <Input
                  type="email"
                  placeholder="paypal@example.com"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                />
              )}
              {(type === "wish" || type === "omt") && (
                <Input
                  placeholder="Phone number (e.g. +961…)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              )}
              {type === "bank" && (
                <Input
                  placeholder="Bank name, IBAN, beneficiary…"
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                />
              )}

              <Button onClick={handleAdd} disabled={saving}>
                {saving ? "Saving…" : "Add method"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configured methods ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && items.length === 0 && (
              <p className="text-sm text-muted-foreground">No payment methods configured.</p>
            )}
            <div className="space-y-2">
              {items.map((pm) => (
                <div key={pm.id} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {TYPE_LABEL[pm.type]}
                      {pm.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pm.label && <span className="mr-2">{pm.label}</span>}
                      <span className="italic">Credentials stored securely (server-side only)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {canManage && (
                      <>
                        <Switch
                          checked={pm.is_active}
                          onCheckedChange={(v) => handleToggle(pm, v)}
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(pm)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PaymentMethods;
