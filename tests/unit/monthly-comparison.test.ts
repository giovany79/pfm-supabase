import { describe, expect, it } from 'vitest';
import { buildMonthlyComparison } from '@/lib/monthly-comparison';

describe('monthly income, expense and saving comparison', () => {
  it('sums every category and preserves months without one transaction type', () => {
    expect(
      buildMonthlyComparison(
        ['2026-01', '2026-02'],
        [
          { month: '2026-01', values: { salary: 100, gift: 25 } },
          { month: '2026-02', values: { salary: 120 } },
        ],
        [{ month: '2026-01', values: { food: 30, home: 20 } }],
        [{ month: '2026-02', values: { emergency: 40 } }],
      ),
    ).toEqual([
      { month: '2026-01', income: 125, expense: 50, saving: 0 },
      { month: '2026-02', income: 120, expense: 0, saving: 40 },
    ]);
  });
});
