import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { VENUE_ALLERGEN_COLUMNS, venueOpsDashboardCounts, type VenueAllergenStatus, type VenueBriefingStatus, type VenueSpecKind, type VenueSpecLine, type VenueStandardKind } from '@/lib/venueOpsCore';
import {
  saveVenueFloor,
  saveVenueStandard,
  loadVenueOps,
  saveVenueAllergen,
  saveVenueBible,
  saveVenueBriefing,
  saveVenueSpec,
  type VenueBriefingPeriod,
  type VenueOpsBundle,
  type VenueStandardStatus,
} from '@/lib/venueOpsCoreService';

const emptyBundle: VenueOpsBundle = { knowledge: [], briefings: [], floor: [], standards: [] };

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-slate-800">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function useVenueOpsData(storeId: string | null) {
  const [bundle, setBundle] = useState<VenueOpsBundle>(emptyBundle);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!storeId) return;
    try {
      setBundle(await loadVenueOps(storeId));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load venue operations.');
    }
  }, [storeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { bundle, error, reload };
}

function BridgeLinks({ links }: { links: { to: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <p className="flex flex-wrap gap-3">
      {links.map((link) => (
        <Link key={link.to} to={link.to} className="font-medium text-teal-800 underline">{link.label}</Link>
      ))}
    </p>
  );
}

function ReadOnlyNote({ canEdit }: { canEdit: boolean }) {
  if (canEdit) return null;
  return <p>View only. A manager edits these records and the venue setup.</p>;
}

function RowList({
  rows,
  empty,
  onEdit,
}: {
  rows: { id: string; title: string; extra?: string }[];
  empty: string;
  onEdit?: (id: string) => void;
}) {
  return (
    <ul className="divide-y rounded-lg border bg-white">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span>
            <span className="font-medium">{row.title}</span>
            {row.extra ? <span className="text-slate-500"> · {row.extra}</span> : null}
          </span>
          {onEdit ? (
            <Button type="button" variant="outline" onClick={() => onEdit(row.id)}>Edit</Button>
          ) : null}
        </li>
      ))}
      {rows.length === 0 ? <li className="px-3 py-2 text-slate-500">{empty}</li> : null}
    </ul>
  );
}

