# Domain engine (framework-free)

Pure TypeScript business logic: size, material, diameter, developed length,
weight, pricing, rounding, accessories, descriptions.

Rules (handoff §1, §9):

- **No React, no Inertia, no DOM, no Laravel.** Plain functions over plain data.
- Desktop and mobile presentation share this one engine — business logic is
  never duplicated into a component.
- Verified against the R0b golden fixtures in `../../../../fixtures/golden/`.

`domain-boundary.test.ts` enforces the import rule.
