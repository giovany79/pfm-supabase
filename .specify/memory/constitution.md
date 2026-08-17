<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0
- Modified principles:
  - V. Anti-Hallucination in Financial Q&A (NON-NEGOTIABLE) — expanded (not
    redefined) to cover conversational mutations (create/edit/permanent-delete
    of transactions) alongside read-only Q&A: mutations MUST be explicitly
    confirmed, executed only through the same narrow parameterized tools, and
    logged for audit, in addition to the existing grounding/traceability rules
    for read answers.
- Added sections:
  - Additional Constraints → new bullet "Mutation confirmation & audit
    logging" (confirmation lifecycle + minimal non-sensitive audit schema for
    any create/edit/delete on transaction records, on any surface)
- Modified sections:
  - Additional Constraints → "Q&A delivery surface" bullet: replaced the
    blanket "read-only guarantees do not [change]" language with an explicit,
    narrow carve-out — the read-only constraint is relaxed only for the
    confirmed, audited transaction-mutation operations the feature spec
    defines, everything else about that bullet (auth, narrow parameterized
    tools, no-raw-SQL, logging requirement) still applies and is now cross-
    referenced to the new audit-logging bullet.
- Removed sections: none
- Rationale for MINOR bump: materially expands existing guidance (Principle V
  and the Q&A delivery surface constraint) to accommodate conversational
  mutations that were absent from 1.1.0; no principle or existing guarantee is
  removed — read-only Q&A keeps every prior guarantee, mutations add new,
  additive ones (confirmation + audit).
- Trigger: /speckit-clarify decision (CA1, CA3) for feature
  001-personal-finance-platform, session 2026-08-09 — spec.md FR-015–FR-023
  require conversational CRUD that the prior 1.1.0 read-only guarantee
  prohibited; this amendment resolves that conflict per Governance rules.
- Templates requiring follow-up: plan.md and tasks.md for the
  001-personal-finance-platform feature MUST be updated (via /speckit-plan and
  /speckit-tasks) to implement the confirmation lifecycle, the minimal audit
  schema, and the client separation (service-role vs RLS-scoped) this
  amendment assumes — not yet done as of this amendment.
- Deferred TODOs: none
-->

# PFM Supabase Constitution

## Core Principles

### I. Data Integrity & Fidelity
Migration and any transformation of personal finance data (from `balance-sheet.csv`,
`pfm-gio.csv`, or any future source) MUST preserve amounts, dates, currencies, and
categories exactly as recorded in the source. No row, field, or precision MAY be
dropped, rounded, or silently reinterpreted during migration or sync. Any
discrepancy, ambiguity, or data-quality issue found in a source file MUST be
surfaced explicitly (e.g., as a migration warning or a `[NEEDS CLARIFICATION]`
marker in the spec) rather than resolved by silent assumption. Every derived value
(totals, aggregates, computed balances) MUST be traceable back to the source rows
that produced it.

**Rationale**: This is a financial record system. Silent data loss or reinterpretation
undermines the entire purpose of centralizing personal finance data and makes every
downstream query and dashboard untrustworthy.

### II. Privacy & Security of Financial Data
This system holds sensitive personal financial data for a single individual. Access
to the Supabase project MUST be restricted via Row Level Security policies and
service credentials scoped to the minimum required privilege — no table or view is
publicly readable by default. Secrets (Supabase URL, anon/service keys, API keys for
any LLM provider) MUST NOT be committed to the repository or hard-coded; they MUST
be sourced from environment variables or a secrets manager. Financial data MUST NOT
be logged in plaintext, included in error messages sent to third-party services, or
sent to any external API beyond what is strictly required to serve the feature
(e.g., an LLM call for the Q&A feature) without the data being scoped to what that
call needs.

**Rationale**: A leak or accidental exposure of personal income, expense, and asset
data has real personal consequences; the cost of enforcing least-privilege access
and secret hygiene up front is far lower than the cost of a breach.

