'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardNav } from '../dashboard-nav';

type MonthRow = { month: string; values: Record<string, number> };
type HistoryGroup = { categories: string[]; series: MonthRow[] };
type HistoryResponse = {
  months: string[];
  income: HistoryGroup;
  expense: HistoryGroup;
  row_count: number;
  error?: string;
};

const colors = [
  '#3157d5',
  '#12a66a',
  '#f79009',
  '#9b51e0',
  '#e0524d',
  '#06aed4',
  '#7f8c35',
  '#d14f9b',
];
const money = (value: number) =>
  Number(value).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
const compact = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const monthLabel = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1)
    .toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
    .replace('.', '');
};

function HistoryChart({
  title,
  description,
  group,
  tone,
}: {
  title: string;
  description: string;
  group: HistoryGroup;
  tone: 'income' | 'expense';
}) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const topCategories = useMemo(() => {
    const totals = new Map<string, number>();
    group.series.forEach((row) =>
      Object.entries(row.values).forEach(([category, amount]) =>
        totals.set(category, (totals.get(category) ?? 0) + Number(amount)),
      ),
    );
    return [...totals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([category]) => category);
  }, [group]);
  const visibleCategories = selectedCategory
    ? [selectedCategory]
    : topCategories;

  return (
    <section className="panel history-panel">
      <div className="history-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <label>
          Categoría
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <option value="">Principales categorías</option>
            {group.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>
      {group.series.length && visibleCategories.length ? (
        <div
          className="history-chart"
          style={{ height: 390, minHeight: 390 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            {selectedCategory ? (
              <LineChart
                data={group.series}
                margin={{ top: 15, right: 20, bottom: 5, left: 5 }}
              >
                <CartesianGrid stroke="#e8ebf0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                  fontSize={11}
                />
                <YAxis
                  tickFormatter={(value) => compact.format(Number(value))}
                  axisLine={false}
                  tickLine={false}
                  width={58}
                  fontSize={11}
                />
                <Tooltip
                  labelFormatter={(value) => monthLabel(String(value))}
                  formatter={(value) => [money(Number(value)), selectedCategory]}
                />
                <Line
                  type="monotone"
                  dataKey={(row: MonthRow) => row.values[selectedCategory] ?? 0}
                  name={selectedCategory}
                  stroke={tone === 'income' ? '#12a66a' : '#e0524d'}
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            ) : (
              <BarChart
                data={group.series}
                margin={{ top: 15, right: 20, bottom: 5, left: 5 }}
              >
                <CartesianGrid stroke="#e8ebf0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                  fontSize={11}
                />
                <YAxis
                  tickFormatter={(value) => compact.format(Number(value))}
                  axisLine={false}
                  tickLine={false}
                  width={58}
                  fontSize={11}
                />
                <Tooltip
                  labelFormatter={(value) => monthLabel(String(value))}
                  formatter={(value, name) => [money(Number(value)), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                {visibleCategories.map((category, index) => (
                  <Bar
                    key={category}
                    dataKey={(row: MonthRow) => row.values[category] ?? 0}
                    name={category}
                    stackId="categories"
                    fill={colors[index % colors.length]}
                    maxBarSize={42}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-state compact">
          No hay movimientos para construir esta gráfica.
        </div>
      )}
      {!selectedCategory && group.categories.length > topCategories.length ? (
        <p className="history-note">
          Se muestran las 8 categorías de mayor valor. Selecciona cualquier
          categoría para consultar su histórico completo.
        </p>
      ) : null}
    </section>
  );
}

export default function HistoryPage() {
  const [data, setData] = useState<HistoryResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/transaction-history');
        const body = (await response.json()) as HistoryResponse;
        if (!response.ok) throw new Error(body.error);
        setData(body);
      } catch (requestError) {
        setError(
          requestError instanceof Error && requestError.message
            ? requestError.message
            : 'No fue posible cargar el histórico.',
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const totals = useMemo(() => {
    const total = (group?: HistoryGroup) =>
      group?.series.reduce(
        (all, row) =>
          all + Object.values(row.values).reduce((sum, value) => sum + Number(value), 0),
        0,
      ) ?? 0;
    return { income: total(data?.income), expense: total(data?.expense) };
  }, [data]);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Finanzas personales</p>
          <h1>Histórico</h1>
          <p className="subtitle">
            Evolución mensual de tus ingresos y gastos por categoría.
          </p>
        </div>
      </header>
      <DashboardNav />

      {loading ? (
        <div className="loading-state">Construyendo histórico financiero…</div>
      ) : error ? (
        <div className="alert error" role="alert">{error}</div>
      ) : data ? (
        <>
          <div className="cards history-summary">
            <section className="card"><span>Ingresos históricos</span><strong className="positive">{money(totals.income)}</strong></section>
            <section className="card"><span>Gastos históricos</span><strong className="negative">{money(totals.expense)}</strong></section>
            <section className="card"><span>Movimientos analizados</span><strong>{data.row_count.toLocaleString('es-CO')}</strong><p>{data.months.length} meses con información</p></section>
          </div>
          <HistoryChart
            title="Histórico de ingresos"
            description="Composición mensual de los ingresos"
            group={data.income}
            tone="income"
          />
          <HistoryChart
            title="Histórico de gastos"
            description="Composición mensual de los gastos"
            group={data.expense}
            tone="expense"
          />
        </>
      ) : null}
    </main>
  );
}
