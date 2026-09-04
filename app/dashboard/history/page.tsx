'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
import { currentYearDateRange } from '@/lib/date-range';
import { buildMonthlyComparison } from '@/lib/monthly-comparison';

type MonthRow = { month: string; values: Record<string, number> };
type HistoryGroup = { categories: string[]; series: MonthRow[] };
type HistoryResponse = {
  months: string[];
  income: HistoryGroup;
  expense: HistoryGroup;
  saving: HistoryGroup;
  row_count: number;
  date_range: { from: string | null; to: string | null };
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
  tone: 'income' | 'expense' | 'saving';
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
        <div className="history-chart" style={{ height: 390, minHeight: 390 }}>
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
                  formatter={(value) => [
                    money(Number(value)),
                    selectedCategory,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey={(row: MonthRow) => row.values[selectedCategory] ?? 0}
                  name={selectedCategory}
                  stroke={
                    tone === 'income'
                      ? '#12a66a'
                      : tone === 'saving'
                        ? '#3157d5'
                        : '#e0524d'
                  }
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
                <CartesianGrid
                  stroke="#e8ebf0"
                  strokeDasharray="3 3"
                  vertical={false}
                />
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
                  formatter={(value, name) => [
                    money(Number(value)),
                    String(name),
                  ]}
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

function MonthlyComparisonChart({ data }: { data: HistoryResponse }) {
  const series = useMemo(
    () =>
      buildMonthlyComparison(
        data.months,
        data.income.series,
        data.expense.series,
        data.saving.series,
      ),
    [data],
  );

  return (
    <section className="panel history-panel monthly-comparison-panel">
      <div className="history-heading">
        <div>
          <h2>Ingresos, gastos y ahorros por mes</h2>
          <p>
            Comparación mensual de todos los tipos de movimiento registrados.
          </p>
        </div>
      </div>
      {series.length ? (
        <div
          className="history-chart monthly-comparison-chart"
          style={{ height: 390, minHeight: 390 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={series}
              margin={{ top: 15, right: 20, bottom: 5, left: 5 }}
              barGap={4}
            >
              <CartesianGrid
                stroke="#e8ebf0"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
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
                formatter={(value, name) => [
                  money(Number(value)),
                  String(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar
                dataKey="income"
                name="Ingresos"
                fill="#12a66a"
                radius={[5, 5, 0, 0]}
                maxBarSize={38}
              />
              <Bar
                dataKey="expense"
                name="Gastos"
                fill="#e0524d"
                radius={[5, 5, 0, 0]}
                maxBarSize={38}
              />
              <Bar
                dataKey="saving"
                name="Ahorros"
                fill="#3157d5"
                radius={[5, 5, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-state compact">
          No hay movimientos para construir esta gráfica.
        </div>
      )}
    </section>
  );
}

export default function HistoryPage() {
  const [data, setData] = useState<HistoryResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState(currentYearDateRange);
  const [appliedRange, setAppliedRange] = useState(currentYearDateRange);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          date_from: appliedRange.from,
          date_to: appliedRange.to,
        });
        const response = await fetch(`/api/transaction-history?${params}`);
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
  }, [appliedRange]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedRange({ ...range });
  };

  const resetCurrentYear = () => {
    const nextRange = currentYearDateRange();
    setRange(nextRange);
    setAppliedRange(nextRange);
  };

  const totals = useMemo(() => {
    const total = (group?: HistoryGroup) =>
      group?.series.reduce(
        (all, row) =>
          all +
          Object.values(row.values).reduce(
            (sum, value) => sum + Number(value),
            0,
          ),
        0,
      ) ?? 0;
    return {
      income: total(data?.income),
      expense: total(data?.expense),
      saving: total(data?.saving),
    };
  }, [data]);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Finanzas personales</p>
          <h1>Histórico</h1>
          <p className="subtitle">
            Evolución mensual de tus ingresos, gastos y ahorros por categoría.
          </p>
        </div>
      </header>
      <DashboardNav />

      <section className="filter-panel history-date-filter">
        <form className="filters" onSubmit={submit}>
          <label>
            Desde
            <input
              type="date"
              required
              value={range.from}
              max={range.to}
              onChange={(event) =>
                setRange({ ...range, from: event.target.value })
              }
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              required
              value={range.to}
              min={range.from}
              onChange={(event) =>
                setRange({ ...range, to: event.target.value })
              }
            />
          </label>
          <button className="primary-button" disabled={loading}>
            {loading ? 'Cargando…' : 'Aplicar periodo'}
          </button>
          <button
            type="button"
            className="clear-filters"
            onClick={resetCurrentYear}
          >
            Año actual
          </button>
        </form>
      </section>

      {loading ? (
        <div className="loading-state">Construyendo histórico financiero…</div>
      ) : error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : data ? (
        <>
          <div className="cards history-summary four-cards">
            <section className="card">
              <span>Ingresos históricos</span>
              <strong className="positive">{money(totals.income)}</strong>
            </section>
            <section className="card">
              <span>Gastos históricos</span>
              <strong className="negative">{money(totals.expense)}</strong>
            </section>
            <section className="card">
              <span>Ahorros históricos</span>
              <strong className="saving-value">{money(totals.saving)}</strong>
            </section>
            <section className="card">
              <span>Movimientos analizados</span>
              <strong>{data.row_count.toLocaleString('es-CO')}</strong>
              <p>
                {data.months.length} meses con información · {appliedRange.from}{' '}
                a {appliedRange.to}
              </p>
            </section>
          </div>
          <MonthlyComparisonChart data={data} />
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
          <HistoryChart
            title="Histórico de ahorros"
            description="Composición mensual de los ahorros"
            group={data.saving}
            tone="saving"
          />
        </>
      ) : null}
    </main>
  );
}
