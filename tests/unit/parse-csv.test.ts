import { describe, expect, it } from 'vitest';
import { parseTransactions } from '@/lib/migration/parse-csv';
describe('parseTransactions', () => { it('reports malformed rows without silently importing them', () => { const result = parseTransactions('transaction_id;description;Income/expensive;amount;category;date\n1;Coffee;expensive;10;food;2026-01-01\n2;;income;20;work;2026-01-02', 'owner'); expect(result.records).toHaveLength(1); expect(result.issues).toHaveLength(1); }); });

describe('parseTransactions source headers', () => { it('accepts the capitalized headers from pfm-gio.csv', () => { const result = parseTransactions('transaction_id;Description;Income/expensive;Amount;Category;Date\n1;Coffee;expensive;10;food;2026-01-01', 'owner'); expect(result.records).toEqual([expect.objectContaining({ description: 'Coffee', amount: 10, category: 'food', transaction_date: '2026-01-01' })]); expect(result.issues).toEqual([]); }); });
