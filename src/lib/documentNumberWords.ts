export function numberToWords(amount: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${convert(n % 100)}` : ''}`;
    if (n < 1000000) {
      return `${convert(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${convert(n % 1000)}` : ''}`;
    }
    return String(n);
  };
  return convert(Math.max(0, Math.floor(amount))) || 'Zero';
}

export function amountInWordsUsd(amount: number): string {
  const safe = Math.max(0, amount);
  const whole = Math.floor(safe);
  const cents = Math.round((safe - whole) * 100);
  let text = `${numberToWords(whole)} Dollar${whole === 1 ? '' : 's'}`;
  if (cents > 0) {
    text += ` ${numberToWords(cents)} Cent${cents === 1 ? '' : 's'}`;
  }
  return `${text} Only`;
}
