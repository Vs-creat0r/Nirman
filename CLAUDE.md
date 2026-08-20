@AGENTS.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## UI & Form Field Rules
- **Number Inputs**:
  1. Never show up/down stepper spin buttons / arrows.
  2. Never allow mouse wheel scrolling to alter numeric values.
  3. Never allow negative numbers (all values must be >= 0). Blocking negative keydown and clamping `Math.max(0, val)` is mandatory.
