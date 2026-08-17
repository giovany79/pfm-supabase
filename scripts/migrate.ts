import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServiceRoleClient } from '@/lib/supabase/service-role-client';
import { parseSnapshots, parseTransactions } from '@/lib/migration/parse-csv';
import { upsertSnapshots, upsertTransactions } from '@/lib/migration/upsert';
import { checkLocked } from '@/lib/migration/migration-lock';

const args = process.argv.slice(2);
const ownerId = args[args.indexOf('--owner-id') + 1];
if (!ownerId) throw new Error('Usage: npm run migrate -- --owner-id <gio-user-id> [--force]');

async function main() {
  const client = createServiceRoleClient();
  const force = args.includes('--force');

  if (!force && (await checkLocked(client, ownerId))) {
    throw new Error(
      'pfm-gio.csv migration is locked after a confirmed mutation; use --force only for intentional recovery.',
    );
  }

  const [snapshotsCsv, transactionsCsv] = await Promise.all([
    readFile(resolve('balance-sheet.csv'), 'utf8'),
    readFile(resolve('pfm-gio.csv'), 'utf8'),
  ]);
  const snapshots = parseSnapshots(snapshotsCsv, ownerId);
  const transactions = parseTransactions(transactionsCsv, ownerId);
  const [snapshotCount, transactionCount] = await Promise.all([
    upsertSnapshots(client, snapshots.records),
    upsertTransactions(client, transactions.records),
  ]);

  console.log(
    JSON.stringify(
      { snapshotCount, transactionCount, issues: [...snapshots.issues, ...transactions.issues] },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