### III. Spec-Driven Development
Every feature MUST go through the Spec Kit lifecycle — `/speckit-specify` →
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement` — before code is written.
Specifications MUST remain technology-agnostic and describe user-observable behavior
and outcomes, not implementation details. Implementation MUST NOT begin from an
ambiguous or unreviewed spec; unresolved `[NEEDS CLARIFICATION]` markers MUST be
resolved (via `/speckit-clarify` or direct user input) before planning proceeds to
task breakdown.

**Rationale**: Keeping specs implementation-free and clarified before planning
prevents scope drift and rework, and keeps this single-maintainer project auditable
months later when context has faded.

### IV. Simplicity (Single-User Scope)
This is a single-user, personal-use system. Designs MUST NOT introduce multi-tenancy,
role-based access control beyond a single owner, horizontal scaling infrastructure,
or other enterprise-grade complexity unless a concrete, stated need for it exists.
When two designs satisfy the same requirement, the one with fewer moving parts,
fewer dependencies, and less operational overhead MUST be preferred. Complexity that
cannot be justified by an actual requirement in the spec MUST be removed or deferred.

**Rationale**: Over-engineering a personal finance tool for hypothetical multi-user
or enterprise scale wastes effort that should go into correctness, security, and
usability for its one real user.

### V. Anti-Hallucination in Financial Q&A (NON-NEGOTIABLE)
The natural-language Q&A feature MUST ground every answer in actual data retrieved
from Supabase for that query — it MUST NOT invent, estimate, or extrapolate figures,
trends, or categories that are not backed by a retrieved record or a computation
over retrieved records. Every numeric answer MUST be traceable to the underlying
rows or aggregation query that produced it, and the system MUST clearly indicate
when it cannot answer a question because the underlying data is missing or
insufficient, rather than producing a plausible-sounding guess.

The same conversational surface MAY also apply create, edit, or permanent-delete
operations to transaction records when the feature spec explicitly requires it, but
only under all of the following: (a) the operation MUST be presented back to Gio in
interpreted form and applied only after his explicit, freshly-stated confirmation —
an unconfirmed, ambiguous, or stale confirmation MUST NOT mutate any record; (b) the
operation MUST execute only through the same narrow, parameterized tools this
principle already requires for reads — never free-form SQL, and never a broader
operation than the one confirmed; (c) every mutation attempt, successful or not,
MUST be logged per the audit-logging rule in Additional Constraints, so the
mutation itself is traceable even though the final chat text composed by an
external calling product is not (see "Q&A delivery surface" below). Grounding and
read traceability remain non-negotiable and unaffected by this allowance.

**Rationale**: A confidently wrong number about someone's own finances is worse than
no answer — it can drive real financial decisions. Grounding and traceability are
non-negotiable for this feature to be trustworthy. Extending the same surface to
confirmed, audited mutations (rather than building a separate write path) keeps the
system simple (Principle IV) while ensuring every change is still deliberate,
attributable, and reviewable after the fact.

## Additional Constraints

- **Backend**: Supabase (Postgres) is the system of record for migrated financial
  data. Schema changes MUST preserve the integrity guarantees of Principle I
  (migrations MUST be reversible or MUST be accompanied by a verified backup of the
  affected data before running).
- **Source data**: `balance-sheet.csv` (asset/liability snapshots) and `pfm-gio.csv`
  (income/expense transactions) are the current source-of-truth inputs for
  migration. Their column semantics (e.g., `kind`, `category`, `Income/expensive`)
  MUST be mapped explicitly and documented in the relevant spec/plan — not inferred
  silently by migration code.
- **Q&A and dashboard features**: Any LLM or analytics integration MUST read from
  the migrated Supabase data, not from the raw CSVs, once migration for a given
  dataset is complete, to avoid two divergent sources of truth.
- **Q&A delivery surface**: The Q&A tool surface (Principle V) MAY be exposed
  through more than one LLM chat product the sole owner already has access to —
  e.g. a Claude.ai custom connector (MCP) and/or a ChatGPT Custom GPT (Actions) —
  instead of, or in addition to, an in-app call to a separately billed LLM API,
  to avoid paying twice for functionality an existing subscription already
  covers. Each exposed surface MUST authenticate the caller with a single-owner
  secret (a static bearer token is sufficient per Principle IV — no OAuth flow
  is required for a one-person system) and MUST expose only the same narrow,
  parameterized tools Principle V already requires — the transport changes, and
  the no-raw-SQL guarantee does not. The read-only guarantee is relaxed only for
  the specific, explicitly confirmed create/edit/permanent-delete transaction
  operations Principle V and the feature spec define — every other operation
  exposed by a tool remains read-only. Because the calling chat product, not
  this system, composes the final answer text on these surfaces, this system
  cannot verify Principle V's read-traceability guarantee end-to-end for every
  reply; each tool call (read or mutation) MUST still be logged per the
  "Mutation confirmation & audit logging" rule below as the audit trail of what
  data was accessed or changed, and each tool's own description/output MUST
  instruct the calling model to ground its answer in that data, to say so
  plainly when a call returns zero rows, and to only apply a mutation after
  Gio's explicit confirmation of that exact operation.
- **Mutation confirmation & audit logging**: Any create, edit, or
  permanent-delete operation on transaction records — on the dashboard/API or
  any Q&A delivery surface — MUST require Gio's explicit, freshly-stated
  confirmation of the specific interpreted change immediately before it is
  applied; an unconfirmed, ambiguous, or stale/expired confirmation MUST NOT
  mutate data. Every mutation attempt, successful or not, MUST be logged with a
  minimal, non-sensitive schema: tool/endpoint name, operation type
  (create/edit/delete), affected transaction ID, timestamp, actor (the single
  owner), and outcome (success/failure). Per Principle II, this log MUST NOT
  persist the financial field values themselves — amount, description,
  category, account/institution, or any other real monetary content — in
  plaintext or in any other recoverable form; the logger MUST redact or omit
  those fields from the tool-call input before persisting. Read-only Q&A calls
  continue to log tool name, non-financial input parameters (e.g. date range,
  category filter), row count, and timestamp as already required.

## Development Workflow

- Every feature begins with `/speckit-specify` producing a technology-agnostic spec;
  ambiguities are resolved with `/speckit-clarify` before `/speckit-plan`.
- `/speckit-plan` and `/speckit-tasks` MUST reflect the constraints in this
  constitution (data integrity, privacy/security, simplicity) as explicit
  considerations, not afterthoughts.
- `/speckit-implement` MUST NOT introduce behavior not traceable to a task derived
  from the spec. Deviations required by technical reality MUST be reflected back
  into the spec/plan rather than left undocumented in code.
- Before a feature touching financial data or the Q&A feature is considered done,
  its acceptance scenarios MUST include at least one check against Principle I
  (data integrity) and, if applicable, Principle V (grounded answers).

## Governance

This constitution supersedes ad hoc practice for this project. Any Spec Kit
artifact (spec, plan, tasks) that conflicts with a principle here MUST be revised
before implementation proceeds, or the conflict MUST be resolved by amending this
constitution first.

**Amendment procedure**: Amendments are made by editing this file via
`/speckit-constitution`, which regenerates the Sync Impact Report at the top of the
file. Any amendment MUST state its rationale and MUST bump the version per the
semantic versioning policy below.

**Versioning policy**: MAJOR — backward-incompatible principle removal or
redefinition; MINOR — a new principle or materially expanded section is added;
PATCH — wording, clarification, or typo fixes with no semantic change.

**Compliance review**: Each `/speckit-plan` and `/speckit-implement` run SHOULD
re-check its artifacts against the Core Principles above; a principle violation
that cannot be justified MUST block progress until resolved or the constitution is
amended.

**Version**: 1.2.0 | **Ratified**: 2026-08-09 | **Last Amended**: 2026-08-09
