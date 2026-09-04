'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  SnapshotHistoryPoint,
  SnapshotItemHistory,
} from '@/lib/snapshot-history';

export type SnapshotHistoryResponse = {
  currencies: string[];
  general: Record<string, SnapshotHistoryPoint[]>;
  items: SnapshotItemHistory[];
  row_count: number;
  error?: string;
};

const compact = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const dateLabel = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('es-CO', {
    month: 'short',
    year: 'numeric',
  });
const money = (value: number, currency: string) =>
  Number(value).toLocaleString('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });

export function SnapshotHistoryCharts({
  data,
  loading,
  error,
}: {
  data?: SnapshotHistoryResponse;
  loading: boolean;
  error: string;
}) {
  const [currency, setCurrency] = useState('COP');
  const [itemKey, setItemKey] = useState('');
  const activeCurrency = data?.currencies.includes(currency)
    ? currency
    : data?.currencies[0] ?? '';
  const activeItem = useMemo(
    () => data?.items.find((item) => item.key === itemKey) ?? data?.items[0],
    [data, itemKey],
  );
  const groupedItems = useMemo(
    () => ({
      asset: data?.items.filter((item) => item.kind === 'asset') ?? [],
      liability: data?.items.filter((item) => item.kind === 'liability') ?? [],
    }),
    [data],
  );

  if (loading)
    return <div className="loading-state">Construyendo histórico patrimonial…</div>;
  if (error) return <div className="alert error" role="alert">{error}</div>;
  if (!data?.row_count)
    return <div className="empty-state">No hay valoraciones para construir el histórico patrimonial.</div>;

  const generalSeries = data.general[activeCurrency] ?? [];

  return (
    <div className="snapshot-history-grid">
      <section className="panel history-panel">
        <div className="history-heading">
          <div>
            <h2>Histórico general</h2>
            <p>Evolución de activos, pasivos y patrimonio usando la última valoración conocida.</p>
          </div>
          <label>
            Moneda
            <select value={activeCurrency} onChange={(event) => setCurrency(event.target.value)}>
              {data.currencies.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="snapshot-history-chart" style={{ height: 360, minHeight: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={generalSeries} margin={{ top: 15, right: 24, bottom: 5, left: 5 }}>
              <CartesianGrid stroke="#e8ebf0" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={dateLabel} axisLine={false} tickLine={false} minTickGap={28} fontSize={11} />
              <YAxis tickFormatter={(value) => compact.format(Number(value))} axisLine={false} tickLine={false} width={62} fontSize={11} />
              <Tooltip labelFormatter={(value) => dateLabel(String(value))} formatter={(value, name) => [money(Number(value), activeCurrency), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Line type="monotone" dataKey="assets" name="Activos" stroke="#12a66a" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="liabilities" name="Pasivos" stroke="#e0524d" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="net" name="Patrimonio" stroke="#3157d5" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel history-panel">
        <div className="history-heading">
          <div>
            <h2>Histórico por activo o pasivo</h2>
            <p>Consulta cómo ha cambiado la valoración de cada elemento individual.</p>
          </div>
          <label>
            Registro
            <select value={activeItem?.key ?? ''} onChange={(event) => setItemKey(event.target.value)}>
              {groupedItems.asset.length ? (
                <optgroup label="Activos">
                  {groupedItems.asset.map((item) => <option key={item.key} value={item.key}>{item.name} · {item.currency}</option>)}
                </optgroup>
              ) : null}
              {groupedItems.liability.length ? (
                <optgroup label="Pasivos">
                  {groupedItems.liability.map((item) => <option key={item.key} value={item.key}>{item.name} · {item.currency}</option>)}
                </optgroup>
              ) : null}
            </select>
          </label>
        </div>
        {activeItem ? (
          <>
            <div className="snapshot-item-context">
              <span className={`type-badge ${activeItem.kind === 'asset' ? 'income' : 'expensive'}`}>
                {activeItem.kind === 'asset' ? 'Activo' : 'Pasivo'}
              </span>
              <strong>{activeItem.name}</strong>
              <span>{activeItem.category}</span>
              <span>{activeItem.institution || 'Sin institución'} · {activeItem.currency}</span>
            </div>
            <div className="snapshot-history-chart" style={{ height: 320, minHeight: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeItem.series} margin={{ top: 15, right: 24, bottom: 5, left: 5 }}>
                  <CartesianGrid stroke="#e8ebf0" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={dateLabel} axisLine={false} tickLine={false} minTickGap={28} fontSize={11} />
                  <YAxis tickFormatter={(value) => compact.format(Number(value))} axisLine={false} tickLine={false} width={62} fontSize={11} />
                  <Tooltip labelFormatter={(value) => dateLabel(String(value))} formatter={(value) => [money(Number(value), activeItem.currency), 'Valor']} />
                  <Line type="monotone" dataKey="amount" name="Valor" stroke={activeItem.kind === 'asset' ? '#12a66a' : '#e0524d'} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {activeItem.series.length === 1 ? <p className="history-note">Este registro solo tiene una valoración. La línea aparecerá cuando existan nuevas fechas para el mismo elemento.</p> : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
