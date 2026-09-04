const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsToWords(value: number): string {
  if (value < 20) return ONES[value];
  const ten = Math.floor(value / 10);
  const one = value % 10;
  return `${TENS[ten]}${one ? ` ${ONES[one]}` : ''}`;
}

function threeDigitsToWords(value: number): string {
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  return `${hundred ? `${ONES[hundred]} Hundred${rest ? ' ' : ''}` : ''}${rest ? twoDigitsToWords(rest) : ''}`;
}

/** Converts a non-negative integer into words using the Indian numbering system (crore/lakh/thousand). */
export function numberToIndianWords(value: number): string {
  if (value === 0) return 'Zero';

  let remainder = Math.floor(Math.abs(value));
  const crore = Math.floor(remainder / 10000000); remainder %= 10000000;
  const lakh = Math.floor(remainder / 100000); remainder %= 100000;
  const thousand = Math.floor(remainder / 1000); remainder %= 1000;
  const hundred = remainder;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));
  return parts.join(' ');
}

/** Converts a non-negative integer into words using the international system (billion/million/thousand). */
export function numberToInternationalWords(value: number): string {
  if (value === 0) return 'Zero';

  let remainder = Math.floor(Math.abs(value));
  const billion = Math.floor(remainder / 1000000000); remainder %= 1000000000;
  const million = Math.floor(remainder / 1000000); remainder %= 1000000;
  const thousand = Math.floor(remainder / 1000); remainder %= 1000;
  const hundred = remainder;

  const parts: string[] = [];
  if (billion) parts.push(`${threeDigitsToWords(billion)} Billion`);
  if (million) parts.push(`${threeDigitsToWords(million)} Million`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));
  return parts.join(' ');
}

/** Renders a rupee amount as "... Rupees and ... Paisa only", using either numbering system. */
export function amountToWords(amount: number, system: 'indian' | 'international' = 'indian'): string {
  const toWords = system === 'international' ? numberToInternationalWords : numberToIndianWords;
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  const rupeeWords = `${toWords(rupees)} Rupee${rupees === 1 ? '' : 's'}`;
  if (!paise) return `${rupeeWords} only`;
  return `${rupeeWords} and ${toWords(paise)} Paisa only`;
}
