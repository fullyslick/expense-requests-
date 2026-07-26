const DOLLARS_PATTERN = /^\d+(\.\d{1,2})?$/;

export function dollarsToCents(input: string): number {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '');

  if (!DOLLARS_PATTERN.test(cleaned)) {
    throw new Error(`Invalid dollar amount: "${input}"`);
  }

  const [wholePart, fractionPart = ''] = cleaned.split('.');
  const centsPart = fractionPart.padEnd(2, '0');

  return Number(wholePart) * 100 + Number(centsPart);
}

export function centsToDisplay(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`Invalid cents amount: ${cents}`);
  }

  const sign = cents < 0 ? '-' : '';
  const absCents = Math.abs(cents);
  const wholePart = Math.floor(absCents / 100);
  const centsPart = String(absCents % 100).padStart(2, '0');

  return `${sign}$${wholePart.toLocaleString('en-US')}.${centsPart}`;
}

// dollarsToCents' inverse, and deliberately not centsToDisplay: the form input
// round-trips through this, and an <input type="number"> rejects the `$` and
// thousands separators that the display formatter adds.
export function centsToDollarString(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`Invalid cents amount: ${cents}`);
  }

  const sign = cents < 0 ? '-' : '';
  const absCents = Math.abs(cents);
  const centsPart = String(absCents % 100).padStart(2, '0');

  return `${sign}${Math.floor(absCents / 100)}.${centsPart}`;
}
