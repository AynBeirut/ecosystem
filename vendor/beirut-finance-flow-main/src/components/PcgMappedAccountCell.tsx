import { resolvePcgDisplay, type PcgDisplayAccount } from "@/lib/ledger/grabioToPcgMap";
import type { PcgClientAccount } from "@/types/generalLedger";

type Props = {
  grabioCode: string;
  grabioName: string;
  showArabic?: boolean;
  className?: string;
};

export function PcgMappedAccountCell({
  grabioCode,
  grabioName,
  showArabic = false,
  className,
}: Props) {
  const pcg: PcgDisplayAccount | null = resolvePcgDisplay(grabioCode, grabioName);

  if (!pcg) {
    return (
      <div className={className}>
        <div className="font-mono text-sm">{grabioCode}</div>
        <div>{grabioName}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="font-mono text-sm">{pcg.pcgCode}</div>
      <div>{pcg.name}</div>
      {showArabic && pcg.nameAr ? (
        <div dir="rtl" className="text-xs text-muted-foreground text-right">
          {pcg.nameAr}
        </div>
      ) : null}
      <div className="text-[10px] text-muted-foreground font-mono">Grabio {grabioCode}</div>
    </div>
  );
}

export function PcgMappedCodeBadge({
  grabioCode,
  clientByGrabio,
  showGrabioHint = false,
}: {
  grabioCode: string;
  clientByGrabio?: ReadonlyMap<string, PcgClientAccount>;
  /** Show internal Grabio posting code (advanced / posting accounts table only). */
  showGrabioHint?: boolean;
}) {
  const pcg = resolvePcgDisplay(grabioCode, undefined, clientByGrabio);
  if (!pcg) return <span className="font-mono">{grabioCode}</span>;
  return (
    <div className="leading-tight min-w-[72px]">
      <div className="font-mono text-sm tabular-nums">{pcg.pcgCode}</div>
      {showGrabioHint ? (
        <div className="mt-1 text-[10px] text-muted-foreground whitespace-nowrap">
          Grabio <span className="font-mono">{grabioCode}</span>
        </div>
      ) : null}
    </div>
  );
}
