'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardNav } from '../dashboard-nav';
import type { Transaction, TransactionType } from '@/lib/types';

type ApiResponse = {
  rows: Transaction[];
  row_count: number;
  categories: string[];
  error?: string;
};

type FormValues = {
  description: string;
  type: TransactionType;
  amount: string;
  category: string;
  transaction_date: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const localDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const defaultDateRange = () => {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: localDate(from), to: localDate(to) };
};
const emptyForm = (): FormValues => ({
  description: '',
  type: 'income',
  amount: '',
  category: '',
  transaction_date: today(),
});
const money = (value: number) =>
  Number(value).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  });
const date = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('es-CO');

export default function MovementsPage() {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [type, setType] = useState<'' | TransactionType>('');
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState(() => defaultDateRange().from);
  const [dateTo, setDateTo] = useState(() => defaultDateRange().to);
  const [sort, setSort] = useState<{
    field: 'date' | 'amount';
    direction: 'asc' | 'desc';
  }>({ field: 'date', direction: 'desc' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<FormValues>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    try {
      const response = await fetch(`/api/transactions?${params}`);
      const body = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(body.error);
      setRows(body.rows);
      setCategories(body.categories);
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.message
          ? requestError.message
          : 'No fue posible cargar los movimientos.',
      );
    } finally {
      setLoading(false);
    }
  }, [category, dateFrom, dateTo, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (all, row) => {
          all[row.type] += Number(row.amount);
          return all;
        },
        { income: 0, expensive: 0 },
      ),
    [rows],
  );
  const sortedRows = useMemo(
    () =>
      [...rows].sort((left, right) => {
        const comparison =
          sort.field === 'amount'
            ? Number(left.amount) - Number(right.amount)
            : left.transaction_date.localeCompare(right.transaction_date);
        if (comparison !== 0)
          return sort.direction === 'asc' ? comparison : -comparison;
        return right.transaction_date.localeCompare(left.transaction_date);
      }),
    [rows, sort],
  );

  function sortByAmount() {
    setSort((current) => ({
      field: 'amount',
      direction:
        current.field === 'amount' && current.direction === 'desc'
          ? 'asc'
          : 'desc',
    }));
  }

  function sortByDate() {
    setSort({ field: 'date', direction: 'desc' });
  }

  function openCreate() {
    setEditingId(undefined);
    setForm(emptyForm());
    setError('');
    setFormOpen(true);
  }

  function openEdit(row: Transaction) {
    setEditingId(row.transaction_id);
    setForm({
      description: row.description,
      type: row.type,
      amount: String(row.amount),
      category: row.category,
      transaction_date: row.transaction_date,
    });
    setError('');
    setFormOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        editingId ? `/api/transactions/${editingId}` : '/api/transactions',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...form, amount: Number(form.amount) }),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error);
      setFormOpen(false);
      setMessage(editingId ? 'Movimiento actualizado.' : 'Movimiento creado.');
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.message
          ? requestError.message
          : 'No fue posible guardar el movimiento.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Transaction) {
    if (!window.confirm(`¿Eliminar “${row.description}”? Esta acción no se puede deshacer.`)) return;
    setError('');
    try {
      const response = await fetch(`/api/transactions/${row.transaction_id}`, {
        method: 'DELETE',
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error);
      setMessage('Movimiento eliminado.');
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error && requestError.message
          ? requestError.message
          : 'No fue posible eliminar el movimiento.',
      );
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header movements-header">
        <div>
          <p className="eyebrow">Finanzas personales</p>
          <h1>Ingresos y gastos</h1>
          <p className="subtitle">Consulta y administra todos tus movimientos.</p>
        </div>
        <button className="primary-button" onClick={openCreate}>
          + Nuevo movimiento
        </button>
      </header>

      <DashboardNav />

      <section className="filter-panel movement-filters">
        <div className="filter-control type-filter-control">
          <span>Tipo</span>
          <div className="type-filter" aria-label="Filtrar por tipo">
            <button className={!type ? 'active' : ''} onClick={() => setType('')}>
              Todos
            </button>
            <button
              className={type === 'income' ? 'active income' : ''}
              onClick={() => setType('income')}
            >
              Ingresos
            </button>
            <button
              className={type === 'expensive' ? 'active expense' : ''}
              onClick={() => setType('expensive')}
            >
              Gastos
            </button>
          </div>
        </div>
        <div className="movement-filter-fields">
          <label className="category-filter">
            Categoría
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="date-filter">
            Desde
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className="date-filter">
            Hasta
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
          {type || category || dateFrom || dateTo ? (
            <div className="filter-control clear-filter-control">
              <span aria-hidden="true">&nbsp;</span>
              <button
                className="clear-filters"
                onClick={() => {
                setType('');
                setCategory('');
                const range = defaultDateRange();
                setDateFrom(range.from);
                setDateTo(range.to);
                setSort({ field: 'date', direction: 'desc' });
                }}
              >
                Limpiar filtros
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {error && !formOpen ? <div className="alert error" role="alert">{error}</div> : null}
      {message ? <div className="alert success" role="status">{message}</div> : null}

      <div className="cards movement-summary">
        <section className="card"><span>Ingresos visibles</span><strong className="positive">{money(totals.income)}</strong></section>
        <section className="card"><span>Gastos visibles</span><strong className="negative">{money(totals.expensive)}</strong></section>
        <section className="card"><span>Balance visible</span><strong>{money(totals.income - totals.expensive)}</strong></section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Detalle de movimientos</h2>
          <span>{rows.length} registros</span>
        </div>
        {loading ? (
          <div className="loading-state borderless">Cargando movimientos…</div>
        ) : (
          <div className="table-wrap">
            <table className="movements-table">
              <thead><tr><th><button className={`sort-button ${sort.field === 'date' ? 'active' : ''}`} onClick={sortByDate}>Fecha <span aria-hidden="true">{sort.field === 'date' ? '↓' : ''}</span></button></th><th>Descripción</th><th>Tipo</th><th>Categoría</th><th className="numeric"><button className={`sort-button ${sort.field === 'amount' ? 'active' : ''}`} onClick={sortByAmount}>Valor <span aria-hidden="true">{sort.field === 'amount' ? (sort.direction === 'desc' ? '↓' : '↑') : '↕'}</span></button></th><th aria-label="Acciones" /></tr></thead>
              <tbody>
                {sortedRows.length ? sortedRows.map((row) => (
                  <tr key={row.transaction_id}>
                    <td className="nowrap">{date(row.transaction_date)}</td>
                    <td className="strong">{row.description}</td>
                    <td><span className={`type-badge ${row.type}`}>{row.type === 'income' ? 'Ingreso' : 'Gasto'}</span></td>
                    <td>{row.category}</td>
                    <td className={`numeric strong ${row.type === 'income' ? 'positive' : 'negative'}`}>{money(Number(row.amount))}</td>
                    <td><div className="row-actions"><button onClick={() => openEdit(row)}>Editar</button><button className="delete" onClick={() => void remove(row)}>Eliminar</button></div></td>
                  </tr>
                )) : <tr><td colSpan={6} className="empty-cell">No hay movimientos con estos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="movement-form-title">
            <div className="modal-heading">
              <div><p className="eyebrow">Movimiento</p><h2 id="movement-form-title">{editingId ? 'Editar movimiento' : 'Nuevo movimiento'}</h2></div>
              <button className="close-button" aria-label="Cerrar" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <form className="transaction-form" onSubmit={save}>
              <label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as TransactionType })}><option value="income">Ingreso</option><option value="expensive">Gasto</option></select></label>
              <label>Fecha<input type="date" required value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} /></label>
              <label className="full-field">Descripción<input required maxLength={200} placeholder="Ej. Pago de nómina" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label>Categoría<input required maxLength={100} list="movement-categories" placeholder="Ej. Salario" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /><datalist id="movement-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist></label>
              <label>Valor (COP)<input type="number" required min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
              {error ? <div className="alert error full-field" role="alert">{error}</div> : null}
              <div className="modal-actions full-field"><button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear movimiento'}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
