
// Function to convert a number to words
export const numberToWords = (num: number, currencyCode: string = 'USD'): string => {
  const units = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  
  const getCurrencyName = (code: string): { main: string, fraction: string } => {
    switch (code) {
      case 'USD':
        return { main: 'Dollar', fraction: 'Cent' };
      case 'EUR':
        return { main: 'Euro', fraction: 'Cent' };
      case 'GBP':
        return { main: 'Pound', fraction: 'Penny' };
      case 'JPY':
        return { main: 'Yen', fraction: 'Sen' };
      case 'CAD':
        return { main: 'Canadian Dollar', fraction: 'Cent' };
      case 'AUD':
        return { main: 'Australian Dollar', fraction: 'Cent' };
      case 'LBP':
        return { main: 'Lebanese Pound', fraction: 'Piastre' };
      default:
        return { main: 'Dollar', fraction: 'Cent' };
    }
  };

  const convertNumber = (n: number): string => {
    if (n < 20) {
      return units[n];
    }
    
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + units[n % 10] : '');
    }
    
    if (n < 1000) {
      return units[Math.floor(n / 100)] + ' hundred' + (n % 100 !== 0 ? ' ' + convertNumber(n % 100) : '');
    }
    
    if (n < 1000000) {
      return convertNumber(Math.floor(n / 1000)) + ' thousand' + (n % 1000 !== 0 ? ' ' + convertNumber(n % 1000) : '');
    }
    
    if (n < 1000000000) {
      return convertNumber(Math.floor(n / 1000000)) + ' million' + (n % 1000000 !== 0 ? ' ' + convertNumber(n % 1000000) : '');
    }
    
    return convertNumber(Math.floor(n / 1000000000)) + ' billion' + (n % 1000000000 !== 0 ? ' ' + convertNumber(n % 1000000000) : '');
  };
  
  // Handle negative numbers
  if (num < 0) {
    return 'negative ' + numberToWords(Math.abs(num), currencyCode);
  }
  
  // Handle zero
  if (num === 0) {
    return 'zero';
  }
  
  // Split into integer and fraction parts
  const intPart = Math.floor(num);
  const fractionPart = Math.round((num - intPart) * 100);
  
  const { main, fraction } = getCurrencyName(currencyCode);
  
  let result = '';
  
  // Convert integer part
  if (intPart > 0) {
    result += convertNumber(intPart);
    result += ' ' + main + (intPart === 1 ? '' : 's');
  }
  
  // Convert fraction part
  if (fractionPart > 0) {
    if (intPart > 0) {
      result += ' and ';
    }
    result += convertNumber(fractionPart);
    result += ' ' + fraction + (fractionPart === 1 ? '' : 's');
  }
  
  return result.charAt(0).toUpperCase() + result.slice(1) + ' Only';
};
