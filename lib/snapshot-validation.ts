import type { ProposedSnapshotChange, SnapshotFields, SnapshotKind } from '@/lib/types';

type SnapshotInput = Record<string, unknown>;
const snapshotFields = [
  'snapshot_date', 'name', 'kind', 'category', 'amount', 'currency', 'institution', 'notes',
];

export function parseSnapshotFields(input: SnapshotInput, allowedExtras: string[] = []): SnapshotFields {
  if (Object.keys(input).some((key) => !snapshotFields.includes(key) && !allowedExtras.includes(key)))
    throw new Error('El registro patrimonial contiene campos no permitidos.');
  const snapshot_date = String(input.snapshot_date ?? '');
  const name = String(input.name ?? '').trim();
  const kind = input.kind as SnapshotKind;
  const category = String(input.category ?? '').trim();
  const amount = Number(input.amount);
  const currency = String(input.currency ?? '').trim().toUpperCase();
  const institution = String(input.institution ?? '').trim() || null;
  const notes = String(input.notes ?? '').trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot_date))
    throw new Error('La fecha de valoración no es válida.');
  if (!name || name.length > 160)
    throw new Error('El nombre es obligatorio y admite hasta 160 caracteres.');
  if (kind !== 'asset' && kind !== 'liability')
    throw new Error('El tipo debe ser activo o pasivo.');
  if (!category || category.length > 100)
    throw new Error('La categoría es obligatoria y admite hasta 100 caracteres.');
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error('El valor debe ser un número igual o mayor que cero.');
  if (!/^[A-Z]{3,10}$/.test(currency))
    throw new Error('La moneda debe contener entre 3 y 10 letras, por ejemplo COP o USD.');
  if (institution && institution.length > 160)
    throw new Error('La institución admite hasta 160 caracteres.');
  if (notes && notes.length > 500)
    throw new Error('Las notas admiten hasta 500 caracteres.');

  return { snapshot_date, name, kind, category, amount, currency, institution, notes };
}

export function parseProposedSnapshotChange(input: SnapshotInput): ProposedSnapshotChange {
  const allowed = ['operation', 'target_item_id', ...snapshotFields];
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new Error('El cambio patrimonial contiene campos no permitidos.');
  const operation = input.operation;
  if (operation !== 'create' && operation !== 'edit')
    throw new Error('La operación debe ser create o edit.');
  const target_item_id = String(input.target_item_id ?? '').trim() || undefined;
  if (operation === 'edit' && !target_item_id)
    throw new Error('Falta target_item_id para modificar el activo o pasivo.');
  return {
    entity: 'snapshot',
    operation,
    target_item_id,
    ...parseSnapshotFields(input, ['operation', 'target_item_id']),
  };
}
