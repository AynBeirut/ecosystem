import React from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EditorSidebarRailProps = {
  side: 'left' | 'right';
  onExpand: () => void;
  label: string;
};

/** Collapsed sidebar strip — click to show panel again */
export const EditorSidebarRail: React.FC<EditorSidebarRailProps> = ({ side, onExpand, label }) => (
  <div
    className={`shrink-0 flex flex-col items-center py-3 gap-2 bg-[#f6f6f7] border-[#e3e3e5] ${
      side === 'left' ? 'border-r w-10' : 'border-l w-10'
    }`}
  >
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-[#616161]"
      onClick={onExpand}
      title={`Show ${label}`}
    >
      {side === 'left' ? <PanelLeft className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </Button>
    <span
      className="text-[10px] font-medium text-[#616161] uppercase tracking-wide"
      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
    >
      {label}
    </span>
  </div>
);
