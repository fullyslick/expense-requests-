import { centsToDisplay, centsToDollarString, dollarsToCents } from '../money';

describe('dollarsToCents', () => {
  it('converts a whole-and-cents amount', () => {
    expect(dollarsToCents('12.50')).toBe(1250);
  });

  it('converts zero', () => {
    expect(dollarsToCents('0')).toBe(0);
  });

  it('converts a round thousand', () => {
    expect(dollarsToCents('1000')).toBe(100000);
  });

  it('handles the classic .1 + .2 floating-point trap', () => {
    // 19.99 * 100 === 1998.9999999999998 with naive float multiplication.
    expect(dollarsToCents('19.99')).toBe(1999);
    expect(dollarsToCents('0.1')).toBe(10);
    expect(dollarsToCents('0.2')).toBe(20);
  });

  it('pads a single decimal digit', () => {
    expect(dollarsToCents('5.4')).toBe(540);
  });

  it('strips a leading $ and thousands separators', () => {
    expect(dollarsToCents('$1,234.56')).toBe(123456);
  });

  it('rejects malformed input', () => {
    expect(() => dollarsToCents('abc')).toThrow();
    expect(() => dollarsToCents('12.5.0')).toThrow();
    expect(() => dollarsToCents('12.999')).toThrow();
  });
});

describe('centsToDisplay', () => {
  it('formats whole dollars', () => {
    expect(centsToDisplay(100000)).toBe('$1,000.00');
  });

  it('formats cents with padding', () => {
    expect(centsToDisplay(1250)).toBe('$12.50');
    expect(centsToDisplay(5)).toBe('$0.05');
  });

  it('formats zero', () => {
    expect(centsToDisplay(0)).toBe('$0.00');
  });
});

describe('centsToDollarString', () => {
  it('formats without the $ or thousands separators an input type=number rejects', () => {
    expect(centsToDollarString(100000)).toBe('1000.00');
    expect(centsToDollarString(123456)).toBe('1234.56');
  });

  it('pads cents and handles zero', () => {
    expect(centsToDollarString(5)).toBe('0.05');
    expect(centsToDollarString(0)).toBe('0.00');
  });

  it('feeds straight back into dollarsToCents', () => {
    for (const cents of [0, 5, 1250, 99999, 100000, 123456]) {
      expect(dollarsToCents(centsToDollarString(cents))).toBe(cents);
    }
  });
});

describe('round-trip', () => {
  it('dollarsToCents(centsToDisplay(x)) returns the original value', () => {
    for (const cents of [0, 5, 1250, 100000, 123456, 1999]) {
      const display = centsToDisplay(cents).replace(/^\$/, '').replace(/,/g, '');
      expect(dollarsToCents(display)).toBe(cents);
    }
  });
});
