import { quoteRide } from './quote';

describe('quoteRide', () => {
  it('uses the reference table from Maracanã to the Sambódromo', () => {
    const quote = quoteRide('Maracanã', 'Sambódromo Marquês de Sapucaí');
    expect(quote).toMatchObject({ distanceKm: 3.7, durationMin: 6, fareFlag: 2, baseCents: 2200 });
    expect(quote.options.map((option) => option.amountCents)).toEqual([2200, 2000, 1800, 1600, 1400]);
  });

  it('prices the receipt sample with a real percentage', () => {
    const quote = quoteRide('Av. Maracanã, 14', 'R. Conselheiro Olegário, 51');
    const discounted = quote.options.find((option) => option.discountPercent === 30);
    expect(quote.baseCents).toBe(969);
    expect(discounted?.amountCents).toBe(678);
  });

  it('returns the same estimate for the same addresses', () => {
    expect(quoteRide('Copacabana', 'Centro')).toEqual(quoteRide('Copacabana', 'Centro'));
  });
});
