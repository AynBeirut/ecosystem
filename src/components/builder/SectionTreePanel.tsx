import React, { useMemo, useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SECTION_LABELS, reorderSections, toggleSectionEnabled } from '@/lib/storeSectionDefaults';
import {
  EDITOR_CHROME_LABELS,
  EDITOR_CHROME_ORDER,
  type EditorSelectableId,
} from '@/lib/editorPreviewBridge';
import { SECTION_ZONE_LABELS, SECTION_ZONE_MAP, ZONE_ORDER, type SectionZoneId } from '@/lib/sectionZones';
import type { StoreSectionId, StoreSectionOrder } from '@/types/storeProfile';

type SectionTreePanelProps = {
  sections: StoreSectionOrder[];
  selectedId: EditorSelectableId | null;
  onSelect: (id: EditorSelectableId) => void;
  onChange: (sections: StoreSectionOrder[]) => void;
  /** Hide chrome rows (store header / nav) — custom layout page only lists homepage sections */
  homepageSectionsOnly?: boolean;
  footerHint?: React.ReactNode;
};

const SectionTreePanel: React.FC<SectionTreePanelProps> = ({
  sections,
  selectedId,
  onSelect,
  onChange,
  homepageSectionsOnly = false,
  footerHint,
}) => {
  const [draggingId, setDraggingId] = useState<StoreSectionId | null>(null);

  const sorted = useMemo(
    () => [...sections].sort((a, b) => a.order - b.order),
    [sections],
  );

  const byZone = useMemo(() => {
    const map: Record<SectionZoneId, StoreSectionOrder[]> = {
      header: [],
      template: [],
      footer: [],
    };
    for (const section of sorted) {
      map[SECTION_ZONE_MAP[section.id]].push(section);
    }
    return map;
  }, [sorted]);

  const handleDrop = (targetId: StoreSectionId) => {
    if (!draggingId) return;
    onChange(reorderSections(sections, draggingId, targetId));
    setDraggingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#f6f6f7] border-r border-[#e3e3e5]">
      <div className="px-3 py-2.5 border-b border-[#e3e3e5] bg-white">
        <p className="text-xs font-semibold text-[#303030]">Home page</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {ZONE_ORDER.map((zone) => (
          <div key={zone}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#616161] px-2 mb-1">
              {SECTION_ZONE_LABELS[zone]}
            </p>
            <ul className="space-y-0.5">
              {zone === 'header' && !homepageSectionsOnly &&
                EDITOR_CHROME_ORDER.map((chromeId) => (
                  <li key={chromeId}>
                    <button
                      type="button"
                      onClick={() => onSelect(chromeId)}
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        selectedId === chromeId
                          ? 'bg-[#303030] text-white'
                          : 'bg-white hover:bg-[#ededed] text-[#303030] border border-transparent'
                      }`}
                    >
                      <span className="w-4 shrink-0" />
                      <span className="flex-1 truncate">{EDITOR_CHROME_LABELS[chromeId]}</span>
                    </button>
                  </li>
                ))}
              {byZone[zone].map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={() => setDraggingId(section.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(section.id);
                    }}
                    onClick={() => onSelect(section.id)}
                    className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                      selectedId === section.id
                        ? 'bg-[#303030] text-white'
                        : 'bg-white hover:bg-[#ededed] text-[#303030] border border-transparent'
                    } ${!section.enabled ? 'opacity-45' : ''}`}
                  >
                    <GripVertical className="h-4 w-4 shrink-0 opacity-50 cursor-grab" />
                    <span className="flex-1 truncate">{SECTION_LABELS[section.id]}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full mt-1 h-8 text-xs text-[#616161] justify-start gap-1.5 hover:bg-white"
              onClick={() => {
                const hidden = byZone[zone].find((s) => !s.enabled);
                if (hidden) {
                  onChange(toggleSectionEnabled(sections, hidden.id, true));
                  onSelect(hidden.id);
                }
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add section
            </Button>
          </div>
        ))}
      </div>
      {footerHint !== null && (
        <div className="p-2 border-t border-[#e3e3e5] bg-white">
          {footerHint ?? (
            <p className="text-[10px] text-[#616161] px-1">
              Section styling:{' '}
              <a href="/admin/theme-editor" className="text-[#005bd3] underline">
                Theme Editor
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SectionTreePanel;
