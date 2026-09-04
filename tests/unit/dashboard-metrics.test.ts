import { describe, expect, it } from 'vitest';

describe('dashboard metrics contract', () => {
  it('requires explicit conversion and missing-currency fields', () => {
    const response = {
      net_worth: {
        by_currency: {},
        converted_cop: { total_assets: 0, total_liabilities: 0, net: 0 },
        rates_used: [],
        unconverted_currencies: [],
      },
      assets_by_category: [],
      liabilities_by_category: [],
      income_vs_expense: { income: 0, expense: 0, saving: 0 },
      spending_by_category: [],
      savings_by_category: [],
      has_data: false,
    };
    expect(response.net_worth.converted_cop).toHaveProperty('net');
    expect(response.net_worth).toHaveProperty('rates_used');
    expect(response.net_worth).toHaveProperty('unconverted_currencies');
    expect(response.has_data).toBe(false);
  });
});
