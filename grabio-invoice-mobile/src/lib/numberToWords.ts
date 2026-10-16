const UNITS = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function currencyNames(code: string): { main: string; fraction: string } {
  switch (code.toUpperCase()) {
    case 'EUR':
      return { main: 'Euro', fraction: 'Cent' };
    case 'GBP':
      return { main: 'Pound', fraction: 'Penny' };
    case 'LBP':
      return { main: 'Lebanese Pound', fraction: 'Piastre' };
    case 'AED':
      return { main: 'Dirham', fraction: 'Fils' };
    case 'SAR':
      return { main: 'Riyal', fraction: 'Halala' };
    default:
      return { main: 'Dollar', fraction: 'Cent' };
  }
}

function convertChunk(n: number): string {
  if (n < 20) return UNITS[n];
  if (n < 100) {
    return TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + UNITS[n % 10] : '');
  }
  if (n < 1000) {
    return UNITS[Math.floor(n / 100)] + ' hundred' + (n % 100 !== 0 ? ' ' + convertChunk(n % 100) : '');
  }
  if (n < 1_000_000) {
    return convertChunk(Math.floor(n / 1000)) + ' thousand' + (n % 1000 !== 0 ? ' ' + convertChunk(n % 1000) : '');
  }
  if (n < 1_000_000_000) {
    return convertChunk(Math.floor(n / 1_000_000)) + ' million' + (n % 1_000_000 !== 0 ? ' ' + convertChunk(n % 1_000_000) : '');
  }
  return convertChunk(Math.floor(n / 1_000_000_000)) + ' billion' + (n % 1_000_000_000 !== 0 ? ' ' + convertChunk(n % 1_000_000_000) : '');
}

/** e.g. "One million two hundred thirty-four Dollars and fifty-six Cents Only" */
export function numberToWords(num: number, currencyCode = 'USD'): string {
  if (num < 0) return `Negative ${numberToWords(Math.abs(num), currencyCode)}`;
  if (num === 0) return 'Zero Only';

  const intPart = Math.floor(num);
  const fractionPart = Math.round((num - intPart) * 100);
  const { main, fraction } = currencyNames(currencyCode);

  let result = '';
  if (intPart > 0) {
    result += convertChunk(intPart);
    result += ` ${main}${intPart === 1 ? '' : 's'}`;
  }
  if (fractionPart > 0) {
    if (intPart > 0) result += ' and ';
    result += convertChunk(fractionPart);
    result += ` ${fraction}${fractionPart === 1 ? '' : 's'}`;
  }
  if (!result) return 'Zero Only';

  return result.charAt(0).toUpperCase() + result.slice(1) + ' Only';
}
