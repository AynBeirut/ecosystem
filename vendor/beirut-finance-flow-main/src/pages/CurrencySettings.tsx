import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAppContext } from "@/context/AppContext";
import { useFinanceTable } from "@/hooks/useFinanceTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, ArrowRightLeft, RefreshCw } from "lucide-react";

interface CurrencyRate {
  id: string;
  user_id: string;
  base_currency: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  label: string | null;
  is_default: boolean;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

const CURRENCIES = ["USD", "LBP", "EUR", "GBP", "SAR", "AED", "EGP", "JOD"];

const CurrencySettings = () => {
  const { logout } = useAppContext();
  const { toast } = useToast();
  const { data: rates, loading, insert, update, remove } = useFinanceTable<CurrencyRate>("currencySettings");

  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("LBP");
  const [rate, setRate] = useState("");
  const [label, setLabel] = useState("Market Rate");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);

  const handleAdd = async () => {
    if (!rate || parseFloat(rate) <= 0) {
      toast({ title: "Error", description: "Enter a valid rate", variant: "destructive" });
      return;
    }
    if (fromCurrency === toCurrency) {
      toast({ title: "Error", description: "From and To currencies must differ", variant: "destructive" });
      return;
    }
    const result = await insert({
      base_currency: fromCurrency,
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate: parseFloat(rate),
      label: label || null,
      is_default: false,
      effective_date: effectiveDate,
    } as any);
    if (result) {
      toast({ title: "Rate saved", description: `${fromCurrency} → ${toCurrency} = ${rate}` });
      setRate("");
    }
  };

  const handleSetDefault = async (id: string) => {
    // Unset all defaults for same pair, then set this one
    const target = rates.find(r => r.id === id);
    if (!target) return;
    const samePair = rates.filter(r => r.from_currency === target.from_currency && r.to_currency === target.to_currency);
    for (const r of samePair) {
      if (r.id !== id && r.is_default) await update(r.id, { is_default: false } as any);
    }
    await update(id, { is_default: true } as any);
    toast({ title: "Default rate set" });
  };

  const convert = (amount: number, from: string, to: string): { value: number; rate: number } | null => {
    if (from === to) return { value: amount, rate: 1 };
    const defaultRate = rates.find(r => r.from_currency === from && r.to_currency === to && r.is_default);
    const anyRate = rates.find(r => r.from_currency === from && r.to_currency === to);
    const r = defaultRate || anyRate;
    if (r) return { value: amount * r.rate, rate: r.rate };
    // Try reverse
    const rev = rates.find(r2 => r2.from_currency === to && r2.to_currency === from && r2.is_default) ||
                rates.find(r2 => r2.from_currency === to && r2.to_currency === from);
    if (rev) return { value: amount / rev.rate, rate: 1 / rev.rate };
    return null;
  };

  // Quick converter state
  const [convAmount, setConvAmount] = useState("100");
  const [convFrom, setConvFrom] = useState("USD");
  const [convTo, setConvTo] = useState("LBP");
  const convResult = convert(parseFloat(convAmount) || 0, convFrom, convTo);

  // Group rates by currency pair
  const pairGroups = rates.reduce((acc, r) => {
    const key = `${r.from_currency}→${r.to_currency}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, CurrencyRate[]>);

  return (
    <AppLayout onLogout={logout}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Currency Settings</h1>
          <p className="text-muted-foreground">Manage exchange rates for multi-currency operations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add rate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add Exchange Rate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>From</Label>
                  <select value={fromCurrency} onChange={e => setFromCurrency(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <select value={toCurrency} onChange={e => setToCurrency(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Rate (1 {fromCurrency} = ? {toCurrency})</Label>
                <Input type="number" step="0.000001" value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 89500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Market Rate" />
                </div>
                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleAdd} className="w-full">Save Rate</Button>
            </CardContent>
          </Card>

          {/* Quick converter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Quick Converter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={convAmount} onChange={e => setConvAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>From</Label>
                  <select value={convFrom} onChange={e => setConvFrom(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <select value={convTo} onChange={e => setConvTo(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                {convResult ? (
                  <div>
                    <p className="text-2xl font-bold">{new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(convResult.value)} {convTo}</p>
                    <p className="text-sm text-muted-foreground mt-1">Rate: 1 {convFrom} = {convResult.rate.toLocaleString()} {convTo}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No exchange rate set for {convFrom} → {convTo}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Saved rates */}
        <Card>
          <CardHeader>
            <CardTitle>Saved Exchange Rates</CardTitle>
            <CardDescription>Mark a rate as default to use it automatically in conversions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground">Loading...</p> : Object.keys(pairGroups).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No rates configured. Add your first exchange rate above.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(pairGroups).map(([pair, pairRates]) => (
                  <div key={pair} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2"><RefreshCw className="h-4 w-4" /> {pair}</h4>
                    <div className="space-y-2">
                      {pairRates.sort((a, b) => b.effective_date.localeCompare(a.effective_date)).map(r => (
                        <div key={r.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold">{r.rate.toLocaleString()}</span>
                            {r.label && <span className="text-sm text-muted-foreground">{r.label}</span>}
                            <span className="text-xs text-muted-foreground">{r.effective_date}</span>
                            {r.is_default && <Badge className="bg-primary text-primary-foreground text-xs">Default</Badge>}
                          </div>
                          <div className="flex gap-1">
                            {!r.is_default && <Button size="sm" variant="outline" onClick={() => handleSetDefault(r.id)} className="text-xs">Set Default</Button>}
                            <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CurrencySettings;
