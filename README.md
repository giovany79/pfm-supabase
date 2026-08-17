# PFM Supabase

Plataforma personal de finanzas construida con Next.js 15 y Supabase. Centraliza
activos, pasivos, ingresos y gastos; ofrece visualización histórica y permite consultar
o modificar movimientos desde el dashboard y desde integraciones autenticadas.

## Funcionalidades

- Migración idempotente de `balance-sheet.csv` y `pfm-gio.csv`.
- Autenticación del único propietario mediante Supabase Auth y sesiones con cookies.
- Dashboard con patrimonio neto en COP, activos, pasivos, ingresos y gastos.
- Tablas de patrimonio y gráficas de ingresos/gastos por categoría.
- Administración de movimientos con creación, edición y eliminación.
- Filtros de movimientos por tipo, categoría y rango de fechas.
- Rango inicial del mes actual: primer día del mes hasta la fecha vigente.
- Orden cronológico descendente y orden alternable por valor.
- Histórico mensual de ingresos y gastos, con barras por categorías principales y
  gráfica de línea para una categoría seleccionada.
- Administración manual de tasas de cambio hacia COP.
- Herramientas autenticadas para ChatGPT Actions y un servidor MCP opcional.
- RLS en todas las tablas financieras y separación del cliente `service_role`.

## Secciones del dashboard

| Ruta | Descripción |
| --- | --- |
| `/dashboard` | Resumen de patrimonio, ingresos, gastos y composición por categoría. |
| `/dashboard/movements` | Detalle y CRUD de ingresos y gastos con filtros y ordenamiento. |
| `/dashboard/history` | Histórico mensual de ingresos y gastos por categoría. |
| `/dashboard/settings` | Configuración manual de tasas de cambio a COP. |

Todas las rutas bajo `/dashboard` requieren una sesión válida del propietario.

## Requisitos

- Node.js 20 o posterior.
- Proyecto de Supabase.
- Supabase CLI para aplicar migraciones.
- Usuario propietario creado en Supabase Auth.

En Supabase desactiva **Authentication → Providers → Allow new users to sign up**. La
aplicación no ofrece registro público y está diseñada para un único propietario.

## Configuración local

Instala dependencias y crea el archivo de variables:

```bash
npm install
cp .env.local.example .env.local
```

Variables utilizadas:

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública/anon para Auth y consultas con RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo para el script de migración; nunca se usa en rutas web. |
| `SUPABASE_OWNER_REFRESH_TOKEN` | Sesión RLS de las integraciones MCP/Actions. |
| `MCP_ACTIONS_API_KEY` | Bearer token para `/api/mcp` y `/api/actions/*`. |
| `SUPABASE_OWNER_EMAIL` | Solo para generar el refresh token del propietario. |
| `SUPABASE_OWNER_PASSWORD` | Solo para generar el refresh token del propietario. |
| `DATABASE_URL` | Conexión PostgreSQL usada al aplicar migraciones. |
| `DIRECT_URL` | Conexión directa opcional para herramientas PostgreSQL. |

Nunca subas `.env.local`, claves, tokens, contraseñas ni los CSV financieros.

Para generar `SUPABASE_OWNER_REFRESH_TOKEN` después de configurar correo y contraseña:

```bash
set -a
source .env.local
set +a
npx tsx scripts/get-owner-refresh-token.ts
```

Copia únicamente el valor generado a `.env.local` y evita publicarlo en logs o commits.

## Base de datos e importación

Aplica el esquema:

```bash
set -a
source .env.local
set +a
npx supabase db push --db-url "$DATABASE_URL"
```

Coloca `balance-sheet.csv` y `pfm-gio.csv` en la raíz y ejecuta:

```bash
npm run migrate -- --owner-id <supabase-user-id>
```

La importación usa `item_id` y `transaction_id` para evitar duplicados. Después de una
mutación conversacional confirmada, la reimportación de `pfm-gio.csv` queda bloqueada para
no restaurar datos editados o eliminados. `--force` existe únicamente para una recuperación
intencional:

```bash
npm run migrate -- --owner-id <supabase-user-id> --force
```

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con el usuario
propietario.

No ejecutes `npm run build` simultáneamente con `npm run dev`: ambos escriben en `.next` y
pueden desincronizar los artefactos de desarrollo. Detén primero el servidor si necesitas
validar el build de producción.

## Validación

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
```

Para validar producción con el servidor de desarrollo detenido:

```bash
npm run build
```

El estado actual incluye 13 pruebas unitarias. Las pruebas e2e, reconciliación completa,
latencia y corpus de Q&A que continúan pendientes están identificadas en
`specs/001-personal-finance-platform/tasks.md`.

## API del dashboard

Las siguientes rutas requieren la cookie de sesión del propietario:

- `GET /api/dashboard-metrics`
- `GET|POST /api/exchange-rates`
- `GET|POST /api/transactions`
- `PATCH|DELETE /api/transactions/:id`
- `GET /api/transaction-history`

Los contratos detallados están en
`specs/001-personal-finance-platform/contracts/api-routes.md`.

## ChatGPT Actions y MCP

- `/api/actions/*` y `/api/mcp` requieren
  `Authorization: Bearer <MCP_ACTIONS_API_KEY>`.
- ChatGPT Custom GPT es la integración principal; importa
  `https://<host>/api/actions/openapi.json`.
- El conector MCP para Claude.ai es opcional y apunta a `https://<host>/api/mcp`.
- Las mutaciones conversacionales usan propuesta, confirmación con expiración y auditoría
  antes de modificar una transacción.

Estas integraciones necesitan un despliegue HTTPS público; no pueden configurarse contra
`localhost`.

## Preparación para Git

Antes de publicar:

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
git status --short
```

Confirma que no aparezcan `.env.local`, archivos CSV, claves, tokens, `.next` ni datos
financieros exportados. El archivo `.env.local.example` sí debe incluirse, siempre vacío.

La validación manual completa está documentada en
`specs/001-personal-finance-platform/quickstart.md`.
