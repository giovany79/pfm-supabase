# Feature Specification: Personal Finance Platform

**Feature Branch**: `001-personal-finance-platform`

**Created**: 2026-08-09

**Status**: In Progress (local dashboard implemented; deployment and remaining acceptance automation pending)

**Input**: User description: "Requiero migrar a una base de datos supabase los archivos de finanzas personales que se encuentran en archivos de excel. balance-sheet.csv y pfm-gio.csv. El objetivo es poder consultar y analizar los datos de finanzas personales de manera más eficiente y centralizada, utilizando Supabase como backend. Los archivos contienen información sobre ingresos, gastos, activos y pasivos, y se requiere que la migración preserve la integridad de los datos y permita realizar consultas complejas posteriormente. Adicionalmente quiero tener una funcionalidad tipo gpt que me permita hacer preguntas sobre mis finanzas personales y obtener respuestas basadas en los datos migrados a Supabase. Esta funcionalidad debe ser capaz de interpretar consultas en lenguaje natural y devolver información relevante de manera precisa y rápida. También requiero tener la posibilidad de tener un dashboard que me permita visualizar de manera clara y concisa mis finanzas personales, incluyendo gráficos y métricas clave que me ayuden a entender mi situación financiera actual y tomar decisiones informadas."

## Clarifications

### Session 2026-08-09

- Q: ¿Qué cambios debe poder realizar el GPT personal sobre los movimientos financieros? → A: Crear, editar y eliminar definitivamente.
- Q: ¿El GPT debe poder modificar también los movimientos migrados desde `pfm-gio.csv`, o únicamente los creados posteriormente desde ChatGPT? → A: Todos los movimientos, sin conservar respaldo.
- Q: ¿Cómo debe conectarse el GPT personal de ChatGPT para consultar y modificar los movimientos financieros? → A: Action autenticada mediante API intermediaria.
- Q: ¿Qué datos debe proporcionar Gio antes de que el GPT pueda crear un movimiento? → A: Fecha, descripción, valor, categoría y tipo (ingreso/egreso).
- Q: ¿Qué hacemos con el conflicto entre el CRUD conversacional que exige el spec y la garantía de solo lectura que fija la constitución para el Q&A? → A: Mantener el CRUD conversacional en el spec; el Principio V / Additional Constraints de la constitución debe enmendarse (vía `/speckit-constitution`) para permitir mutaciones acotadas y auditadas en la superficie Q&A antes de avanzar a `/speckit-plan`.
- Q: Dado que el sistema no controla el texto final que compone ChatGPT/Claude, ¿qué debe garantizar realmente para cumplir FR-007/Principio V? → A: Una garantía a nivel de herramienta: cada tool call devuelve los IDs de fila/snapshot usados y el agregado calculado, no solo un número suelto; el sistema no garantiza ni puede verificar el texto final compuesto por el proveedor externo, solo lo que expone cada herramienta.
- Q: ¿Cómo debe calcularse el net worth del dashboard cuando los snapshots están en varias monedas? → A: Convertir todo a pesos (COP) como moneda base, usando una tabla de tasas de cambio que Gio actualiza manualmente; el dashboard muestra la tasa vigente usada y su fecha junto al net worth convertido.
- Q: Si se vuelve a correr la migración de `pfm-gio.csv` después de una mutación conversacional confirmada, ¿qué debe pasar? → A: La migración de `pfm-gio.csv` es un evento de carga inicial único; en cuanto exista al menos una mutación conversacional confirmada, el sistema bloquea/advierte contra volver a correr la migración completa de ese archivo, en vez de re-aplicar el upsert.
- Q: ¿Cómo identifica el sistema sin ambigüedad la transacción objetivo antes de pedir confirmación de una edición/borrado? → A: Por ID expuesto en una consulta previa; si la descripción de Gio coincide con varias transacciones, el sistema las lista y pide elegir por ID antes de pedir confirmación; la confirmación queda ligada a ese ID y expira si Gio no responde en el turno inmediato siguiente.
- Q: ¿Claude.ai debe ser una superficie obligatoria del feature, igual que ChatGPT, o queda opcional? → A: Opcional/mejor esfuerzo. ChatGPT (Custom GPT + Action) es la única superficie obligatoria con criterios de éxito propios; Claude.ai (conector MCP) puede configurarse también, pero no bloquea ningún criterio de éxito ni prueba de aceptación.
- Q: ¿Con qué conjunto de preguntas y método se mide el 95% exigido por SC-005? → A: Un corpus fijo y versionado de al menos 20 preguntas reales sobre los datos migrados, cada una con respuesta esperada y tolerancia numérica de ±1%, evaluado sobre la superficie obligatoria (ChatGPT).
- Q: ¿Cómo se reformula SC-006 ("cero instancias" de cifras fabricadas) para que sea verificable? → A: Cero fallos de fabricación de cifras dentro del corpus versionado de SC-005, más garantías estructurales permanentes: herramientas siempre parametrizadas (nunca SQL libre), todo resultado incluye los IDs de origen (FR-007), y toda herramienta que devuelve cero filas lo declara explícitamente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Centralize and query personal finance data (Priority: P1)

