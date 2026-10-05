import { describe, expect, it } from 'vitest';
import { QUOTES, dayNumber, quoteForDate } from './quotes';
import { addDays, eachDate } from './date';

describe('daily quotes', () => {
  it('has around 60 short, unique quotes', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(55);
    expect(new Set(QUOTES.map((q) => q.text)).size).toBe(QUOTES.length);
    for (const q of QUOTES) expect(q.text.length).toBeLessThanOrEqual(90);
  });

  it('counts days independent of the time zone', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('2026-10-06') - dayNumber('2026-10-05')).toBe(1);
    expect(dayNumber('2027-03-01') - dayNumber('2027-02-28')).toBe(1);
  });

  it('gives the same quote all day and a new one tomorrow', () => {
    expect(quoteForDate('2026-10-05')).toBe(quoteForDate('2026-10-05'));
    for (const d of eachDate('2026-10-05', '2026-12-31')) {
      expect(quoteForDate(d)).not.toBe(quoteForDate(addDays(d, 1)));
    }
  });

  it('shows every quote once before repeating', () => {
    const start = '2026-10-05';
    const seen = new Set(Array.from({ length: QUOTES.length }, (_, i) => quoteForDate(addDays(start, i)).text));
    expect(seen.size).toBe(QUOTES.length);
  });

  it('works for lists whose length shares a factor with the stride', () => {
    const list = Array.from({ length: 14 }, (_, i) => ({ text: `q${i}`, tag: 'study' as const }));
    const seen = new Set(Array.from({ length: 14 }, (_, i) => quoteForDate(addDays('2026-01-01', i), list).text));
    expect(seen.size).toBe(14);
  });
});
