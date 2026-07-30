import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * NumericInput — UX standard for Ayn Beirut apps.
 *
 * Rules (DO NOT VIOLATE):
 *  - Internal string state while editing. Never coerce to a number on every keystroke.
 *  - Empty value is allowed while editing.
 *  - Decimals and partial input ("0.", "-", ".5") allowed during typing.
 *  - Parsing happens only on blur (and is also reported on each valid keystroke
 *    so external state stays correct, but the displayed text is never forced).
 *  - When focused, external prop changes do NOT overwrite the user's text.
 *
 * Props:
 *  - value: number | null | undefined (the canonical numeric value)
 *  - onValueChange: (n: number | null) => void
 *  - onBlurValue?: (n: number | null) => void
 *  - allowDecimal (default true), allowNegative (default false)
 *  - emptyAsNull (default true): if false, empty commits to 0 on blur instead of null.
 *  - All other <input> props are passed through (placeholder, className, min, step, etc.).
 */
export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | null | undefined;
  onValueChange: (next: number | null) => void;
  onBlurValue?: (next: number | null) => void;
  allowDecimal?: boolean;
  allowNegative?: boolean;
  emptyAsNull?: boolean;
}

function formatExternal(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v as number)) return "";
  return String(v);
}

function parseLoose(
  s: string,
  allowDecimal: boolean,
  allowNegative: boolean
): number | null {
  if (s === "" || s === "-" || s === "." || s === "-.") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (!allowNegative && n < 0) return null;
  if (!allowDecimal && !Number.isInteger(n)) return Math.trunc(n);
  return n;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onValueChange,
      onBlurValue,
      onFocus,
      onBlur,
      allowDecimal = true,
      allowNegative = false,
      emptyAsNull = true,
      inputMode,
      ...rest
    },
    ref
  ) => {
    const [text, setText] = React.useState<string>(() => formatExternal(value));
    const focusedRef = React.useRef(false);

    // Sync from external when not focused — never overwrite while user is typing.
    React.useEffect(() => {
      if (!focusedRef.current) {
        const next = formatExternal(value);
        setText((prev) => (prev === next ? prev : next));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Permissive filter: digits, optional leading minus, optional single dot.
      const pattern = allowDecimal
        ? allowNegative
          ? /^-?\d*\.?\d*$/
          : /^\d*\.?\d*$/
        : allowNegative
          ? /^-?\d*$/
          : /^\d*$/;

      if (raw !== "" && !pattern.test(raw)) return; // reject illegal chars silently

      setText(raw);

      const parsed = parseLoose(raw, allowDecimal, allowNegative);
      // Propagate to parent so saves/totals stay correct, but DO NOT touch text.
      onValueChange(parsed);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      focusedRef.current = true;
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      focusedRef.current = false;
      const parsed = parseLoose(text, allowDecimal, allowNegative);
      const committed = parsed === null && !emptyAsNull ? 0 : parsed;
      // Normalize the displayed text to canonical form on blur (e.g. "0." -> "0").
      setText(formatExternal(committed));
      onValueChange(committed);
      onBlurValue?.(committed);
      onBlur?.(e);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={inputMode ?? (allowDecimal ? "decimal" : "numeric")}
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...rest}
      />
    );
  }
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
