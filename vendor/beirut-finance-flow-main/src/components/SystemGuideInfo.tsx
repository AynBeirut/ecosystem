import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type SystemGuideInfoProps = {
  enabled: boolean;
  label: string;
  title: string;
  content: string[];
  className?: string;
};

const SystemGuideInfo = ({
  enabled,
  label,
  title,
  content,
  className = "",
}: SystemGuideInfoProps) => {
  if (!enabled) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/20 text-current/80 transition hover:text-current focus:outline-none focus:ring-2 focus:ring-current/30 ${className}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2 z-[200]">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="space-y-2 text-sm text-muted-foreground">
          {content.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SystemGuideInfo;
