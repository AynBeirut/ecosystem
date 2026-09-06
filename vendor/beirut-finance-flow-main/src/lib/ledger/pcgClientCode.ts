/** Propose next Lebanese PCG client working code under a parent (11-char max). */
export function normalizeParentForClientCode(parentPcgCode: string): string {
  const raw = String(parentPcgCode || '').trim();
  if (!raw.includes('.')) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return String(n);
}

export function proposeClientPcgCode(parentPcgCode: string, usedCodes: ReadonlySet<string>): string {
  const parent = normalizeParentForClientCode(parentPcgCode);
  if (!parent) throw new Error('parentPcgCode required');

  if (parent.includes('.')) {
    for (let n = 1; n <= 99_999; n += 1) {
      const code = `${parent}${String(n).padStart(5, '0')}`;
      if (code.length > 11) break;
      if (!/^[\d.]{4,11}$/.test(code)) continue;
      if (!usedCodes.has(code)) return code;
    }
  } else {
    for (let n = 1_000_001; n <= 9_999_999; n += 1) {
      const code = `${parent}${n}`;
      if (code.length > 11) break;
      if (!usedCodes.has(code)) return code;
    }
  }
  throw new Error(`No available client code under parent ${parentPcgCode}`);
}

/** Walk-in client always uses the first working slot under a PCG parent (e.g. 70101000001). */
export function walkInClientPcgCode(parentPcgCode: string): string {
  const parent = normalizeParentForClientCode(parentPcgCode);
  if (!parent) throw new Error('parentPcgCode required');
  return `${parent}1000001`;
}

/** Next code for a named party — reserves …000001 for walk-in. */
export function proposePartyClientPcgCode(parentPcgCode: string, usedCodes: ReadonlySet<string>): string {
  const parent = normalizeParentForClientCode(parentPcgCode);
  const reserved = new Set(usedCodes);
  reserved.add(walkInClientPcgCode(parentPcgCode));
  return proposeClientPcgCode(parentPcgCode, reserved);
}

/** Grabio-style party suffix codes (4010001, 1420003) — not PCG working numbers. */
export function isGrabioPartySuffixCode(code: string, parentGrabio: string): boolean {
  const raw = String(code || '').trim();
  const parent = String(parentGrabio || '').trim();
  if (!raw || !parent) return false;
  if (!raw.startsWith(parent)) return false;
  const suffix = raw.slice(parent.length);
  return suffix.length >= 2 && /^\d+$/.test(suffix);
}
