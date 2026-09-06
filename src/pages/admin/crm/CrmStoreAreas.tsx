import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { CRM_LEBANON_GOVERNORATE_NAMES } from '@/lib/crmLebanonLocations';
import {
  createCrmStoreArea,
  crmBuiltInAreaSuggestions,
  deleteCrmStoreArea,
  fetchCrmStoreAreas,
  updateCrmStoreArea,
  type CrmStoreArea,
} from '@/lib/crmStoreAreaService';
import { useToast } from '@/hooks/use-toast';

export default function CrmStoreAreas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const storeId = getActualStoreId(user);
  const [district, setDistrict] = useState('Beirut');
  const [customAreas, setCustomAreas] = useState<CrmStoreArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<CrmStoreArea | null>(null);
  const [areaName, setAreaName] = useState('');
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    const have = new Set(customAreas.map((a) => a.name.toLowerCase()));
    return crmBuiltInAreaSuggestions(district).filter((name) => !have.has(name.toLowerCase()));
  }, [district, customAreas]);

  const loadAreas = useCallback(async () => {
    if (!storeId || !district) {
      setCustomAreas([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      setCustomAreas(await fetchCrmStoreAreas(storeId, district));
    } catch (e) {
      setCustomAreas([]);
      setLoadError(e instanceof Error ? e.message : 'Could not load areas');
    } finally {
      setLoading(false);
    }
  }, [storeId, district]);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  const openAdd = (prefill = '') => {
    setEditingArea(null);
    setAreaName(prefill);
    setDialogOpen(true);
  };

  const openEdit = (row: CrmStoreArea) => {
    setEditingArea(row);
    setAreaName(row.name);
    setDialogOpen(true);
  };

  const saveArea = async () => {
    if (!storeId || !user?.id) return;
    const name = areaName.trim();
    if (!name) {
      toast({ title: 'Area name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingArea) {
        await updateCrmStoreArea(editingArea.id, { storeId, district, name });
        toast({ title: 'Area updated' });
      } else {
        await createCrmStoreArea({ storeId, district, name, createdBy: user.id });
        toast({ title: 'Area added' });
      }
      setDialogOpen(false);
      await loadAreas();
    } catch (e) {
      toast({
        title: 'Could not save area',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const removeArea = async (row: CrmStoreArea) => {
    if (!window.confirm(`Delete "${row.name}" from ${district}? Existing clients keep the old name until you edit them.`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteCrmStoreArea(row.id);
      toast({ title: 'Area deleted' });
      await loadAreas();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const quickAddSuggestion = async (baseName: string) => {
    openAdd(`${baseName} 1`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold">Store areas</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your area list</CardTitle>
          <CardDescription>
            You control the Area field on every client. Add names like <strong>Achrafieh 1</strong> and{' '}
            <strong>Achrafieh 2</strong>, rename anytime, or delete. Once you add areas here, only your list
            is used in forms (not the Lebanon default list).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label>Governorate</Label>
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_LEBANON_GOVERNORATE_NAMES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Areas · {district}</p>
            <Button type="button" size="sm" onClick={() => openAdd()} disabled={!storeId || saving}>
              <Plus className="h-4 w-4 mr-1" />
              Add area
            </Button>
          </div>

          {loadError ? (
            <Button variant="outline" size="sm" onClick={() => void loadAreas()}>
              {loadError} — Retry
            </Button>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : customAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No store areas yet — client forms still use the Lebanon default list. Add your own below or
              import a suggestion.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {customAreas.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-medium">{row.name}</span>
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(row)} disabled={saving}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => void removeArea(row)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {suggestions.length > 0 ? (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Quick start — import from Lebanon list (rename to Achrafieh 1, 2, … before saving)
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 12).map((name) => (
                  <Button
                    key={name}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void quickAddSuggestion(name)}
                  >
                    + {name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingArea ? 'Rename area' : 'New area'} · {district}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Area name</Label>
            <Input
              className="mt-1"
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder="e.g. Achrafieh 1"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2">
              Use any name — split zones like Achrafieh 1 / Achrafieh 2 for your team.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveArea()} disabled={saving}>
              {saving ? 'Saving…' : editingArea ? 'Save changes' : 'Save area'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
