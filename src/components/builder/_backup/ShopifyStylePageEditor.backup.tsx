import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GripVertical,
  Eye,
  EyeOff,
  LayoutTemplate,
  Monitor,
  PanelLeft,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  SECTION_DESCRIPTIONS,
  SECTION_LABELS,
  reorderSections,
  toggleSectionEnabled,
  updateSection,
} from '@/lib/storeSectionDefaults';
import type { StoreSectionId, StoreSectionOrder } from '@/types/storeProfile';

type ShopifyStylePageEditorProps = {
  storeName?: string;
  sectionOrder: StoreSectionOrder[];
  onChange: (sections: StoreSectionOrder[]) => void;
  onSave?: () => void | Promise<void>;
  saving?: boolean;
};

function SectionCanvasPreview({ id }: { id: StoreSectionId }) {
  const base = 'rounded-md overflow-hidden border border-slate-200/80';
  switch (id) {
    case 'hero':
      return (
        <div className={`${base} h-28 bg-gradient-to-br from-slate-800 to-slate-600 flex items-end p-3`}>
          <div className="space-y-1">
            <div className="h-2 w-24 rounded bg-white/90" />
            <div className="h-1.5 w-16 rounded bg-white/50" />
          </div>
        </div>
      );
    case 'about':
      return (
        <div className={`${base} h-20 bg-white p-3 flex gap-2`}>
          <div className="w-1/3 rounded bg-slate-100" />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="h-1.5 w-full rounded bg-slate-200" />
            <div className="h-1.5 w-4/5 rounded bg-slate-100" />
            <div className="h-1.5 w-3/5 rounded bg-slate-100" />
          </div>
        </div>
      );
    case 'announcements':
      return (
        <div className={`${base} h-14 bg-amber-50 p-2 flex items-center gap-2`}>
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <div className="h-1.5 flex-1 rounded bg-amber-200/80" />
        </div>
      );
    case 'products':
      return (
        <div className={`${base} h-24 bg-white p-2 grid grid-cols-3 gap-1.5`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded bg-slate-100 p-1 space-y-1">
              <div className="aspect-square rounded bg-slate-200" />
              <div className="h-1 w-2/3 mx-auto rounded bg-slate-300" />
            </div>
          ))}
        </div>
      );
    case 'gallery':
      return (
        <div className={`${base} h-20 bg-white p-2 grid grid-cols-4 gap-1`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded bg-slate-200 aspect-square" />
          ))}
        </div>
      );
    case 'reviews':
      return (
        <div className={`${base} h-16 bg-white p-2 space-y-1.5`}>
          <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-1.5 w-1.5 rounded-full bg-yellow-400" />)}</div>
          <div className="h-1.5 w-full rounded bg-slate-100" />
          <div className="h-1.5 w-2/3 rounded bg-slate-100" />
        </div>
      );
    case 'contact':
      return (
        <div className={`${base} h-20 bg-white p-2 space-y-1.5`}>
          <div className="h-4 rounded border border-slate-200 bg-slate-50" />
          <div className="h-4 rounded border border-slate-200 bg-slate-50" />
          <div className="h-5 w-1/3 rounded bg-slate-800" />
        </div>
      );
    default:
      return <div className={`${base} h-12 bg-slate-100`} />;
  }
}

