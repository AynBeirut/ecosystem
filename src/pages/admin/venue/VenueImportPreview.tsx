import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { previewVenueSource, type VenueSourcePreview } from '@/lib/venueSourcePreview';

const emptyPreview: VenueSourcePreview = {
  specs: [],
  briefings: [],
  bible: [],
  allergens: [],
  skippedSheets: [],
  saved: false,
};

function Names({ title, names }: { title: string; names: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-900">{title} ({names.length})</h3>
      {names.length === 0 ? <p className="text-sm text-slate-600">None in this file.</p> : (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          {names.slice(0, 12).map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}
          {names.length > 12 ? <li>{names.length - 12} more</li> : null}
        </ul>
      )}
    </section>
  );
}

export function VenueImportPreview() {
  const [preview, setPreview] = useState<VenueSourcePreview | null>(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const onFile = async (file: File | null) => {
    setError('');
    setPreview(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheets = book.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, raw: false, defval: '' }) as string[][],
      }));
      const next = previewVenueSource(sheets);
      next.saved = false;
      setPreview(next);
    } catch (err) {
      setPreview(emptyPreview);
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  return (
    <div className="space-y-4">
      <p>Preview only. Nothing is saved to this store.</p>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-800">Spreadsheet</span>
        <input
          className="block w-full text-sm"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => void onFile(event.target.files?.[0] || null)}
        />
      </label>
      {error ? <p>{error}</p> : null}
      {preview ? (
        <div className="space-y-4">
          <p>{fileName} mapped. Saved: no.</p>
          <Names title="Beverage specs" names={preview.specs.map((row) => row.title)} />
          <Names title="Briefings" names={preview.briefings.map((row) => [row.day, row.foodFocus, row.beverageFocus].filter(Boolean).join(' · '))} />
          <Names title="Menu knowledge" names={preview.bible.map((row) => row.title)} />
          <Names title="Allergens" names={preview.allergens.map((row) => row.title)} />
          {preview.skippedSheets.length > 0 ? <p>Skipped sheets: {preview.skippedSheets.join(', ')}</p> : null}
          <Button type="button" disabled>Save is off</Button>
        </div>
      ) : null}
    </div>
  );
}
