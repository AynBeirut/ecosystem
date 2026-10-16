import { useMemo } from "react";
import { useGrabioStore } from "@/hooks/useGrabioStore";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

/** Currencies an Invoice Manager document may use: store main, plus secondary when store setup has one. */
export function useStoreDocumentCurrencies() {
  const { profile } = useGrabioStore();
  return useMemo(() => {
    const main = String(profile?.mainCurrency || "USD").toUpperCase();
    const secondary = String(profile?.secondaryCurrency || "").toUpperCase();
    const codes = secondary && secondary !== main ? [main, secondary] : [main];
    return { codes, main };
  }, [profile?.mainCurrency, profile?.secondaryCurrency]);
}

export function clampStoreCurrency(value: string | undefined, codes: string[], main: string) {
  const current = String(value || "").toUpperCase();
  return codes.includes(current) ? current : main;
}

export function StoreCurrencyField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (code: string) => void;
}) {
  const { codes, main } = useStoreDocumentCurrencies();
  const current = String(value || main).toUpperCase();
  const choices = codes.includes(current) ? codes : [current, ...codes];

  return (
    <FormItem>
      <FormLabel>Currency</FormLabel>
      {choices.length === 1 ? (
        <Input readOnly value={choices[0]} />
      ) : (
        <Select onValueChange={onChange} value={current}>
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder={main} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {choices.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <FormMessage />
    </FormItem>
  );
}
