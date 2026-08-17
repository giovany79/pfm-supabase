'use client';

import { FormEvent, useEffect, useState } from 'react';

type Rate = { id: string; currency: string; rate_to_cop: number; effective_date: string };

export default function Settings() {
  const [rates, setRates] = useState<Rate[]>([]); const [message, setMessage] = useState('');
  const load = async () => { const response = await fetch('/api/exchange-rates'); if (response.ok) setRates(await response.json()); };
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch('/api/exchange-rates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ currency: String(form.get('currency')).toUpperCase(), rate_to_cop: Number(form.get('rate')), effective_date: form.get('date') }) }); setMessage(response.ok ? 'Tasa guardada.' : 'No fue posible guardar la tasa.'); if (response.ok) { event.currentTarget.reset(); await load(); } }
  return <main><h1>Tasas de cambio</h1><p>Define cuántos COP equivale una unidad de cada moneda.</p><form onSubmit={submit}><p><input name="currency" placeholder="USD" maxLength={10} required /></p><p><input name="rate" type="number" min="0.000001" step="0.000001" required /></p><p><input name="date" type="date" required /></p><button>Guardar tasa</button></form><p role="status">{message}</p><h2>Tasas configuradas</h2>{rates.length ? <ul>{rates.map((rate) => <li key={rate.id}>{rate.currency}: {Number(rate.rate_to_cop).toLocaleString('es-CO')} COP ({rate.effective_date})</li>)}</ul> : <p>Aún no hay tasas configuradas.</p>}</main>;
}
