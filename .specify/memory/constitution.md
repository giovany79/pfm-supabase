<!--
Sync Impact Report
- Version change: none (template) → 1.0.0 (initial ratification)
- Modified principles: n/a (initial creation, no prior named principles)
- Added sections:
  - I. Data Integrity & Fidelity
  - II. Privacy & Security of Financial Data
  - III. Spec-Driven Development
  - IV. Simplicity (Single-User Scope)
  - V. Anti-Hallucination in Financial Q&A (NON-NEGOTIABLE)
  - Additional Constraints (technology stack context: Supabase, CSV source data)
  - Development Workflow (Spec Kit lifecycle expectations)
  - Governance (amendment procedure, versioning, compliance review)
- Removed sections: none (template placeholders only)
- Templates requiring follow-up: none — plan/spec/tasks templates read this file at
  runtime and are not modified by this command.
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

**Rationale**: A confidently wrong number about someone's own finances is worse than
no answer — it can drive real financial decisions. Grounding and traceability are
non-negotiable for this feature to be trustworthy.

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

**Version**: 1.0.0 | **Ratified**: 2026-08-09 | **Last Amended**: 2026-08-09
