import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = {
  title: 'PFM Supabase',
  description: 'Dashboard personal de patrimonio, ingresos, gastos y ahorros',
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
