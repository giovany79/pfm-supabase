---
description: Write a testable, technology-agnostic feature specification in the project's Spec Kit format.
argument-hint: Describe the feature, its users, goals, constraints, and known edge cases.
---

# Write a Feature Specification

Create a feature specification from the following description:

```text
Requiero migrar a una base de datos supabase los archivos de finanzas personales que se encuentran en archivos de excel. balance-sheet.csv y pfm-gio.csv. El objetivo es poder consultar y analizar los datos de finanzas personales de manera más eficiente y centralizada, utilizando Supabase como backend. Los archivos contienen información sobre ingresos, gastos, activos y pasivos, y se requiere que la migración preserve la integridad de los datos y permita realizar consultas complejas posteriormente.

Adicionalmente quiero tener una funcionalidad tipo  gpt que me permita hacer preguntas sobre mis finanzas personales y obtener respuestas basadas en los datos migrados a Supabase. Esta funcionalidad debe ser capaz de interpretar consultas en lenguaje natural y devolver información relevante de manera precisa y rápida.

Tambien requiero tener la posibilidad de tener un dashboard que me permita visualizar de manera clara y concisa mis finanzas personales, incluyendo gráficos y métricas clave que me ayuden a entender mi situación financiera actual y tomar decisiones informadas.
```

Use `.specify/templates/spec-template.md` as the source of truth for the document structure. Preserve its heading order, replace every applicable placeholder with concrete content, and remove optional sections that do not apply.

## Writing rules

- Describe **what** users need and **why** it matters; do not prescribe languages, frameworks, APIs, database schemas, or code structure.
- Write for product and business stakeholders in clear, plain language.
- Make reasonable assumptions when details are missing and record them in `Assumptions`.
- Use at most three `[NEEDS CLARIFICATION: specific question]` markers, and only when the decision materially changes scope, security/privacy, or user experience and no safe default exists.
- Prioritize user stories as independently testable slices: P1 is the smallest viable release, followed by P2, P3, and so on.
- Give every user story a clear independent test and Given/When/Then acceptance scenarios.
- Make every functional requirement atomic, unambiguous, testable, and uniquely numbered (`FR-001`, `FR-002`, ...).
- Include key entities only when the feature creates, reads, updates, or relates data.
- Make success criteria measurable, verifiable, and technology-agnostic; include user outcomes as well as relevant time, quality, or volume targets.
- Cover boundary conditions, invalid input, unavailable dependencies, authorization failures, duplicate actions, and empty states when relevant.
- Do not leave template instructions, examples, empty placeholders, or `N/A` in the completed specification.

## Required output format

```markdown
# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Created**: [YYYY-MM-DD]

**Status**: Draft

**Input**: User description: "[ORIGINAL FEATURE DESCRIPTION]"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - [Brief Title] (Priority: P1)

[Plain-language user journey]

**Why this priority**: [User or business value]

**Independent Test**: [How this story can be verified on its own and what value it delivers]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [observable outcome]
2. **Given** [initial state], **When** [action], **Then** [observable outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Repeat the same fields; add or remove stories as justified by the feature]

### Edge Cases

- [Boundary condition and expected behavior]
- [Failure condition and expected behavior]

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST [specific, testable capability].
- **FR-002**: Users MUST be able to [specific, testable interaction].

### Key Entities

- **[Entity]**: [What it represents, its important attributes, and relationships—without implementation details]

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: [Measurable, technology-agnostic user outcome].
- **SC-002**: [Measurable quality, time, or volume outcome].

## Assumptions

- [Reasonable default or scope assumption used to complete the specification].
```

Before returning the specification, silently verify that all mandatory sections are complete, requirements are testable, acceptance scenarios cover the primary flows, success criteria are measurable, scope is bounded, and implementation details have not leaked into the document. Return only the completed Markdown specification.
