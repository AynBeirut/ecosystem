import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveVenueSetupTracks } from '@/lib/venueSetupReadiness';
import type { StoreEntitlements } from '@/lib/entitlements';
import type { StoreProfile } from '@/types/storeProfile';
import type { VenueSetupTrackStatus } from '@/types/venueSetup';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<VenueSetupTrackStatus, string> = {
  ready: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  in_progress: 'bg-amber-50 text-amber-900 border-amber-200',
  not_started: 'bg-slate-50 text-slate-600 border-slate-200',
  blocked: 'bg-rose-50 text-rose-800 border-rose-200',
  deferred: 'bg-slate-50 text-slate-500 border-slate-100',
};

function statusLabel(status: VenueSetupTrackStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'in_progress':
      return 'In progress';
    case 'blocked':
      return 'Blocked';
    case 'deferred':
      return 'Later';
    default:
      return 'Not started';
  }
}

type Props = {
  profile: StoreProfile | null;
  entitlements: StoreEntitlements | null;
};

export default function VenueSetupReadinessPanel({ profile, entitlements }: Props) {
  const tracks = resolveVenueSetupTracks(profile, entitlements);
  if (tracks.length === 0) return null;

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">Venue setup readiness</CardTitle>
        <CardDescription className="text-sm text-slate-600">
          Internal Grabio ops checklist — not shown on client stores. Wire only from platform ops surfaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {tracks.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{t.label}</p>
                <p className="text-xs text-slate-500">{t.hint}</p>
              </div>
              <span
                className={cn(
                  'inline-flex shrink-0 self-start rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:self-center',
                  STATUS_STYLES[t.status],
                )}
              >
                {statusLabel(t.status)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          Restaurant-focused menu is toggled on the client&apos;s{' '}
          <Link to="/admin/profile" className="font-medium text-teal-700 hover:underline">
            Store Profile
          </Link>{' '}
          → Venue operations layout.
        </p>
      </CardContent>
    </Card>
  );
}
