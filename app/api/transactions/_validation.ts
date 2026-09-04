import type { ProposedChange, TransactionType } from '@/lib/types';

type TransactionInput = {
  description?: unknown;
  type?: unknown;
  amount?: unknown;
  category?: unknown;
  transaction_date?: unknown;
};

export function parseTransactionInput(input: TransactionInput): ProposedChange {
  const description = String(input.description ?? '').trim();
  const category = String(input.category ?? '').trim();
  const transactionDate = String(input.transaction_date ?? '');
  const amount = Number(input.amount);
  const type = input.type as TransactionType;

  if (!description || description.length > 200) {
    throw new Error(
      'La descripción es obligatoria y admite hasta 200 caracteres.',
    );
  }
  if (!category || category.length > 100) {
    throw new Error(
      'La categoría es obligatoria y admite hasta 100 caracteres.',
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El valor debe ser un número mayor que cero.');
  }
  if (type !== 'income' && type !== 'expensive' && type !== 'saving') {
    throw new Error('El tipo de movimiento no es válido.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    throw new Error('La fecha del movimiento no es válida.');
  }

  return {
    operation: 'create',
    description,
    category,
    amount,
    date: transactionDate,
    type_income_expense: type,
  };
}
