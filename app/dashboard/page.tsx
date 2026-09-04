'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardNav } from './dashboard-nav';

type CurrencyTotal = { total_assets: number; total_liabilities: number };
type CategoryRow = { category: string; amount: number; currency: string };
type SpendingRow = { category: string; amount: number };
type Rate = { currency: string; rate_to_cop: number; effective_date: string };
type Metrics = {
  net_worth: {
    by_currency: Record<string, CurrencyTotal>;
    converted_cop: {
      total_assets: number;
      total_liabilities: number;
      net: number;
    };
    rates_used: Rate[];
    unconverted_currencies: string[];
  };
  assets_by_category: CategoryRow[];
  liabilities_by_category: CategoryRow[];
  income_vs_expense: { income: number; expense: number; saving: number };
  income_by_category: SpendingRow[];
  spending_by_category: SpendingRow[];
  savings_by_category: SpendingRow[];
  has_data: boolean;
};

const number = (value: number) =>
  value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
const label = (value: string) =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function CategoryTable({
  title,
  rows,
}: {
  title: string;
  rows: CategoryRow[];
}) {
  const grouped = useMemo(() => {
    const totals = new Map<string, CategoryRow>();
    rows.forEach((row) => {
      const key = `${row.category}:${row.currency}`;
      const current = totals.get(key);
      totals.set(key, {
        ...row,
        amount: (current?.amount ?? 0) + Number(row.amount),
      });
    });
    return [...totals.values()].sort((a, b) => b.amount - a.amount);
  }, [rows]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span>{grouped.length} categorías</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Moneda</th>
              <th className="numeric">Valor</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length ? (
              grouped.map((row) => (
                <tr key={`${row.category}:${row.currency}`}>
                  <td>{label(row.category)}</td>
                  <td>
                    <span className="currency-badge">{row.currency}</span>
                  </td>
                  <td className="numeric">{number(row.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="empty-cell">
                  Sin registros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CategoryChart({
  title,
  subtitle,
  rows,
  color,
}: {
  title: string;
  subtitle: string;
  rows: SpendingRow[];
  color: string;
}) {
  const chartData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .map((row) => ({
          ...row,
          categoryLabel: label(row.category),
          amount: Number(row.amount),
        })),
    [rows],
  );
  const height = Math.max(260, chartData.length * 42 + 55);

  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
      {chartData.length ? (
        <div className="category-chart" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 30, bottom: 8, left: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#e8ebf0"
              />
              <XAxis
                type="number"
                tickFormatter={(value) => number(Number(value))}
                axisLine={false}
                tickLine={false}
                fontSize={11}
              />
              <YAxis
                dataKey="categoryLabel"
                type="category"
                width={125}
                axisLine={false}
                tickLine={false}
                fontSize={12}
              />
              <Tooltip
                formatter={(value) => [`${number(Number(value))} COP`, 'Total']}
                cursor={{ fill: '#f6f8fc' }}
              />
              <Bar
                dataKey="amount"
                fill={color}
                radius={[0, 7, 7, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-state compact">
          Sin movimientos para este periodo.
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Metrics>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: '', to: '' });
  const load = async (from = range.from, to = range.to) => {
    setError('');
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    try {
      const response = await fetch(`/api/dashboard-metrics?${params}`);
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setError('No fue posible cargar tus métricas. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load('', '');
  }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load();
  };

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Finanzas personales</p>
          <h1>Dashboard</h1>
          <p className="subtitle">
            Una vista clara de tu patrimonio, ingresos, gastos y ahorros.
          </p>
        </div>
        <div className="header-actions">
          <Link className="secondary-button" href="/dashboard/settings">
            Administrar tasas
          </Link>
          <form action="/auth/signout" method="post">
            <button className="ghost-button">Cerrar sesión</button>
          </form>
        </div>
      </header>
      <DashboardNav />
      <section className="filter-panel">
        <form onSubmit={submit} className="filters">
          <label>
            Desde
            <input
              type="date"
              value={range.from}
              onChange={(event) =>
                setRange({ ...range, from: event.target.value })
              }
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={range.to}
              onChange={(event) =>
                setRange({ ...range, to: event.target.value })
              }
            />
          </label>
          <button className="primary-button" disabled={loading}>
            {loading ? 'Cargando…' : 'Aplicar filtros'}
          </button>
        </form>
      </section>
      {error ? (
        <div className="alert error" role="alert">
          {error}
        </div>
      ) : null}
      {loading && !data ? (
        <div className="loading-state">Cargando métricas financieras…</div>
      ) : data && !data.has_data ? (
        <div className="empty-state">
          <h2>No hay datos</h2>
          <p>No encontramos movimientos para este rango de fechas.</p>
        </div>
      ) : data ? (
        <>
          <div className="cards metric-grid">
            <section className="card featured-card">
              <span>Patrimonio neto</span>
              <strong>
                {number(data.net_worth.converted_cop.net)} <small>COP</small>
              </strong>
              <p>
                Activos {number(data.net_worth.converted_cop.total_assets)} ·
                Pasivos {number(data.net_worth.converted_cop.total_liabilities)}
              </p>
            </section>
            <section className="card">
              <span>Ingresos</span>
              <strong className="positive">
                {number(data.income_vs_expense.income)}
              </strong>
              <p>COP en el periodo</p>
            </section>
            <section className="card">
              <span>Gastos</span>
              <strong className="negative">
                {number(data.income_vs_expense.expense)}
              </strong>
              <p>COP en el periodo</p>
            </section>
            <section className="card">
              <span>Ahorros</span>
              <strong className="saving-value">
                {number(data.income_vs_expense.saving)}
              </strong>
              <p>COP en el periodo</p>
            </section>
          </div>
          {data.net_worth.unconverted_currencies.length ? (
            <div className="alert warning">
              Faltan tasas COP para:{' '}
              {data.net_worth.unconverted_currencies.join(', ')}
            </div>
          ) : null}
          <section className="panel">
            <div className="panel-heading">
              <h2>Patrimonio por moneda</h2>
              <span>Valores originales, sin mezclar monedas</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Moneda</th>
                    <th className="numeric">Activos</th>
                    <th className="numeric">Pasivos</th>
                    <th className="numeric">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.net_worth.by_currency).map(
                    ([currency, totals]) => (
                      <tr key={currency}>
                        <td>
                          <span className="currency-badge">{currency}</span>
                        </td>
                        <td className="numeric">
                          {number(totals.total_assets)}
                        </td>
                        <td className="numeric">
                          {number(totals.total_liabilities)}
                        </td>
                        <td className="numeric strong">
                          {number(
                            totals.total_assets - totals.total_liabilities,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <div className="two-columns">
            <CategoryTable
              title="Activos por categoría"
              rows={data.assets_by_category}
            />
            <CategoryTable
              title="Pasivos por categoría"
              rows={data.liabilities_by_category}
            />
          </div>
          <div className="three-columns chart-grid">
            <CategoryChart
              title="Ingresos por categoría"
              subtitle="De mayor a menor"
              rows={data.income_by_category}
              color="#12a66a"
            />
            <CategoryChart
              title="Gastos por categoría"
              subtitle="De mayor a menor"
              rows={data.spending_by_category}
              color="#e0524d"
            />
            <CategoryChart
              title="Ahorros por categoría"
              subtitle="De mayor a menor"
              rows={data.savings_by_category}
              color="#3157d5"
            />
          </div>
          {data.net_worth.rates_used.length ? (
            <p className="rates-note">
              Tasas utilizadas:{' '}
              {data.net_worth.rates_used
                .map(
                  (rate) =>
                    `${rate.currency} ${number(rate.rate_to_cop)} (${rate.effective_date})`,
                )
                .join(' · ')}
            </p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
