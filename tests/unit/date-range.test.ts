import { describe, expect, it } from 'vitest';
import { currentYearDateRange } from '@/lib/date-range';

describe('current year date range', () => {
  it('uses the calendar date in the configured timezone', () => {
    expect(
      currentYearDateRange(
        new Date('2027-01-01T02:00:00.000Z'),
        'America/Bogota',
      ),
    ).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});
