/** Resolve phone from Firestore customer doc fields (legacy imports use different keys). */
export function resolveClientPhoneFromData(data: Record<string, unknown>): string {
  const keys = [
    'phone',
    'mobile',
    'phoneNumber',
    'customerPhone',
    'contactPhone',
    'whatsapp',
    'whatsappNumber',
  ];
  for (const key of keys) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

export function stripPhoneDigits(phone?: string | null): string {
  return String(phone || '').replace(/\D/g, '');
}

/** Lebanon-friendly digits for tel: / wa.me (03… → 9613…, 71… → 96171…). */
export function phoneDigitsForLink(phone?: string | null): string {
  let digits = stripPhoneDigits(phone);
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('961') && digits.length >= 10) return digits;
  if (digits.startsWith('0') && digits.length >= 8) return `961${digits.slice(1)}`;
  if ((digits.length === 7 || digits.length === 8) && /^[23789]/.test(digits)) return `961${digits}`;
  return digits;
}

export function clientAreaOrDistrict(client: { area?: string; district?: string }): string {
  const area = (client.area || '').trim();
  if (area) return area;
  return (client.district || '').trim();
}