const ShopifyStylePageEditor: React.FC<ShopifyStylePageEditorProps> = ({
  storeName = 'Your store',
  sectionOrder,
  onChange,
  onSave,
  saving,
}) => {
  const [selectedId, setSelectedId] = useState<StoreSectionId>('hero');
  const [draggingId, setDraggingId] = useState<StoreSectionId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<StoreSectionId | null>(null);

  const sorted = useMemo(
    () => [...sectionOrder].sort((a, b) => a.order - b.order),
    [sectionOrder],
  );

  const selected = sorted.find((s) => s.id === selectedId) ?? sorted[0];

  const handleDrop = (targetId: StoreSectionId) => {
    if (!draggingId) return;
    onChange(reorderSections(sectionOrder, draggingId, targetId));
    setDraggingId(null);
    setDropTargetId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles className="h-5 w-5 text-violet-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Shopify-style editor (prototype)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare this flow with the classic editor in{' '}
              <Link to="/admin/templates" className="text-primary underline font-medium">
                Templates → Sections
              </Link>
              . Both save to the same storefront data.
            </p>
          </div>
        </div>
        {onSave && (
          <Button size="sm" onClick={() => void onSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save layout'}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px] min-h-[520px] rounded-xl border bg-slate-50/80 overflow-hidden">
        {/* Left — section list (Shopify sidebar) */}
        <aside className="border-b lg:border-b-0 lg:border-r bg-white p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
            <PanelLeft className="h-3.5 w-3.5" />
            Sections
          </div>
          <ul className="space-y-1">
            {sorted.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDraggingId(section.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTargetId(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTargetId(section.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(section.id);
                  }}
                  onClick={() => setSelectedId(section.id)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    selectedId === section.id
                      ? 'bg-slate-900 text-white'
                      : 'hover:bg-slate-100 text-slate-800'
                  } ${!section.enabled ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="h-4 w-4 shrink-0 opacity-60 cursor-grab active:cursor-grabbing" />
                  <span className="flex-1 truncate">{SECTION_LABELS[section.id]}</span>
                  {!section.enabled && <EyeOff className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Center — visual page canvas */}
        <div className="p-4 flex flex-col min-h-[320px]">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-3">
            <Monitor className="h-3.5 w-3.5" />
            Homepage preview — drag blocks to reorder
          </div>
          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-md rounded-xl border-2 border-slate-200 bg-white shadow-xl overflow-hidden">
              <div className="h-8 bg-slate-100 border-b flex items-center px-3 gap-1.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <span className="text-[10px] text-slate-500 truncate flex-1 text-center">{storeName}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[360px] bg-slate-50/50">
                {sorted.filter((s) => s.enabled).map((section) => (
                  <div
                    key={section.id}
                    draggable
                    onDragStart={() => setDraggingId(section.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTargetId(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTargetId(section.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(section.id);
                    }}
                    onClick={() => setSelectedId(section.id)}
                    className={`relative rounded-lg transition-all cursor-pointer group ${
                      selectedId === section.id
                        ? 'ring-2 ring-violet-500 ring-offset-2'
                        : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1'
                    } ${draggingId === section.id ? 'opacity-40' : ''}`}
                  >
                    {dropTargetId === section.id && draggingId && draggingId !== section.id && (
                      <div className="absolute -top-1 left-0 right-0 h-0.5 bg-violet-500 z-10" />
                    )}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 gap-1">
                        <GripVertical className="h-3 w-3" />
                        {SECTION_LABELS[section.id]}
                      </Badge>
                    </div>
                    <SectionCanvasPreview id={section.id} />
                  </div>
                ))}
                {sorted.every((s) => !s.enabled) && (
                  <p className="text-center text-sm text-muted-foreground py-12">Enable a section from the sidebar</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right — section settings panel */}
        <aside className="border-t lg:border-t-0 lg:border-l bg-white p-4 space-y-4">
          {selected ? (
            <>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">{SECTION_LABELS[selected.id]}</h3>
                </div>
                <p className="text-xs text-muted-foreground">{SECTION_DESCRIPTIONS[selected.id]}</p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="section-visible" className="text-sm flex items-center gap-2">
                  {selected.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  Visible on store
                </Label>
                <Switch
                  id="section-visible"
                  checked={selected.enabled}
                  onCheckedChange={(on) =>
                    onChange(toggleSectionEnabled(sectionOrder, selected.id, on))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Container width</Label>
                <Select
                  value={selected.container ?? 'contained'}
                  onValueChange={(v) =>
                    onChange(
                      updateSection(sectionOrder, selected.id, {
                        container: v as StoreSectionOrder['container'],
                      }),
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-width">Full width</SelectItem>
                    <SelectItem value="contained">Contained</SelectItem>
                    <SelectItem value="wide">Wide</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Padding</Label>
                <Select
                  value={selected.padding ?? 'medium'}
                  onValueChange={(v) =>
                    onChange(
                      updateSection(sectionOrder, selected.id, {
                        padding: v as StoreSectionOrder['padding'],
                      }),
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Entrance animation</Label>
                <Select
                  value={selected.animation ?? 'fade'}
                  onValueChange={(v) =>
                    onChange(
                      updateSection(sectionOrder, selected.id, {
                        animation: v as StoreSectionOrder['animation'],
                      }),
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="fade">Fade</SelectItem>
                    <SelectItem value="slide-up">Slide up</SelectItem>
                    <SelectItem value="zoom">Zoom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="section-borders" className="text-sm">Rounded borders</Label>
                <Switch
                  id="section-borders"
                  checked={selected.showBorders ?? true}
                  onCheckedChange={(on) =>
                    onChange(updateSection(sectionOrder, selected.id, { showBorders: on }))
                  }
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a section to edit</p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ShopifyStylePageEditor;
