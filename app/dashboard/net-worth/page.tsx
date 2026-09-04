'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardNav } from '../dashboard-nav';
import type { Snapshot, SnapshotKind } from '@/lib/types';
import {
  SnapshotHistoryCharts,
  type SnapshotHistoryResponse,
} from './snapshot-history-charts';

type ApiResponse = {
  rows: Snapshot[];
  row_count: number;
  categories: string[];
  currencies: string[];
  error?: string;
};

type FormValues = {
  snapshot_date: string;
  name: string;
  kind: SnapshotKind;
  category: string;
  amount: string;
  currency: string;
  institution: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): FormValues => ({
  snapshot_date: today(),
  name: '',
  kind: 'asset',
  category: '',
  amount: '',
  currency: 'COP',
  institution: '',
  notes: '',
});
const money = (value: number, currency: string) =>
  Number(value).toLocaleString('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });
const date = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('es-CO');

export default function NetWorthPage() {
  const [rows, setRows] = useState<Snapshot[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [kind, setKind] = useState<'' | SnapshotKind>('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [history, setHistory] = useState<SnapshotHistoryResponse>();
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (kind) params.set('kind', kind);
      if (category) params.set('category', category);
      const response = await fetch(`/api/snapshots?${params}`);
      const body = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(body.error);
      setRows(body.rows);
      setCategories(body.categories);
      setCurrencies(body.currencies);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar el patrimonio.');
    } finally {
      setLoading(false);
    }
  }, [category, kind]);

  useEffect(() => { void load(); }, [load]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await fetch('/api/snapshot-history');
      const body = await response.json() as SnapshotHistoryResponse;
      if (!response.ok) throw new Error(body.error);
      setHistory(body);
    } catch (requestError) {
      setHistoryError(requestError instanceof Error ? requestError.message : 'No fue posible cargar el histórico patrimonial.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const totals = useMemo(() => rows.reduce<Record<string, { assets: number; liabilities: number }>>(
    (all, row) => {
      const bucket = all[row.currency] ??= { assets: 0, liabilities: 0 };
      bucket[row.kind === 'asset' ? 'assets' : 'liabilities'] += Number(row.amount);
      return all;
    },
    {},
  ), [rows]);

  function openCreate() {
    setEditingId(undefined);
    setForm(emptyForm());
    setError('');
    setFormOpen(true);
  }

  function openEdit(row: Snapshot) {
    setEditingId(row.item_id);
    setForm({
      snapshot_date: row.snapshot_date,
      name: row.name,
      kind: row.kind,
      category: row.category,
      amount: String(row.amount),
      currency: row.currency,
      institution: row.institution ?? '',
      notes: row.notes ?? '',
    });
    setError('');
    setFormOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(editingId ? `/api/snapshots/${editingId}` : '/api/snapshots', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), currency: form.currency.toUpperCase() }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error);
      setFormOpen(false);
      setMessage(editingId ? 'Registro patrimonial actualizado.' : 'Registro patrimonial creado.');
      await Promise.all([load(), loadHistory()]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible guardar el registro.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header movements-header">
        <div>
          <p className="eyebrow">Finanzas personales</p>
          <h1>Activos y pasivos</h1>
          <p className="subtitle">Administra las valoraciones que componen tu patrimonio.</p>
        </div>
        <button className="primary-button" onClick={openCreate}>+ Nuevo registro</button>
      </header>

      <DashboardNav />

      <section className="filter-panel asset-filters">
        <div className="filter-control">
          <span>Tipo</span>
          <div className="type-filter" aria-label="Filtrar por tipo patrimonial">
            <button className={!kind ? 'active' : ''} onClick={() => setKind('')}>Todos</button>
            <button className={kind === 'asset' ? 'active income' : ''} onClick={() => setKind('asset')}>Activos</button>
            <button className={kind === 'liability' ? 'active expense' : ''} onClick={() => setKind('liability')}>Pasivos</button>
          </div>
        </div>
        <label className="category-filter">
          Categoría
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="clear-filters" onClick={() => { setKind(''); setCategory(''); }}>Limpiar filtros</button>
      </section>

      {error && !formOpen ? <div className="alert error" role="alert">{error}</div> : null}
      {message ? <div className="alert success" role="status">{message}</div> : null}

      <div className="cards asset-summary">
        {Object.entries(totals).length ? Object.entries(totals).map(([currency, value]) => (
          <section className="card" key={currency}>
            <span>Patrimonio visible · {currency}</span>
            <strong>{money(value.assets - value.liabilities, currency)}</strong>
            <p>Activos {money(value.assets, currency)} · Pasivos {money(value.liabilities, currency)}</p>
          </section>
        )) : <section className="card"><span>Patrimonio visible</span><strong>Sin datos</strong></section>}
      </div>

      <SnapshotHistoryCharts
        data={history}
        loading={historyLoading}
        error={historyError}
      />

      <section className="panel">
        <div className="panel-heading"><h2>Detalle patrimonial</h2><span>{rows.length} registros</span></div>
        {loading ? <div className="loading-state borderless">Cargando activos y pasivos…</div> : (
          <div className="table-wrap">
            <table className="assets-table">
              <thead><tr><th>Fecha</th><th>Nombre</th><th>Tipo</th><th>Categoría</th><th>Institución</th><th>Moneda</th><th className="numeric">Valor</th><th aria-label="Acciones" /></tr></thead>
              <tbody>
                {rows.length ? rows.map((row) => (
                  <tr key={row.item_id}>
                    <td className="nowrap">{date(row.snapshot_date)}</td>
                    <td><span className="strong">{row.name}</span>{row.notes ? <small className="table-note">{row.notes}</small> : null}</td>
                    <td><span className={`type-badge ${row.kind === 'asset' ? 'income' : 'expensive'}`}>{row.kind === 'asset' ? 'Activo' : 'Pasivo'}</span></td>
                    <td>{row.category}</td>
                    <td>{row.institution || '—'}</td>
                    <td><span className="currency-badge">{row.currency}</span></td>
                    <td className={`numeric strong ${row.kind === 'asset' ? 'positive' : 'negative'}`}>{money(Number(row.amount), row.currency)}</td>
                    <td><div className="row-actions"><button onClick={() => openEdit(row)}>Editar</button></div></td>
                  </tr>
                )) : <tr><td colSpan={8} className="empty-cell">No hay activos o pasivos con estos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="snapshot-form-title">
            <div className="modal-heading">
              <div><p className="eyebrow">Patrimonio</p><h2 id="snapshot-form-title">{editingId ? 'Editar activo o pasivo' : 'Nuevo activo o pasivo'}</h2></div>
              <button className="close-button" aria-label="Cerrar" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <form className="transaction-form" onSubmit={save}>
              <label>Tipo<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as SnapshotKind })}><option value="asset">Activo</option><option value="liability">Pasivo</option></select></label>
              <label>Fecha de valoración<input type="date" required value={form.snapshot_date} onChange={(event) => setForm({ ...form, snapshot_date: event.target.value })} /></label>
              <label className="full-field">Nombre<input required maxLength={160} placeholder="Ej. Cuenta de ahorros" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Categoría<input required maxLength={100} list="snapshot-categories" placeholder="Ej. savings" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /><datalist id="snapshot-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist></label>
              <label>Institución<input maxLength={160} placeholder="Ej. Bancolombia" value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })} /></label>
              <label>Valor<input type="number" required min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
              <label>Moneda<input required minLength={3} maxLength={10} list="snapshot-currencies" placeholder="COP" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /><datalist id="snapshot-currencies">{currencies.map((item) => <option key={item} value={item} />)}</datalist></label>
              <label className="full-field">Notas<textarea maxLength={500} rows={3} placeholder="Información opcional" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
              {error ? <div className="alert error full-field" role="alert">{error}</div> : null}
              <div className="modal-actions full-field"><button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear registro'}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
