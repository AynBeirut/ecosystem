import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CRM_LEBANON_GOVERNORATE_NAMES,
  CRM_LOCATION_COUNTRIES,
  crmAreasForGovernorate,
  type CrmLocationSelection,
} from '@/lib/crmLebanonLocations';
import {
  createCrmStoreArea,
  deleteCrmStoreArea,
  fetchCrmStoreAreas,
  mergeCrmAreaOptions,
  updateCrmStoreArea,
  type CrmStoreArea,
} from '@/lib/crmStoreAreaService';
import { useToast } from '@/hooks/use-toast';

type Props = {
  value: CrmLocationSelection;
  onChange: (next: CrmLocationSelection) => void;
  required?: boolean;
  className?: string;
  storeId?: string;
  userId?: string;
  canManageAreas?: boolean;
};

export default function CrmLocationSelects({
  value,
  onChange,
  required,
  className,
  storeId,
  userId,
  canManageAreas = false,
}: Props) {
  const { toast } = useToast();
  const [customAreas, setCustomAreas] = useState<CrmStoreArea[]>([]);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<CrmStoreArea | null>(null);
  const [areaName, setAreaName] = useState('');

  const loadAreas = useCallback(async () => {
    if (!storeId || !value.district) {
      setCustomAreas([]);
      return;
    }
    setCustomAreas(await fetchCrmStoreAreas(storeId, value.district));
  }, [storeId, value.district]);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  const areaOptions = useMemo(
    () => mergeCrmAreaOptions(value.district, customAreas),
    [value.district, customAreas],
  );

  const openAddArea = () => {
    setEditingArea(null);
    setAreaName('');
    setAreaDialogOpen(true);
  };

  const openEditArea = (row: CrmStoreArea) => {
    setEditingArea(row);
    setAreaName(row.name);
    setAreaDialogOpen(true);
  };

  const saveArea = async () => {
    if (!storeId || !userId || !value.district) return;
    const name = areaName.trim();
    if (!name) {
      toast({ title: 'Area name required', variant: 'destructive' });
      return;
    }
    try {
      if (editingArea) {
        await updateCrmStoreArea(editingArea.id, { storeId, district: value.district, name });
        toast({ title: 'Area updated' });
      } else {
        await createCrmStoreArea({ storeId, district: value.district, name, createdBy: userId });
        toast({ title: 'Area added' });
      }
      setAreaDialogOpen(false);
      await loadAreas();
      if (!editingArea) onChange({ ...value, area: name });
    } catch (e) {
      toast({
        title: 'Could not save area',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const removeArea = async (row: CrmStoreArea) => {
    if (!window.confirm(`Delete custom area "${row.name}"?`)) return;
    try {
      await deleteCrmStoreArea(row.id);
      toast({ title: 'Area deleted' });
      if (value.area === row.name) onChange({ ...value, area: '' });
      await loadAreas();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={className}>
      <p className="text-sm font-semibold text-slate-800 mb-2">Location</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Country{required ? ' *' : ''}</Label>
          <Select
            value={value.country || 'none'}
            onValueChange={(v) =>
              onChange({
                country: v === 'none' ? '' : v,
                district: '',
                area: '',
              })
            }
          >
            <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {CRM_LOCATION_COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Governorate{required ? ' *' : ''}</Label>
          <Select
            value={value.district || 'none'}
            onValueChange={(v) =>
              onChange({
                ...value,
                district: v === 'none' ? '' : v,
                area: '',
              })
            }
            disabled={!value.country}
          >
            <SelectTrigger><SelectValue placeholder="e.g. Mount Lebanon" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {CRM_LEBANON_GOVERNORATE_NAMES.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Area{required ? ' *' : ''}</Label>
          <Select
            value={value.area || 'none'}
            onValueChange={(v) => onChange({ ...value, area: v === 'none' ? '' : v })}
            disabled={!value.district}
          >
            <SelectTrigger><SelectValue placeholder="e.g. Hamana" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {areaOptions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {canManageAreas && storeId && value.district ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {customAreas.length > 0
                ? `Your store areas for ${value.district} — edit in CRM → Areas`
                : `Add areas in CRM → Areas (e.g. Achrafieh 1, Achrafieh 2)`}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={openAddArea}>
              <Plus className="h-3 w-3 mr-1" />
              Add area
            </Button>
          </div>
          {customAreas.length > 0 ? (
            <ul className="text-sm divide-y rounded-md border">
              {customAreas.map((row) => (
                <li key={row.id} className="flex items-center justify-between px-3 py-2">
                  <span>{row.name}</span>
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" onClick={() => openEditArea(row)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeArea(row)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No custom areas yet.</p>
          )}
        </div>
      ) : null}

      <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingArea ? 'Edit area' : 'Add custom area'}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Name</Label>
            <Input value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder="e.g. Achrafieh 1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreaDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveArea}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
