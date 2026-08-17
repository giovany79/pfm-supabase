export type TransactionType = 'income' | 'expensive';
export type MutationOperation = 'create' | 'edit' | 'delete';

export type Snapshot = {
  item_id: string; owner_id: string; snapshot_date: string; name: string;
  kind: 'asset' | 'liability'; category: string; amount: number; currency: string;
  institution: string | null; notes: string | null;
};

export type Transaction = {
  transaction_id: string; owner_id: string; description: string;
  type: TransactionType; amount: number; category: string; transaction_date: string;
};

export type ProposedChange = {
  operation: MutationOperation; target_transaction_id?: string;
  date?: string; description?: string; amount?: number; category?: string;
  type_income_expense?: TransactionType;
};

export type TransactionDraft = {
  date: string;
  description: string;
  amount: number;
  category: string;
  type_income_expense: TransactionType;
};

export type ProposedBatchChange = {
  operation: 'batch_create';
  transactions: TransactionDraft[];
};
