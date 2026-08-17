'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client';

export function LoginForm({ initialError = '' }: { initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const { error: signInError } =
        await createBrowserSupabaseClient().auth.signInWithPassword({
          email: String(formData.get('email') ?? ''),
          password: String(formData.get('password') ?? ''),
        });

      if (signInError) {
        setError('No fue posible iniciar sesión. Verifica tus credenciales.');
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('No fue posible conectar con el servicio de autenticación.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action="/api/auth/login" method="post" onSubmit={signIn} className="login-form">
      <label>
        Correo electrónico
        <span className="login-input-wrap">
          <span className="login-input-icon" aria-hidden="true">@</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="nombre@correo.com"
            disabled={submitting}
            required
          />
        </span>
      </label>
      <label>
        Contraseña
        <span className="login-input-wrap">
          <span className="login-input-icon lock-icon" aria-hidden="true">●</span>
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Ingresa tu contraseña"
            disabled={submitting}
            required
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
            disabled={submitting}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </span>
      </label>
      {error ? <div className="login-error" role="alert">{error}</div> : null}
      <button className="login-submit" type="submit" disabled={submitting}>
        <span>{submitting ? 'Verificando acceso…' : 'Ingresar al dashboard'}</span>
        {!submitting ? <span aria-hidden="true">→</span> : <span className="login-spinner" aria-hidden="true" />}
      </button>
    </form>
  );
}
