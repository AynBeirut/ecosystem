/** Shared Grabio operational → Lebanese PCG parent (keep in sync with grabioToPcgMap.ts). */
const GRABIO_TO_PCG_CODE = {
  101: '5300',
  102: '5300',
  103: '5110',
  105: '5121',
  106: '5121',
  108: '5122',
  110: '4111',
  112: '4910',
  120: '3110',
  121: '3550',
  122: '3700',
  123: '3310',
  125: '3150',
  130: '4720',
  135: '4810',
  140: '4426.6000000000004',
  142: '4281',
  150: '2210',
  151: '2810',
  155: '2240',
  156: '2840',
  201: '4011',
  202: '4210',
  210: '4211',
  212: '4311',
  213: '4410',
  220: '4427',
  222: '4425',
  250: '1552.1',
  252: '1610',
  301: '1013',
  302: '1030',
  303: '1250',
  304: '1210',
  305: '1380',
  401: '7010',
  402: '7010',
  403: '7130',
  405: '7171',
  410: '7090',
  450: '7751',
  455: '7789',
  501: '6111',
  502: '6011',
  503: '6211',
  505: '6113',
  506: '6018',
  601: '6311',
  602: '6351',
  604: '6355',
  610: '6263.1',
  612: '6263.4',
  613: '6263.5',
  615: '6269.4',
  616: '6262.2',
  620: '6261.5',
  622: '6269.9',
  630: '6269.9',
  650: '6265.1',
  653: '6264.1',
  655: '6266.1',
  701: '6739',
  704: '6751',
  710: '6811',
  713: '6612',
  799: '6269.9',
  3999: '1380',
};

/** Trim Excel float noise so client codes stay within 11 chars. */
function normalizeParentForClientCode(parentPcgCode) {
  const raw = String(parentPcgCode || '').trim();
  if (!raw.includes('.')) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return String(n);
}

/** Propose next client working code under a PCG parent (matches LH seed pattern). */
function proposeClientPcgCode(parentPcgCode, usedCodes) {
  const parent = normalizeParentForClientCode(parentPcgCode);
  if (!parent) throw new Error('parentPcgCode required');

  if (parent.includes('.')) {
    for (let n = 1; n <= 99999; n += 1) {
      const code = `${parent}${String(n).padStart(5, '0')}`;
      if (code.length > 11) break;
      if (!/^[\d.]{4,11}$/.test(code)) continue;
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
    }
  } else {
    for (let n = 1000001; n <= 9999999; n += 1) {
      const code = `${parent}${n}`;
      if (code.length > 11) break;
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
    }
  }
  throw new Error(`No available client code under parent ${parentPcgCode}`);
}

module.exports = { GRABIO_TO_PCG_CODE, proposeClientPcgCode };
