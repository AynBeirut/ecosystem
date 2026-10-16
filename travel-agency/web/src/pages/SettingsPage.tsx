import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { useSession } from '../context/SessionContext';
import { db } from '../lib/firebase';

export default function SettingsPage() {
  const { storeId } = useSession();
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.nextra.travel');
  const [agencyName, setAgencyName] = useState('');
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!storeId) return;
    await setDoc(doc(db, 'stores', storeId, 'travelSettings', 'nextra'), { apiBaseUrl }, { merge: true });
    await setDoc(doc(db, 'stores', storeId, 'travelSettings', 'branding'), { agencyName }, { merge: true });
    setSaved(true);
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
        <label className="block">Agency name (proposals)<input className="mt-1 w-full border rounded-lg px-3 py-2" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} /></label>
        <label className="block">Nextra API base URL<input className="mt-1 w-full border rounded-lg px-3 py-2" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} /></label>
        <p className="text-slate-500 text-xs">API keys belong in Secret Manager / server env — not in the browser.</p>
        <button type="button" onClick={save} className="bg-brand text-white px-4 py-2 rounded-lg">Save</button>
        {saved ? <p className="text-green-700">Saved.</p> : null}
      </div>
    </div>
  );
}
