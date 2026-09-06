import type { CrmRepLiveLocation } from './crmMobileService';

const LIVE_FRESH_MS = 3 * 60 * 1000;
/** Show last-known position on map for a full work shift (not only 30 min). */
const LIVE_STALE_MS = 12 * 60 * 60 * 1000;

export function liveLocationAgeMs(updatedAtIso?: string): number | null {
  if (!updatedAtIso) return null;
  const t = new Date(updatedAtIso).getTime();
  if (!Number.isFinite(t)) return null;
  return Date.now() - t;
}

export function formatLiveLocationAge(updatedAtIso?: string): string {
  const age = liveLocationAgeMs(updatedAtIso);
  if (age == null) return 'Unknown';
  if (age < 60_000) return 'Live now';
  if (age < 3_600_000) return `${Math.round(age / 60_000)}m ago`;
  return `${Math.round(age / 3_600_000)}h ago`;
}

export function isLiveLocationFresh(updatedAtIso?: string): boolean {
  const age = liveLocationAgeMs(updatedAtIso);
  return age != null && age <= LIVE_FRESH_MS;
}

export function isLiveLocationVisible(updatedAtIso?: string): boolean {
  const age = liveLocationAgeMs(updatedAtIso);
  return age != null && age <= LIVE_STALE_MS;
}

/** Field sales agents — visible to sales manager on live map. */
export function isFieldAgentLiveRole(role?: string): boolean {
  return role === 'sub_seller' || role === 'crm_rep' || role === 'sales';
}

export function isManagerLiveRole(role?: string): boolean {
  return role === 'sub_manager' || role === 'manager';
}

/** Owner/admin: all team. Sales manager: field agents only. */
export function filterLiveRepsForViewer(
  reps: CrmRepLiveLocation[],
  viewerRole?: string,
): CrmRepLiveLocation[] {
  const visible = reps.filter((r) => isLiveLocationVisible(r.updatedAtIso));
  if (viewerRole === 'owner') return visible;
  return visible.filter((r) => isFieldAgentLiveRole(r.role));
}

/** Match live GPS row to sales-agent chip / rep filter id (sub:, user:, crmRep id). */
export function liveRepMatchesFilter(
  rep: Pick<CrmRepLiveLocation, 'repId' | 'userId'>,
  filterId?: string,
  extraIds: string[] = [],
): boolean {
  if (!filterId || filterId === 'all') return true;
  const keys = new Set<string>([rep.repId, rep.userId, `user:${rep.userId}`, ...extraIds]);
  return keys.has(filterId);
}

export function liveRepMatchesAnyFilter(
  rep: Pick<CrmRepLiveLocation, 'repId' | 'userId'>,
  filterIds: string[],
): boolean {
  if (!filterIds.length) return true;
  return filterIds.some((id) => liveRepMatchesFilter(rep, id));
}

export type LiveMapMarker = {
  lat: number;
  lng: number;
  name: string;
  isManager: boolean;
  fresh: boolean;
};

export function toLiveMapMarkers(reps: CrmRepLiveLocation[]): LiveMapMarker[] {
  return reps.map((r) => ({
    lat: r.lat,
    lng: r.lng,
    name: (r.repName || 'Rep').replace(/'/g, '’'),
    isManager: isManagerLiveRole(r.role),
    fresh: isLiveLocationFresh(r.updatedAtIso),
  }));
}

export function teamLiveMapHtml(markers: LiveMapMarker[]): string {
  const payload = JSON.stringify(markers);
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;height:100%;}</style>
</head>
<body>
<div id="map"></div>
<script>
var reps = ${payload};
var map = L.map('map', { zoomControl: true });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 }).addTo(map);
var bounds = [];
reps.forEach(function(r) {
  var color = r.isManager ? '#7c3aed' : (r.fresh ? '#0284c7' : '#94a3b8');
  var border = r.fresh ? '#0369a1' : '#64748b';
  var icon = L.divIcon({
    className: '',
    html: '<div style="background:'+color+';border:2px solid '+border+';color:#fff;padding:5px 10px;border-radius:16px;font:bold 11px sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25);">'+r.name+'</div>',
    iconAnchor: [40, 14]
  });
  L.marker([r.lat, r.lng], { icon: icon }).addTo(map);
  bounds.push([r.lat, r.lng]);
});
if (bounds.length === 1) map.setView(bounds[0], 15);
else if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
else map.setView([33.8938, 35.5018], 10);
</script>
</body>
</html>`;
}
