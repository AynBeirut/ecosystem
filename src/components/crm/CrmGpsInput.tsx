import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGeolocation } from '@/hooks/useGeolocation';
import { MapPin, Loader2 } from 'lucide-react';
import type { CrmGeoLocation } from '@/types/crm';

type Props = {
  value: CrmGeoLocation | null;
  onChange: (next: CrmGeoLocation | null) => void;
};

function parseCoord(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function CrmGpsInput({ value, onChange }: Props) {
  const { capture, loading: gpsLoading } = useGeolocation();
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');

  useEffect(() => {
    if (value?.lat != null && value?.lng != null) {
      setLatText(String(value.lat));
      setLngText(String(value.lng));
    }
  }, [value?.lat, value?.lng]);

  const applyManual = () => {
    const lat = parseCoord(latText);
    const lng = parseCoord(lngText);
    if (lat == null || lng == null) {
      onChange(null);
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      onChange(null);
      return;
    }
    onChange({ lat, lng });
  };

  const clearGps = () => {
    setLatText('');
    setLngText('');
    onChange(null);
  };

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center gap-2 font-medium text-sm">
        <MapPin className="h-4 w-4" />
        GPS coordinates (optional)
        {gpsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Latitude</Label>
          <Input
            value={latText}
            onChange={(e) => setLatText(e.target.value)}
            onBlur={applyManual}
            placeholder="33.44"
            inputMode="decimal"
          />
        </div>
        <div>
          <Label className="text-xs">Longitude</Label>
          <Input
            value={lngText}
            onChange={(e) => setLngText(e.target.value)}
            onBlur={applyManual}
            placeholder="35.677"
            inputMode="decimal"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Example: 33.44 / 35.677 — type manually or capture from device.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={applyManual}>
          Apply coordinates
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => capture().then((loc) => {
            if (!loc) return;
            onChange(loc);
            setLatText(String(loc.lat));
            setLngText(String(loc.lng));
          })}
        >
          Capture GPS
        </Button>
        {(value || latText || lngText) ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearGps}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
