import { parse } from 'csv-parse/sync';
import type { Snapshot, Transaction, TransactionType } from '@/lib/types';

export type ParseIssue = { source: string; row: number; reason: string };
export type ParseResult<T> = { records: T[]; issues: ParseIssue[] };

const required = (value: unknown, field: string) => {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`missing ${field}`);
  return value.trim();
};
const number = (value: unknown) => {
  const parsed = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new Error('invalid amount');
  return parsed;
};
const date = (value: unknown) => {
  const result = required(value, 'date');
  if (Number.isNaN(Date.parse(result))) throw new Error('invalid date');
  return result;
};

function rows(input: string) {
  return parse(input, {
    columns: true,
    delimiter: ';',
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

export function parseSnapshots(
  input: string,
  ownerId: string,
): ParseResult<Snapshot> {
  const records: Snapshot[] = [];
  const issues: ParseIssue[] = [];
  rows(input).forEach((row, index) => {
    try {
      const kind = required(row.kind, 'kind');
      if (kind !== 'asset' && kind !== 'liability')
        throw new Error('invalid kind');
      records.push({
        item_id: required(row.item_id, 'item_id'),
        owner_id: ownerId,
        snapshot_date: date(row.snapshot_date),
        name: required(row.name, 'name'),
        kind,
        category: required(row.category, 'category'),
        amount: number(row.amount),
        currency: required(row.currency, 'currency'),
        institution: row.institution?.trim() || null,
        notes: row.notes?.trim() || null,
      });
    } catch (error) {
      issues.push({
        source: 'balance-sheet.csv',
        row: index + 2,
        reason: error instanceof Error ? error.message : 'invalid row',
      });
    }
  });
  return { records, issues };
}

export function parseTransactions(
  input: string,
  ownerId: string,
): ParseResult<Transaction> {
  const records: Transaction[] = [];
  const issues: ParseIssue[] = [];
  rows(input).forEach((row, index) => {
    try {
      const type = required(
        row['Income/expensive'] ?? row.type,
        'type',
      ) as TransactionType;
      if (type !== 'income' && type !== 'expensive' && type !== 'saving')
        throw new Error('invalid type');
      records.push({
        transaction_id: required(row.transaction_id, 'transaction_id'),
        owner_id: ownerId,
        description: required(
          row.Description ?? row.description,
          'description',
        ),
        type,
        amount: number(row.Amount ?? row.amount),
        category: required(row.Category ?? row.category, 'category'),
        transaction_date: date(row.Date ?? row.date ?? row.transaction_date),
      });
    } catch (error) {
      issues.push({
        source: 'pfm-gio.csv',
        row: index + 2,
        reason: error instanceof Error ? error.message : 'invalid row',
      });
    }
  });
  return { records, issues };
}
