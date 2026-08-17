import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const initialError =
    params.error === 'credentials'
      ? 'No fue posible iniciar sesión. Verifica tus credenciales.'
      : params.error === 'config'
        ? 'La autenticación no está configurada correctamente.'
        : '';

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="Plataforma de finanzas personales">
        <div className="brand-mark" aria-hidden="true">PF</div>
        <div>
          <p className="eyebrow login-eyebrow">Finanzas personales</p>
          <h1>Tu información financiera, clara y bajo control.</h1>
          <p className="login-intro">
            Consulta tu patrimonio, administra movimientos y entiende la evolución de
            tus ingresos y gastos desde un solo lugar.
          </p>
        </div>
        <div className="login-benefits" aria-label="Características">
          <span><i aria-hidden="true">✓</i> Datos protegidos con Supabase</span>
          <span><i aria-hidden="true">✓</i> Acceso exclusivo del propietario</span>
          <span><i aria-hidden="true">✓</i> Históricos y métricas en tiempo real</span>
        </div>
      </section>

      <section className="login-access">
        <div className="login-card">
          <div className="login-card-heading">
            <span className="mobile-brand" aria-hidden="true">PF</span>
            <p className="eyebrow">Acceso seguro</p>
            <h2>Bienvenido</h2>
            <p>Ingresa con la cuenta propietaria para continuar.</p>
          </div>
          <LoginForm initialError={initialError} />
          <div className="login-security-note">
            <span aria-hidden="true">●</span>
            Sesión protegida y cifrada
          </div>
        </div>
        <p className="login-footer">PFM Supabase · Uso personal</p>
      </section>
    </main>
  );
}
