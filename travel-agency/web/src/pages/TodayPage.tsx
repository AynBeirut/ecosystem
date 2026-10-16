import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { listDeals } from '../lib/travelService';
import type { TravelDeal } from '../lib/types';
import { STAGE_LABELS } from '../lib/travelConstants';
import { nextraWalletApi } from '../lib/travelApi';

export default function TodayPage() {
  const { storeId } = useSession();
  const [deals, setDeals] = useState<TravelDeal[]>([]);
  const [walletLine, setWalletLine] = useState('');

  useEffect(() => {
    if (!storeId) return;
    listDeals(storeId).then(setDeals).catch(() => setDeals([]));
    void nextraWalletApi(storeId)
      .then((r) => {
        const w = r.wallet;
        setWalletLine(`${w.currency} ${w.available} available · ${w.due} due`);
      })
      .catch(() => setWalletLine(''));
  }, [storeId]);

  const followUps = deals.filter((d) => d.stage === 'quoted');
  const bookNow = deals.filter((d) => d.stage === 'deposit_received');
  const deposits = deals.filter((d) => d.stage === 'quoted');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-slate-500 text-sm">Tap the next action — no empty dashboard.</p>
      </div>
      {walletLine ? (
        <Link to="/money" className="block bg-cyan-50 border border-cyan-100 rounded-xl p-4 text-sm text-cyan-900">
          Wallet: {walletLine}
        </Link>
      ) : null}
      {followUps.map((d) => (
        <ActionCard key={d.id} title={`Follow up — ${d.title}`} sub={`Stage: ${STAGE_LABELS[d.stage]}`} to={`/deals/${d.id}`} cta="Open deal" />
      ))}
      {deposits.slice(0, 2).map((d) => (
        <ActionCard key={`dep-${d.id}`} title={`Deposit due — ${d.title}`} sub="Quoted — awaiting payment" to={`/deals/${d.id}/quote`} cta="Record deposit" />
      ))}
      {bookNow.map((d) => (
        <ActionCard key={`bk-${d.id}`} title={`Book now — ${d.title}`} sub="Deposit received · attach PNR" to={`/book?dealId=${d.id}`} cta="Book via Nextra" />
      ))}
      {followUps.length === 0 && bookNow.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500 text-sm">
          All clear. <Link to="/crm" className="text-brand-dark font-medium">Open CRM</Link> or{' '}
          <Link to="/deals/new" className="text-brand-dark font-medium">new deal</Link>
        </div>
      ) : null}
    </div>
  );
}

function ActionCard({ title, sub, to, cta }: { title: string; sub: string; to: string; cta: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <strong className="block text-slate-900">{title}</strong>
        <span className="text-sm text-slate-500">{sub}</span>
      </div>
      <Link to={to} className="bg-brand text-white text-sm px-4 py-2 rounded-lg font-medium">{cta}</Link>
    </div>
  );
}
