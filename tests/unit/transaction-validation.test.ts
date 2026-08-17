import { describe, expect, it } from 'vitest';
import { parseTransactionInput } from '@/app/api/transactions/_validation';

describe('transaction input validation', () => {
  it('normalizes a valid movement', () => {
    expect(
      parseTransactionInput({
        description: '  Pago de nómina  ',
        type: 'income',
        amount: '2500000',
        category: '  Salario ',
        transaction_date: '2026-08-17',
      }),
    ).toMatchObject({
      description: 'Pago de nómina',
      type_income_expense: 'income',
      amount: 2500000,
      category: 'Salario',
      date: '2026-08-17',
    });
  });

  it('rejects invalid type, amount and date values', () => {
    const base = {
      description: 'Movimiento',
      type: 'income',
      amount: 100,
      category: 'General',
      transaction_date: '2026-08-17',
    };
    expect(() => parseTransactionInput({ ...base, type: 'other' })).toThrow();
    expect(() => parseTransactionInput({ ...base, amount: 0 })).toThrow();
    expect(() =>
      parseTransactionInput({ ...base, transaction_date: '17/08/2026' }),
    ).toThrow();
  });
});
