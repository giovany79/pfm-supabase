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
| `SUPABASE_OWNER_REFRESH_TOKEN` | Compatibilidad heredada; los tokens rotatorios no son apropiados como secreto estático. |
| `MCP_ACTIONS_API_KEY` | Bearer token para `/api/mcp` y `/api/actions/*`. |
| `SUPABASE_OWNER_EMAIL` | Inicio de sesión RLS de las integraciones MCP/Actions. |
| `SUPABASE_OWNER_PASSWORD` | Contraseña del propietario almacenada solo en variables protegidas del servidor. |
| `DATABASE_URL` | Conexión PostgreSQL usada al aplicar migraciones. |
| `DIRECT_URL` | Conexión directa opcional para herramientas PostgreSQL. |

Nunca subas `.env.local`, claves, tokens, contraseñas ni los CSV financieros.

Las rutas MCP/Actions prefieren correo y contraseña para crear una sesión RLS nueva en cada
invocación. Esto evita reutilizar como secreto estático un refresh token que Supabase rota por
seguridad. El script de refresh token se conserva únicamente para diagnóstico o compatibilidad:

```bash
set -a
source .env.local
set +a
npx tsx scripts/get-owner-refresh-token.ts
```

Nunca expongas estas credenciales a los clientes MCP: Codex y Claude reciben solamente
`MCP_ACTIONS_API_KEY`; el correo y la contraseña existen exclusivamente en el servidor.

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

## Producción

La aplicación está desplegada en Vercel:

- Aplicación: [https://pfm-supabase.vercel.app](https://pfm-supabase.vercel.app)
- Esquema OpenAPI: [https://pfm-supabase.vercel.app/api/actions/openapi.json](https://pfm-supabase.vercel.app/api/actions/openapi.json)

Proyecto Vercel: `gv-soft/pfm-supabase`. Las variables públicas de Supabase están
configuradas para Producción. `MCP_ACTIONS_API_KEY`, `SUPABASE_OWNER_EMAIL` y
`SUPABASE_OWNER_PASSWORD` se almacenan como secretos sensibles del servidor. La clave
`SUPABASE_SERVICE_ROLE_KEY` y las conexiones PostgreSQL no se cargan en Vercel. El refresh
token es solo una alternativa heredada y no es necesario cuando están configuradas las
credenciales del propietario.

La conexión automática con GitHub requiere agregar GitHub como **Login Connection** en la
cuenta Vercel y conectar `giovany79/pfm-supabase` desde Project Settings → Git. Hasta
entonces, los despliegues se realizan desde este repositorio con:

```bash
npx vercel@latest deploy --prod
```

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

El estado actual incluye pruebas unitarias para el protocolo MCP, autenticación, consultas,
mutaciones y métricas. Las pruebas e2e restantes, reconciliación completa,
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

## Configuración de asistentes: ChatGPT, Claude y Codex

La aplicación ofrece dos interfaces autenticadas sobre el mismo conjunto de operaciones:

| Cliente | Interfaz | Configuración del proyecto |
| --- | --- | --- |
| ChatGPT Custom GPT | Actions REST/OpenAPI | Esquema público `/api/actions/openapi.json` y secreto Bearer guardado en el GPT |
| Claude.ai | Conector MCP remoto opcional | URL `/api/mcp` y encabezado Bearer configurados en Claude.ai |
| Claude Code | MCP Streamable HTTP | [`.mcp.json`](.mcp.json) |
| Codex CLI, aplicación o extensión | MCP Streamable HTTP | [`.codex/config.toml`](.codex/config.toml) |

Los endpoints de producción son:

- Actions: `https://pfm-supabase.vercel.app/api/actions`
- Esquema OpenAPI: `https://pfm-supabase.vercel.app/api/actions/openapi.json`
- MCP: `https://pfm-supabase.vercel.app/api/mcp`

Todos los `POST` de Actions y MCP requieren
`Authorization: Bearer <MCP_ACTIONS_API_KEY>`. Usa exactamente el mismo valor configurado
en Vercel, pero nunca lo escribas en `.mcp.json`, `.codex/config.toml`, el README o Git.
Estas integraciones deben apuntar al despliegue HTTPS, no a `localhost`.

El servidor expone seis herramientas: `query_transactions`, `query_snapshots`,
`aggregate_transactions`, `propose_transaction_change`, `propose_transaction_batch` y
`confirm_transaction_change`. Las tres primeras consultan datos. Las tres restantes
implementan una escritura en dos pasos: primero proponen un cambio individual o un lote de
2 a 20 movimientos y luego requieren confirmación explícita antes de aplicarlo.

<a id="chatgpt-setup"></a>

### ChatGPT: crear el Custom GPT con Actions

1. En ChatGPT, crea o edita un GPT y abre **Configure → Actions**.
2. Elige **Import from URL** e importa
   `https://pfm-supabase.vercel.app/api/actions/openapi.json`.
3. En **Authentication**, selecciona **API Key** y el tipo **Bearer**. Pega como secreto el
   valor de `MCP_ACTIONS_API_KEY`; no incluyas el prefijo `Bearer` dentro del valor.
4. Copia en **Instructions** el texto canónico de
   [Custom GPT configuration](specs/001-personal-finance-platform/contracts/gpt-actions.md#custom-gpt-configuration).
5. Guarda el GPT como privado y prueba una consulta cuyo resultado conozcas. En la interfaz
   debe verse la llamada a una Action y la respuesta debe basarse en los datos retornados.

ChatGPT usa los endpoints REST de Actions; no agregues `/api/mcp` como una Action. Si rotas
`MCP_ACTIONS_API_KEY`, actualiza también el secreto guardado en la autenticación del GPT.
El contrato completo está en
[gpt-actions.md](specs/001-personal-finance-platform/contracts/gpt-actions.md).

<a id="claude-ai-setup"></a>

### Claude.ai: agregar el conector remoto opcional

1. Abre la configuración de conectores de Claude.ai y crea un conector MCP personalizado.
2. Usa `https://pfm-supabase.vercel.app/api/mcp` como URL remota.
3. Configura `Authorization` con el valor `Bearer <MCP_ACTIONS_API_KEY>` en el campo de
   encabezado o token que muestre tu plan y espacio de trabajo.
4. Habilita el conector en una conversación nueva y confirma que aparecen las seis
   herramientas.

La ubicación y disponibilidad de conectores puede variar según el plan de Claude.ai. Esta
superficie es opcional; su contrato está en
[mcp-server.md](specs/001-personal-finance-platform/contracts/mcp-server.md).

<a id="claude-code-setup"></a>

### Claude Code: usar la configuración del repositorio

El archivo `.mcp.json` ya declara `pfm-finance` y obtiene el token desde el entorno. Antes
de iniciar Claude Code, expórtalo sin guardarlo en el historial:

```bash
read -s "MCP_ACTIONS_API_KEY?MCP token: "
export MCP_ACTIONS_API_KEY
claude
```

Ejecuta el comando desde la raíz de este repositorio. En el primer inicio, acepta la
confianza del workspace y aprueba el servidor de proyecto `pfm-finance`. Comprueba el
resultado con `claude mcp list` desde la terminal o `/mcp` dentro de Claude Code. Un estado
`Pending approval` indica que todavía falta esa aprobación interactiva.

<a id="codex-setup"></a>

### Codex: usar la configuración del repositorio

El archivo `.codex/config.toml` ya declara `pfm_finance`, lee el Bearer desde
`MCP_ACTIONS_API_KEY` y mantiene aprobación manual para las escrituras. Inicia Codex desde
una terminal que tenga la variable exportada:

```bash
read -s "MCP_ACTIONS_API_KEY?MCP token: "
export MCP_ACTIONS_API_KEY
codex
```

Confía en el proyecto cuando Codex lo solicite. Verifica el servidor con `codex mcp list`
o con `/mcp` dentro de una sesión. La aplicación, el CLI y la extensión de Codex utilizan
la configuración MCP de Codex; reinicia el cliente después de cambiar la configuración o
el entorno.

### Verificación y problemas frecuentes

Prueba primero una consulta de solo lectura conocida, por ejemplo: “¿Cuánto gasté en salud
en julio de 2026?”. El cliente debe invocar una herramienta y no estimar la respuesta.

| Síntoma | Revisión |
| --- | --- |
| `401 Unauthorized` | El token local o del GPT no coincide con `MCP_ACTIONS_API_KEY` en Vercel. |
| MCP desconectado | Confirma la URL de producción, exporta la variable antes de iniciar el cliente y reinícialo. |
| `Pending approval` en Claude Code | Abre `claude` en la raíz, confía en el workspace y aprueba `pfm-finance`. |
| No aparecen seis herramientas | Revisa `/mcp` o `* mcp list`; elimina configuraciones duplicadas y vuelve a iniciar la sesión. |
| La consulta devuelve cero filas | Comprueba categoría, tipo y rango de fechas; el asistente debe reportar ausencia de datos, no inventarlos. |

Al rotar el token, cambia el secreto en Vercel, la autenticación del Custom GPT y la
variable exportada en los clientes locales. No es necesario modificar los archivos
versionados. La validación manual de consultas, auditoría y mutaciones está en
[quickstart.md](specs/001-personal-finance-platform/quickstart.md#6-ask-a-grounded-question-user-story-3).

Referencias oficiales: [GPT Actions](https://developers.openai.com/api/docs/actions/introduction),
[autenticación de GPT Actions](https://developers.openai.com/api/docs/actions/authentication),
[MCP en Codex](https://developers.openai.com/codex/mcp) y
[MCP en Claude Code](https://code.claude.com/docs/en/mcp).

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