export function VenueOverview({
  bundle,
}: {
  bundle: VenueOpsBundle;
}) {
  const counts = venueOpsDashboardCounts(bundle);
  const cards = [
    { label: 'Allergen items', value: counts.allergens, to: '/admin/venue-ops/allergens' },
    { label: 'Bible cards', value: counts.bible, to: '/admin/venue-ops/bible' },
    { label: 'Specs', value: counts.specs, to: '/admin/venue-ops/specs' },
    { label: 'Briefings', value: counts.briefings, to: '/admin/venue-ops/briefings' },
    { label: 'Floor', value: counts.floor, to: '/admin/venue-ops/floor' },
    { label: 'Standards', value: counts.standards, to: '/admin/venue-ops/standards' },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} to={card.to} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function VenueAllergens({
  storeId,
  bundle,
  canEdit,
  onSaved,
}: {
  storeId: string;
  bundle: VenueOpsBundle;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [presentAllergens, setPresentAllergens] = useState<string[]>([]);
  const [crossMarked, setCrossMarked] = useState(false);
  const [crossNote, setCrossNote] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [status, setStatus] = useState<VenueAllergenStatus>('draft');
  const [saving, setSaving] = useState(false);
  const rows = bundle.knowledge.filter((row) => row.kind === 'allergen');

  const clear = () => {
    setEditingId(null);
    setTitle('');
    setCategory('');
    setPresentAllergens([]);
    setCrossMarked(false);
    setCrossNote('');
    setReviewDate('');
    setReviewer('');
    setStatus('draft');
  };

  const toggleAllergen = (name: string) => {
    setPresentAllergens((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  };

  const save = async () => {
    setSaving(true);
    const updating = Boolean(editingId);
    try {
      await saveVenueAllergen(editingId, {
        storeId,
        title,
        category,
        presentAllergens,
        crossContamination: crossMarked,
        crossContaminationNote: crossNote,
        reviewDate,
        reviewer,
        status,
      });
      clear();
      await onSaved();
      toast({ title: updating ? 'Allergen item updated' : 'Allergen item saved' });
    } catch (err) {
      toast({ title: 'Could not save allergen item', description: err instanceof Error ? err.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <ReadOnlyNote canEdit={canEdit} />
      {canEdit ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Dish" value={title} onChange={setTitle} />
            <Field label="Category" value={category} onChange={setCategory} />
            <div className="sm:col-span-2 space-y-2">
              <p className="text-sm font-medium text-slate-800">Allergen columns</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {VENUE_ALLERGEN_COLUMNS.map((name) => (
                  <label key={name} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={presentAllergens.includes(name)} onChange={() => toggleAllergen(name)} />
                    {name}
                  </label>
                ))}
              </div>
              <p className="text-sm text-slate-600">Nuts includes brazil nuts, hazelnuts, almonds, and walnuts.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input type="checkbox" checked={crossMarked} onChange={(event) => setCrossMarked(event.target.checked)} />
              Cross-contamination marker
            </label>
            <Field label="Cross-contamination note" value={crossNote} onChange={setCrossNote} />
            <Field label="Review date" value={reviewDate} onChange={setReviewDate} type="date" />
            <Field label="Chef / approver" value={reviewer} onChange={setReviewer} />
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-800">Status</span>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as VenueAllergenStatus)}>
                <option value="draft">Draft</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving || !title.trim()}>{editingId ? 'Save allergen item' : 'Add allergen item'}</Button>
            {editingId ? <Button type="button" variant="outline" onClick={clear}>Cancel</Button> : null}
          </div>
        </>
      ) : null}
      <RowList
        empty="No allergen items yet."
        onEdit={canEdit ? (id) => {
          const row = rows.find((item) => item.id === id);
          if (!row) return;
          setEditingId(row.id);
          setTitle(row.title);
          setCategory(row.category);
          setPresentAllergens(row.presentAllergens);
          setCrossMarked(row.crossContamination);
          setCrossNote(row.crossContaminationNote);
          setReviewDate(row.reviewDate);
          setReviewer(row.reviewer);
          setStatus(row.status === 'reviewed' ? 'reviewed' : 'draft');
        } : undefined}
        rows={rows.map((row) => ({
          id: row.id,
          title: row.title,
          extra: [row.allergens, row.crossContamination ? 'Cross-contamination' : '', row.reviewDate, row.reviewer].filter(Boolean).join(' · '),
        }))}
      />
    </div>
  );
}

export function VenueBible({
  storeId,
  bundle,
  canEdit,
  onSaved,
}: {
  storeId: string;
  bundle: VenueOpsBundle;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [meaning, setMeaning] = useState('');
  const [description, setDescription] = useState('');
  const [buzzWords, setBuzzWords] = useState('');
  const [oneLiner, setOneLiner] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [allergens, setAllergens] = useState('');
  const [saving, setSaving] = useState(false);
  const rows = bundle.knowledge.filter((row) => row.kind === 'bible');

  const clear = () => {
    setEditingId(null);
    setTitle('');
    setCategory('');
    setIngredients('');
    setMeaning('');
    setDescription('');
    setBuzzWords('');
    setOneLiner('');
    setServiceNotes('');
    setAllergens('');
  };

  const save = async () => {
    setSaving(true);
    const updating = Boolean(editingId);
    try {
      await saveVenueBible(editingId, { storeId, title, category, ingredients, meaning, description, buzzWords, oneLiner, serviceNotes, allergens });
      clear();
      await onSaved();
      toast({ title: updating ? 'Menu card updated' : 'Menu card saved' });
    } catch (err) {
      toast({ title: 'Could not save menu card', description: err instanceof Error ? err.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <ReadOnlyNote canEdit={canEdit} />
      {canEdit ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Item" value={title} onChange={setTitle} />
            <Field label="Category" value={category} onChange={setCategory} />
            <Field label="Buzz words" value={buzzWords} onChange={setBuzzWords} />
            <Field label="One-liner" value={oneLiner} onChange={setOneLiner} />
            <Field label="Meaning" value={meaning} onChange={setMeaning} />
            <Field label="Description" value={description} onChange={setDescription} />
            <Field label="Ingredients" value={ingredients} onChange={setIngredients} />
            <Field label="Allergens" value={allergens} onChange={setAllergens} />
            <Field label="Service notes" value={serviceNotes} onChange={setServiceNotes} />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving || !title.trim()}>{editingId ? 'Save menu card' : 'Add menu card'}</Button>
            {editingId ? <Button type="button" variant="outline" onClick={clear}>Cancel</Button> : null}
          </div>
        </>
      ) : null}
      <RowList
        empty="No menu cards yet."
        onEdit={canEdit ? (id) => {
          const row = rows.find((item) => item.id === id);
          if (!row) return;
          setEditingId(row.id);
          setTitle(row.title);
          setCategory(row.category);
          setIngredients(row.ingredients);
          setMeaning(row.meaning);
          setDescription(row.description);
          setBuzzWords(row.buzzWords);
          setOneLiner(row.oneLiner);
          setServiceNotes(row.serviceNotes);
          setAllergens(row.allergens);
        } : undefined}
        rows={rows.map((row) => ({ id: row.id, title: row.title, extra: [row.category, row.buzzWords, row.oneLiner, row.meaning].filter(Boolean).join(' · ') }))}
      />
    </div>
  );
}

export function VenueSpecs({
  storeId,
  bundle,
  canEdit,
  bridgeLinks,
  onSaved,
}: {
  storeId: string;
  bundle: VenueOpsBundle;
  canEdit: boolean;
  bridgeLinks: { to: string; label: string }[];
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [specKind, setSpecKind] = useState<VenueSpecKind>('cocktail');
  const [glassware, setGlassware] = useState('');
  const [vessel, setVessel] = useState('');
  const [lines, setLines] = useState<VenueSpecLine[]>([{ item: '', quantity: '', unit: '' }]);
  const [garnish, setGarnish] = useState('');
  const [method, setMethod] = useState('');
  const [par, setPar] = useState('');
  const [batchQuantity, setBatchQuantity] = useState('');
  const [shelfLife, setShelfLife] = useState('');
  const [saving, setSaving] = useState(false);
  const rows = bundle.knowledge.filter((row) => row.kind === 'spec');

  const clear = () => {
    setEditingId(null);
    setTitle('');
    setSpecKind('cocktail');
    setGlassware('');
    setVessel('');
    setLines([{ item: '', quantity: '', unit: '' }]);
    setGarnish('');
    setMethod('');
    setPar('');
    setBatchQuantity('');
    setShelfLife('');
  };

  const save = async () => {
    setSaving(true);
    const updating = Boolean(editingId);
    try {
      await saveVenueSpec(editingId, { storeId, title, specKind, glassware, vessel, lines, garnish, method, par, batchQuantity, shelfLife });
      clear();
      await onSaved();
      toast({ title: updating ? 'Spec updated' : 'Spec saved' });
    } catch (err) {
      toast({ title: 'Could not save spec', description: err instanceof Error ? err.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <ReadOnlyNote canEdit={canEdit} />
      <BridgeLinks links={bridgeLinks} />
      {canEdit ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-800">Cocktail or batch</span>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={specKind} onChange={(event) => setSpecKind(event.target.value as VenueSpecKind)}>
                <option value="cocktail">Cocktail</option>
                <option value="batch">Batch</option>
              </select>
            </label>
            <Field label="Name" value={title} onChange={setTitle} />
            <Field label="Glassware" value={glassware} onChange={setGlassware} />
            <Field label="Storage vessel" value={vessel} onChange={setVessel} />
            <Field label="Garnish" value={garnish} onChange={setGarnish} />
            <Field label="Method" value={method} onChange={setMethod} />
            <Field label="Par" value={par} onChange={setPar} />
            <Field label="Batch quantity" value={batchQuantity} onChange={setBatchQuantity} />
            <Field label="Shelf life" value={shelfLife} onChange={setShelfLife} />
          </div>
          {lines.map((line, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-3">
              <Field label="Ingredient" value={line.item} onChange={(value) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, item: value } : row))} />
              <Field label="Quantity" value={line.quantity} onChange={(value) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: value } : row))} />
              <Field label="Unit" value={line.unit} onChange={(value) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unit: value } : row))} />
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, { item: '', quantity: '', unit: '' }])}>Add ingredient line</Button>
            <Button type="button" onClick={() => void save()} disabled={saving || !title.trim()}>{editingId ? 'Save spec' : 'Add spec'}</Button>
            {editingId ? <Button type="button" variant="outline" onClick={clear}>Cancel</Button> : null}
          </div>
        </>
      ) : null}
      <RowList
        empty="No specs yet."
        onEdit={canEdit ? (id) => {
          const row = rows.find((item) => item.id === id);
          if (!row) return;
          setEditingId(row.id);
          setTitle(row.title);
          setSpecKind(row.specKind === 'batch' ? 'batch' : 'cocktail');
          setGlassware(row.glassware);
          setVessel(row.vessel);
          setLines(row.lines.length ? row.lines : [{ item: '', quantity: '', unit: '' }]);
          setGarnish(row.garnish);
          setMethod(row.method);
          setPar(row.par);
          setBatchQuantity(row.batchQuantity);
          setShelfLife(row.shelfLife);
        } : undefined}
        rows={rows.map((row) => ({ id: row.id, title: row.title, extra: [row.specKind === 'batch' ? 'Batch' : 'Cocktail', row.glassware || row.vessel, row.par, row.shelfLife].filter(Boolean).join(' · ') }))}
      />
    </div>
  );
}

export function VenueBriefings({
  storeId,
  bundle,
  canEdit,
  hrLinks,
  onSaved,
}: {
  storeId: string;
  bundle: VenueOpsBundle;
  canEdit: boolean;
  hrLinks: { to: string; label: string }[];
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [period, setPeriod] = useState<VenueBriefingPeriod>('daily');
  const [briefingDate, setBriefingDate] = useState('');
  const [foodFocus, setFoodFocus] = useState('');
  const [beverageFocus, setBeverageFocus] = useState('');
  const [buzzWords, setBuzzWords] = useState('');
  const [drinkBuzzWords, setDrinkBuzzWords] = useState('');
  const [oneLiner, setOneLiner] = useState('');
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<VenueBriefingStatus>('draft');
  const [saving, setSaving] = useState(false);
  const foodItems = bundle.knowledge.filter((row) => row.kind === 'bible').map((row) => row.title);
  const drinkItems = bundle.knowledge.filter((row) => row.kind === 'spec').map((row) => row.title);

  const clear = () => {
    setEditingId(null);
    setPeriod('daily');
    setBriefingDate('');
    setFoodFocus('');
    setBeverageFocus('');
    setBuzzWords('');
    setDrinkBuzzWords('');
    setOneLiner('');
    setPrompt('');
    setStatus('draft');
  };

  const save = async () => {
    setSaving(true);
    const updating = Boolean(editingId);
    try {
      await saveVenueBriefing(editingId, { storeId, period, briefingDate, foodFocus, beverageFocus, buzzWords, drinkBuzzWords, oneLiner, prompt, status });
      clear();
      await onSaved();
      toast({ title: updating ? 'Briefing updated' : 'Briefing saved' });
    } catch (err) {
      toast({ title: 'Could not save briefing', description: err instanceof Error ? err.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <ReadOnlyNote canEdit={canEdit} />
      <BridgeLinks links={hrLinks} />
      {canEdit ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-800">Period</span>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={period} onChange={(event) => setPeriod(event.target.value as VenueBriefingPeriod)}>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-800">Date</span>
              <Input type="date" value={briefingDate} onChange={(event) => setBriefingDate(event.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-800">Food focus</span>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={foodFocus} onChange={(event) => setFoodFocus(event.target.value)}>
                <option value="">Select a menu card</option>
                {foodFocus && !foodItems.includes(foodFocus) ? <option value={foodFocus}>{foodFocus}</option> : null}
                {foodItems.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-800">Beverage focus</span>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={beverageFocus} onChange={(event) => setBeverageFocus(event.target.value)}>
                <option value="">Select a spec</option>
                {beverageFocus && !drinkItems.includes(beverageFocus) ? <option value={beverageFocus}>{beverageFocus}</option> : null}
                {drinkItems.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <Field label="Food buzz words" value={buzzWords} onChange={setBuzzWords} />
            <Field label="One-liner" value={oneLiner} onChange={setOneLiner} />
            <Field label="Beverage buzz words" value={drinkBuzzWords} onChange={setDrinkBuzzWords} />
            <Field label="Staff talking points" value={prompt} onChange={setPrompt} />
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-800">Status</span>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as VenueBriefingStatus)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving || !briefingDate}>{editingId ? 'Save briefing' : 'Add briefing'}</Button>
            {editingId ? <Button type="button" variant="outline" onClick={clear}>Cancel</Button> : null}
          </div>
        </>
      ) : null}
      <RowList
        empty="No briefings yet."
        onEdit={canEdit ? (id) => {
          const row = bundle.briefings.find((item) => item.id === id);
          if (!row) return;
          setEditingId(row.id);
          setPeriod(row.period === 'monthly' ? 'monthly' : 'daily');
          setBriefingDate(row.briefingDate);
          setFoodFocus(row.foodFocus);
          setBeverageFocus(row.beverageFocus);
          setBuzzWords(row.buzzWords);
          setDrinkBuzzWords(row.drinkBuzzWords);
          setOneLiner(row.oneLiner);
          setPrompt(row.prompt);
          setStatus(row.status === 'published' ? 'published' : 'draft');
        } : undefined}
        rows={bundle.briefings.map((row) => ({
          id: row.id,
          title: row.title,
          extra: [row.briefingDate, row.foodFocus, row.buzzWords, row.oneLiner, row.beverageFocus, row.drinkBuzzWords].filter(Boolean).join(' · '),
        }))}
      />
    </div>
  );
}

export function VenueFloor({
  storeId,
  bundle,
  canEdit,
  contextLinks,
  onSaved,
}: {
  storeId: string;
  bundle: VenueOpsBundle;
  canEdit: boolean;
  contextLinks: { to: string; label: string }[];
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [seats, setSeats] = useState('');
  const [station, setStation] = useState('');
  const [saving, setSaving] = useState(false);

  const clear = () => {
    setEditingId(null);
    setSectionName('');
    setTableLabel('');
    setSeats('');
    setStation('');
  };

  const save = async () => {
    setSaving(true);
    const updating = Boolean(editingId);
    try {
      await saveVenueFloor(editingId, { storeId, sectionName, tableLabel, seats, station });
      clear();
      await onSaved();
      toast({ title: updating ? 'Table updated' : 'Table saved' });
    } catch (err) {
      toast({ title: 'Could not save table', description: err instanceof Error ? err.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <ReadOnlyNote canEdit={canEdit} />
      <BridgeLinks links={contextLinks} />
      {canEdit ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Section" value={sectionName} onChange={setSectionName} />
            <Field label="Table" value={tableLabel} onChange={setTableLabel} />
            <Field label="Seat numbers" value={seats} onChange={setSeats} />
            <Field label="Station" value={station} onChange={setStation} />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving || !sectionName.trim() || !tableLabel.trim()}>{editingId ? 'Save table' : 'Add table'}</Button>
            {editingId ? <Button type="button" variant="outline" onClick={clear}>Cancel</Button> : null}
          </div>
        </>
      ) : null}
      <RowList
        empty="No tables yet."
        onEdit={canEdit ? (id) => {
          const row = bundle.floor.find((item) => item.id === id);
          if (!row) return;
          setEditingId(row.id);
          setSectionName(row.sectionName);
          setTableLabel(row.tableLabel);
          setSeats(row.seats);
          setStation(row.station);
        } : undefined}
        rows={bundle.floor.map((row) => ({
          id: row.id,
          title: row.title,
          extra: [row.seats ? `Seats ${row.seats}` : '', row.station].filter(Boolean).join(' · '),
        }))}
      />
    </div>
  );
}

export function VenueStandards({
  storeId,
  bundle,
  canEdit,
  onSaved,
}: {
  storeId: string;
  bundle: VenueOpsBundle;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<VenueStandardKind>('values');
  const [category, setCategory] = useState('');
  const [roleTarget, setRoleTarget] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [status, setStatus] = useState<VenueStandardStatus>('draft');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const checklist = checklistText.split('\n').map((line) => line.trim()).filter(Boolean);
      await saveVenueStandard(editingId, { storeId, title, kind, category, roleTarget, checklist, content: checklist.join('\n'), status });
      setEditingId(null);
      setTitle('');
      setChecklistText('');
      await onSaved();
      toast({ title: 'Standard saved' });
    } catch (err) {
      toast({ title: 'Could not save standard', description: err instanceof Error ? err.message : 'Save failed.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <ReadOnlyNote canEdit={canEdit} />
      {canEdit ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" value={title} onChange={setTitle} />
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-800">Type</span>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(event) => setKind(event.target.value as VenueStandardKind)}>
                <option value="values">Values checklist</option>
                <option value="sop">SOP</option>
                <option value="audit">Audit / opening checklist</option>
                <option value="training">Staff training</option>
                <option value="standard">Standard</option>
              </select>
            </label>
            <Field label="Category" value={category} onChange={setCategory} />
            <Field label="Role" value={roleTarget} onChange={setRoleTarget} />
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-800">Checklist</span>
              <textarea className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={checklistText} onChange={(event) => setChecklistText(event.target.value)} placeholder="One step per line" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void save()} disabled={saving || !title.trim()}>{editingId ? 'Save standard' : 'Add standard'}</Button>
            {editingId ? <Button type="button" variant="outline" onClick={() => { setEditingId(null); setTitle(''); setChecklistText(''); }}>Cancel</Button> : null}
          </div>
        </>
      ) : null}
      <RowList
        empty="No standards yet."
        onEdit={canEdit ? (id) => {
          const row = bundle.standards.find((item) => item.id === id);
          if (!row) return;
          setEditingId(row.id);
          setTitle(row.title);
          setKind((['values', 'sop', 'audit', 'training', 'standard'].includes(row.kind) ? row.kind : 'standard') as VenueStandardKind);
          setCategory(row.category);
          setRoleTarget(row.roleTarget);
          setChecklistText(row.checklist.join('\n'));
          setStatus(row.status === 'active' ? 'active' : 'draft');
        } : undefined}
        rows={bundle.standards.map((row) => ({
          id: row.id,
          title: row.title,
          extra: [row.kind, row.checklist[0]].filter(Boolean).join(' · '),
        }))}
      />
    </div>
  );
}