Gio has his personal finance history spread across two spreadsheet files — one tracking
assets and liabilities over time, one tracking income and expense transactions. He wants
all of that data migrated into one centralized, queryable store so he can stop opening
spreadsheets to answer questions like "how much did I spend on health last month?" or
"what's the current split between my assets and liabilities?".

**Why this priority**: This is the foundation every other capability in this feature
depends on. Without a complete, accurate, centralized dataset, neither the dashboard nor
the natural-language Q&A can produce a trustworthy answer. It is also independently
valuable on its own: even without a dashboard or Q&A assistant, being able to run a
complex query against centralized data instead of manipulating spreadsheet formulas is a
real efficiency win.

**Independent Test**: Can be fully tested by migrating both source files and running a
handful of representative queries (e.g., total expenses by category for a date range,
current net worth, assets by institution) directly against the centralized data, and
confirming every result matches what manual inspection of the source files would show.

**Acceptance Scenarios**:

1. **Given** the asset/liability snapshot file and the income/expense transaction file,
   **When** the migration is run, **Then** every row from both files exists in the
   centralized store with its original values (amounts, dates, categories, currencies,
   descriptions) unchanged.
2. **Given** the migration has already been run once, **When** it is run again on the
   same source files, **Then** no duplicate records are created.
3. **Given** the centralized data, **When** Gio requests a query that filters and
   aggregates across both entity types (e.g., "total asset value by category as of the
   most recent snapshot"), **Then** the system returns a correct result without requiring
   him to open or edit the original spreadsheets.
4. **Given** a source row with a missing or malformed required field (e.g., an empty
   amount or an invalid date), **When** the migration is run, **Then** that row is
   flagged as a data-quality issue and reported to Gio instead of being silently
   imported or silently dropped.

---

### User Story 2 - Visualize finances on a dashboard (Priority: P2)

Gio wants a single screen that shows his current financial position at a glance —
net worth, income vs. expenses over time, spending by category, and the breakdown of
assets and liabilities — so he can understand where he stands and make decisions without
having to write a query for every question.

**Why this priority**: Once the data is centralized (User Story 1), a visual dashboard is
the fastest way to get recurring, high-value insight without composing a query or a
question each time. It's the capability Gio will likely use most often, but it depends on
User Story 1 being in place first.

**Independent Test**: Can be fully tested by loading the dashboard against the centralized
data and confirming that each displayed metric and chart matches the equivalent value
computed directly from the underlying records.

**Acceptance Scenarios**:

1. **Given** centralized finance data exists, **When** Gio opens the dashboard, **Then**
   he sees his current net worth, a breakdown of assets vs. liabilities, and income vs.
   expenses for a recent period, all computed from the underlying data.
2. **Given** the dashboard is displaying spending by category, **When** Gio selects a
   different date range, **Then** the charts and metrics update to reflect only data
   within that range.
3. **Given** a date range with no recorded transactions or snapshots, **When** Gio views
   the dashboard for that range, **Then** the dashboard clearly shows an empty/no-data
   state rather than a misleading zero or a stale chart.
4. **Given** asset/liability snapshots exist in more than one currency, **When** Gio
   views net worth on the dashboard, **Then** the system converts every snapshot to COP
   using the manually-maintained exchange rate table and displays the rate(s) and their
   effective date(s) alongside the converted total; any snapshot whose currency has no
   configured rate is excluded and explicitly flagged rather than guessed.
5. **Given** transaction data exists, **When** Gio opens the income and expense section,
   **Then** he can filter by type, category, and inclusive date range; inspect details;
   order by date or amount; and create, edit, or permanently delete a movement.
6. **Given** transactions span multiple months and categories, **When** Gio opens the
   historical section, **Then** he sees monthly income and expense composition by category
   and can select an individual category to inspect its trend.

---

### User Story 3 - Ask natural-language questions about finances (Priority: P3)

Gio wants to type a plain-language question — like "how much do I usually spend on
groceries?" or "how has my net worth changed this year?" — and get back an accurate
answer grounded in his actual migrated data, without needing to know how to write a
query himself.

**Why this priority**: This delivers the highest-friction-removal value but is also the
most complex to get right (interpreting open-ended natural language and guaranteeing the
answer is grounded, not guessed). It builds on User Story 1's centralized data and is
most valuable once User Stories 1 and 2 already give Gio a way to sanity-check answers
against the dashboard.

**Independent Test**: Can be fully tested by asking a representative set of natural-
language questions against the centralized data and verifying each answer's figures
against a manual query of the same data, including confirming that questions with no
supporting data are answered with an explicit "cannot answer" rather than a fabricated
figure.

**Acceptance Scenarios**:

1. **Given** centralized finance data, **When** Gio asks a natural-language question
   about a spending category, time period, or account, **Then** the system returns an
   answer whose figures are traceable to specific underlying records.
2. **Given** a question whose answer cannot be derived from the available data (e.g., it
   asks about a category or period with no matching records), **When** Gio submits the
   question, **Then** the system explicitly states it cannot answer rather than
   guessing or fabricating a figure.
3. **Given** an ambiguous question (e.g., "how much did I spend?" with no category or
   period specified), **When** Gio submits it, **Then** the system either asks a
   clarifying follow-up or states the assumption it used (e.g., "showing all-time total
   across all categories") alongside the answer.
4. **Given** Gio issues an explicit instruction to create, edit, or permanently delete a
   transaction, **When** he confirms the requested change, **Then** the system applies
   exactly that change and reports whether it succeeded.
5. **Given** a transaction was originally imported from `pfm-gio.csv`, **When** Gio
   confirms an edit or permanent deletion through the conversational interface, **Then**
   the system changes or removes that transaction without retaining an original copy.
6. **Given** Gio uses his personal GPT in ChatGPT, **When** it requests financial data or
   submits a confirmed transaction change, **Then** the request passes through an
   authenticated intermediary and the GPT receives no direct database credentials.
7. **Given** Gio asks the GPT to create a transaction, **When** one or more required
   fields are missing, **Then** the GPT requests the missing date, description, amount,
   category, or type (income/expense) and creates nothing until all five are provided and
   confirmed.
8. **Given** Gio's description of a transaction to edit or delete matches more than one
   record, **When** he submits the request, **Then** the system lists the matching
   transactions with their IDs and asks him to pick one before requesting confirmation.
9. **Given** the system has requested confirmation for a specific transaction ID and
   change, **When** Gio does not confirm within the short expiry window (a bounded TTL,
   not literal message-turn tracking — the system cannot observe chat turns), **Then**
   the confirmation expires and any later "yes" MUST NOT apply the change without a fresh
   confirmation request.

---

### Edge Cases

- What happens when the same source file is migrated more than once (re-run of the
  migration)? No duplicate records should be created (see User Story 1, Scenario 2).
- What happens when a source row has an amount, date, or category that cannot be parsed?
  It must be flagged as a data-quality issue, not silently imported or dropped.
- What happens when a snapshot or transaction record uses a currency different from the
  majority of records? Values must be preserved in their original currency and clearly
  labeled; no query, dashboard metric, or Q&A answer may combine amounts across
  currencies without stating how the mixing/conversion was done.
- How does the dashboard behave when there is no data for the selected date range?
  It must show an explicit empty state, not a blank or misleading chart.
- How does the Q&A feature behave when asked something outside the scope of personal
  finance data (e.g., general knowledge, unrelated topics)? It must decline and state
  that it only answers questions about the migrated financial data.
- How does the system behave if someone other than Gio attempts to access the data or
  the Q&A/dashboard interfaces? Access must be denied.
- What happens when conversational text could be either a question or a request to
  modify data? The system must ask Gio to clarify and must not modify data until it
  receives an explicit, confirmed instruction.
- What happens when a transaction creation command omits a required field? The system
  must request the missing field and must not infer it or create an incomplete record.
- What happens when Gio's description of a transaction to edit/delete matches more than
  one record? The system must list the matching candidates with their IDs and have Gio
  choose one before requesting confirmation; it must not guess or act on the first match.
- What happens when Gio confirms a change after the short expiry window (a bounded TTL,
  since the system cannot literally track which chat message is "next") has passed? The
  confirmation has expired; the system must not apply the change and must ask Gio to
  restate the request.
- What happens when Gio tries to re-run the full migration of `pfm-gio.csv` after at
  least one conversational create, edit, or delete has been confirmed (against any
  transaction, imported or newly created)? The system must prevent or explicitly warn
  against the re-run rather than silently restoring the prior value or duplicating a
  GPT-created transaction.
- What happens when a snapshot's currency has no configured exchange rate to COP? The
  dashboard's converted net worth must exclude that snapshot and flag it explicitly,
  rather than guessing a rate or silently omitting it without notice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST migrate every record from the asset/liability snapshot
  source (item id, snapshot date, name, kind, category, amount, currency, institution,
  notes) into centralized storage, preserving all original values.
- **FR-002**: The system MUST migrate every record from the income/expense transaction
  source (transaction id, description, income/expense type, amount, category, date) into
  centralized storage, preserving all original values.
- **FR-003**: The system MUST detect and report data-quality issues found in the source
  files (missing required fields, unparseable amounts, invalid dates) rather than
  silently discarding or silently "fixing" the affected rows.
- **FR-004**: The migration process MUST be re-runnable against the same source data
  without creating duplicate records in the centralized store.
- **FR-005**: Users MUST be able to run complex queries against the centralized data —
  including filtering by date range, category, kind (asset/liability/income/expense), and
  institution, and aggregating (sums, counts, averages) across those dimensions.
- **FR-006**: The system MUST provide a way to ask questions about personal finances in
  natural language and receive an answer derived from the centralized data.
- **FR-007**: Every tool result returned to a natural-language query MUST be traceable to
  the specific underlying records used to answer it. Row-level tools (querying individual
  snapshots/transactions) MUST include each returned record's unique identifier directly
  in the result. The aggregate tool (summing/counting grouped by category or month) MAY
  omit per-row identifiers from its response — carrying a potentially large ID list on
  every aggregate call is unnecessary overhead — but its traceability guarantee MUST still
  hold: the same filters it was called with (date range, category, type) can be replayed
  against the row-level query tool to enumerate the exact rows the aggregate was computed
  from. The system MUST instruct the calling model (via each tool's description/output) to
  cite record IDs when available and to state plainly when a call returns zero rows; the
  system cannot see or verify the final composed answer text on external chat surfaces
  (ChatGPT/Claude.ai), so this requirement is scoped to what each tool call returns and
  logs, not to the literal wording of the model's reply.
- **FR-008**: The system MUST explicitly state when a natural-language question cannot be
  answered from the available data, rather than producing a fabricated or estimated
  figure.
- **FR-009**: The system MUST provide a dashboard showing, at minimum: current net worth,
  the asset/liability breakdown, income vs. expenses over a selectable period, and
  spending by category. When snapshots span multiple currencies, net worth MUST be
  computed by converting every snapshot to Colombian pesos (COP) as the base currency
  using the exchange rate table Gio maintains (see Exchange Rate entity), and the
  dashboard MUST display the rate(s) and their effective date(s) alongside the
  converted figure. If a snapshot's currency has no configured rate to COP, that
  snapshot MUST be excluded from the converted net worth and flagged explicitly
  (never silently guessed or omitted without notice).
- **FR-010**: The dashboard MUST let Gio change the date range being viewed, and MUST
  recompute all displayed metrics and charts for the selected range.
- **FR-011**: The dashboard MUST show an explicit empty/no-data state for any period or
  filter combination that has no matching records.
- **FR-012**: The system MUST restrict access to the migrated financial data, the
  dashboard, and the Q&A feature to Gio as the sole authorized user.
- **FR-013**: The system MUST NOT delete or overwrite historical records as a side effect
  of migration, querying, dashboard viewing, or answering a natural-language question;
  a conversational mutation is permitted only through Gio's explicit, confirmed
  instruction to change a transaction, asset, or liability.
- **FR-014**: The system MUST preserve the original currency of each record and MUST NOT
  combine amounts across different currencies in a query, dashboard metric, or
  natural-language answer without explicitly stating that a conversion was applied.
- **FR-015**: The conversational finance interface MUST allow Gio to create, edit, and
  permanently delete transaction records through explicit natural-language commands.
- **FR-016**: Before creating, editing, or permanently deleting a transaction, the
  system MUST show the interpreted change and obtain Gio's confirmation; a question,
  ambiguous message, or unconfirmed command MUST NOT modify any record. For an edit or
  deletion, the target transaction MUST be identified by its unique ID, established via
  a prior query the system showed to Gio; if Gio's description matches more than one
  transaction, the system MUST list the candidates with their IDs and have Gio pick one
  before requesting confirmation. A confirmation is valid only for the specific ID and
  change it was requested for, and MUST expire after a short, bounded time window from
  when it was requested — the system has no visibility into ChatGPT/Claude.ai's
  conversation turns, so it cannot literally detect "Gio's next message"; a short
  server-side expiry (implemented as a TTL on the pending confirmation, not
  message-order tracking) is the verifiable mechanism that approximates it, and each
  tool's own instructions additionally steer the calling model to only confirm in direct,
  immediate response. An expired or mismatched confirmation MUST NOT modify any record.
- **FR-017**: After a confirmed transaction change, the system MUST report the outcome
  and identify the created, edited, or deleted transaction.
- **FR-018**: Gio MUST be able to edit or permanently delete any transaction, including
  one originally imported from `pfm-gio.csv`; the system MUST NOT retain a backup or
  recoverable original copy of an edited or deleted transaction.
- **FR-019**: Gio's personal GPT in ChatGPT MUST access financial operations through an
  authenticated Action backed by an intermediary API and MUST NOT connect directly to
  the database or receive database credentials.
- **FR-020**: The intermediary MUST authenticate every request, authorize only Gio, and
  expose only the finance query and confirmed transaction-change operations required by
  this feature.
- **FR-021**: Creating a transaction through the personal GPT MUST require an explicit
  date, description, amount, category, and type (income or expense); the system MUST ask
  for any missing value and MUST NOT infer or silently default it.
- **FR-022**: The system MUST maintain a manually-updatable exchange rate table (source
  currency → COP) that Gio controls, and MUST use the most recent applicable rate — with
  its effective date shown — whenever a multi-currency figure (e.g., net worth) is
  converted for display; the system MUST NOT auto-fetch rates from an external service.
- **FR-023**: Once at least one transaction or snapshot mutation has been applied from a
  conversational surface or the authenticated dashboard, the system MUST prevent or
  explicitly warn against re-running the full financial CSV migration, so a re-import
  cannot silently restore or overwrite user-maintained data. This applies regardless of
  whether the mutation touched an imported row or a brand-new one — the lock is simplest
  and safest as an "any applied mutation" trigger,
  not one scoped only to edits/deletes of previously-imported rows (resolved 2026-08-09
  post-`/speckit-analyze`, finding I1, to match the already-implemented design in
  research.md R8 §8.5).
- **FR-024**: The authenticated dashboard MUST provide a transaction-management section
  that lists income and expense details and permits creation, update, and permanent
  deletion under the same owner-scoped RLS policies as other dashboard reads.
- **FR-025**: The transaction-management section MUST filter by type, category, and
  inclusive date range. Its initial range MUST run from the first day of the current local
  calendar month through the current local date, recalculated whenever the page is opened.
- **FR-026**: Transaction details MUST default to most-recent transaction date first. Gio
  MUST be able to order the value column from highest to lowest or lowest to highest and
  restore date-descending order.
- **FR-027**: The category selector MUST include every distinct category owned by Gio,
  even when the transaction table exceeds Supabase's per-request row limit.
- **FR-028**: The dashboard MUST provide an all-time monthly history for both income and
  expenses by category. It MUST process every transaction through pagination, show the
  principal categories together, and allow any individual category to be selected for a
  focused trend chart.
- **FR-029**: The authenticated dashboard MUST provide an asset/liability management
  section that lists current snapshot records and permits Gio to create or update them,
  including snapshot date, name, kind, category, amount, currency, institution, and notes.
  Net worth MUST remain a derived value and MUST NOT be directly editable.
- **FR-030**: ChatGPT Actions and MCP clients MUST allow Gio to create or update one asset
  or liability through a two-step proposal and explicit-confirmation flow. An edit MUST
  target an `item_id` returned by `query_snapshots`; confirmation MUST expire after the
  same bounded window used for transaction mutations, and every confirmed attempt MUST be
  recorded in a redacted audit log that stores no financial field values.
- **FR-031**: The asset/liability dashboard MUST display a per-currency historical chart
  of total assets, total liabilities, and derived net worth, plus a selectable historical
  chart for each individual asset or liability. General totals MUST carry forward each
  identity's latest known valuation and MUST NOT combine currencies implicitly.

### Key Entities

- **Financial Snapshot**: A point-in-time record of a single asset or liability (e.g., a
  crypto holding, a bank balance, a loan). Key attributes: unique identifier, snapshot
  date, name, kind (asset or liability), category, amount, currency, institution, and
  optional notes.
- **Transaction**: A single income or expense event. Key attributes: unique identifier,
  description, type (income or expense), amount, category, and date. All five business
  attributes are required when a transaction is created through the personal GPT.
- **Natural-Language Query**: A question Gio asks about his finances and the answer
  returned. Attributes: the question text, the answer, and the underlying records the
  answer was derived from (for traceability).
- **Transaction Change Command**: An explicit instruction from Gio to create, edit, or
  permanently delete a transaction. Attributes: requested operation, interpreted field
  values, target transaction ID (resolved from a prior query, required for edit/delete),
  confirmation state, confirmation expiry (a short, bounded TTL from when it was
  requested — not literal message-order tracking, which the system cannot observe on
  external chat surfaces), and outcome.
- **GPT Action Request**: An authenticated request made by Gio's personal GPT through the
  intermediary interface. Attributes: requested finance operation, authenticated owner,
  validated inputs, and operation result.
- **Exchange Rate**: A manually-entered conversion rate from a source currency to COP
  (the net worth base currency). Attributes: source currency, target currency (COP),
  rate, effective date, and who/when it was last updated. Used only to compute converted
  net worth on the dashboard; never applied silently to individual transaction or
  snapshot records.
- **Q&A Evaluation Corpus**: A versioned set of at least 20 real natural-language
  questions about the migrated data, used to measure SC-005/SC-006. Attributes: question
  text, expected answer, numeric tolerance (±1%), and the surface(s) it was evaluated
  against (ChatGPT mandatory; Claude.ai optional/informational).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Immediately after migration and before any user-requested transaction
  changes, 100% of records present in the source files are present in the centralized
  store with matching values, verified by comparing record counts and spot-checked
  values against the source files.
- **SC-002**: Gio can get an answer to a complex question about his finances (via query,
  dashboard, or natural-language question) in under 1 minute, without opening the
  original spreadsheet files.
- **SC-003**: The dashboard displays current financial metrics within 3 seconds of being
  opened.
- **SC-004**: A natural-language question returns an answer (or an explicit "cannot
  answer") within 10 seconds.
- **SC-005**: At least 95% of the questions in the versioned Q&A evaluation corpus (see
  Q&A Evaluation Corpus entity; minimum 20 real questions with expected answers and a
  ±1% numeric tolerance) receive an answer whose figures match the expected answer
  within tolerance when checked against the underlying records, measured on the
  mandatory ChatGPT surface; the remainder are correctly flagged as unanswerable rather
  than answered incorrectly. Results on the optional Claude.ai surface, if configured,
  are reported for information but do not affect pass/fail of this criterion.
- **SC-006**: Zero fabrication failures within the SC-005 evaluation corpus (no answer
  presents a figure not backed by a retrieved record or a computation over retrieved
  records), plus the following permanent structural guarantees hold for every Q&A tool:
  it only executes parameterized, pre-defined queries (never free-form SQL), every result
  is traceable to source records per FR-007 (row-level results carry each record's ID
  directly; the aggregate tool's totals are traceable by replaying its filters against the
  row-level query tool), and a zero-row result is always stated explicitly rather than
  answered with a guessed figure.
- **SC-007**: Re-running the migration process any number of times, **without** using an
  explicit override to bypass the FR-023 re-import lock, never changes the total record
  count in the centralized store beyond the first successful run. Using that override
  (e.g., `--force`) after a conversational mutation has been confirmed is an intentional,
  explicitly-acknowledged recovery action outside this guarantee — it is allowed to change
  the record count (e.g., by restoring a since-deleted imported row), which is exactly why
  FR-023 requires it to be an explicit, non-default choice rather than the normal re-run
  path.

## Assumptions

- Gio is the sole user of this system; no multi-user roles, sharing, or permissions model
  beyond single-owner access is in scope.
- This feature covers migrating the *existing* historical data in `balance-sheet.csv` and
  `pfm-gio.csv`, building query, dashboard, and Q&A capabilities on top of it, and
  maintaining transaction movements and asset/liability snapshots through the dashboard
  and conversational interfaces. Net worth remains calculated and is never entered directly.
- Imported transactions are not immutable after migration. A confirmed conversational
  command may edit or permanently delete them, and the system does not retain an
  internal backup or recoverable copy of their prior values.
- The ChatGPT integration uses an authenticated GPT Action and an intermediary API as its
  only path to financial operations; direct GPT access to database credentials is out of
  scope and prohibited.
- Source files use `;` as the field delimiter and the column layouts observed in the
  current `balance-sheet.csv` (item_id, snapshot_date, name, kind, category, amount,
  currency, institution, notes) and `pfm-gio.csv` (transaction_id, description,
  Income/expensive, amount, category, date).
- The income/expense transaction source does not include a currency column; all
  transaction amounts are assumed to be in a single, consistent currency as recorded in
  the source file. Asset/liability snapshots may span multiple currencies, as reflected
  by their explicit currency column.
- "Complex queries" (FR-005) means filtering and aggregating by the attributes already
  present in the source data (date, category, kind, institution) — it does not imply
  support for arbitrary open-ended analytics beyond what those dimensions allow.
- The natural-language Q&A feature answers questions strictly scoped to Gio's migrated
  personal finance data; it is not a general-purpose assistant.
- The conversational CRUD required by FR-015–FR-023 originally conflicted with the
  constitution's prior (v1.1.0) read-only guarantee for the Q&A surface. Per the
  2026-08-09 clarification session, the constitution was amended (via
  `/speckit-constitution`, now **v1.2.0**) to explicitly permit scoped, confirmed, audited
  mutations on that surface — see constitution Principle V and Additional Constraints,
  "Mutation confirmation & audit logging." This conflict is resolved, not pending; FR-015–
  FR-023 are constitutionally compliant as written.
- COP (Colombian pesos) is the base currency for the dashboard's converted net worth
  figure. The exchange rate table (Exchange Rate entity) is populated and updated
  manually by Gio — the system does not call any external FX rate API.
- Once any conversational transaction mutation (create, edit, or delete) has been
  confirmed, `pfm-gio.csv` migration is treated as a one-time initial load for that file,
  not a repeatable sync; FR-023 governs re-run behavior after that point.
- ChatGPT (Custom GPT + Action) is the only mandatory Q&A/mutation delivery surface for
  this feature and is what SC-004, SC-005, and SC-006 are measured against. Claude.ai
  (custom connector/MCP), if configured per the constitution's "Q&A delivery surface"
  allowance, is optional and best-effort — it may reuse the same tools, but its
  behavior does not gate any success criterion or acceptance test in this spec.
