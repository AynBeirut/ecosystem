import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatVoucherAmountDisplay,
  sanitizeVoucherAmountInput,
} from "@/lib/ledger/voucherAmountInput";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  title?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLInputElement>) => void;
  "data-line-key"?: string;
  "data-line-field"?: string;
};

/** Wide text amount cell — full LBP values visible (500,000,000+). */
export function VoucherAmountInput({
  value,
  onChange,
  className,
  disabled,
  title,
  onKeyDown,
  onFocus,
  onMouseDown,
  ...dataAttrs
}: Props) {
  const [focused, setFocused] = useState(false);
  const display = focused ? sanitizeVoucherAmountInput(value) : formatVoucherAmountDisplay(value);

  return (
    <input
      {...dataAttrs}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      title={title ?? (value ? formatVoucherAmountDisplay(value) : undefined)}
      className={cn("text-right font-mono tabular-nums box-border", className)}
      value={display}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onMouseDown={onMouseDown}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(sanitizeVoucherAmountInput(e.target.value))}
    />
  );
}
