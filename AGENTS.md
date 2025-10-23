<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds all extension logic (`content.js`, `background.js`, popup assets, native bridge). Keep feature modules verbose but cohesive; shared utilities live beside their primary caller until reused at least twice.
- `build/` contains the Node-based bundlers (`build.js`, templates, obfuscator config). Treat it as tooling; changes here should remain backward compatible with existing manifests.
- `config/`, `docs/`, and `openspec/` store reference material, rollout notes, and host integration specs—update these whenever behavior or dependency contracts shift.
- `tests/` mirrors runtime concerns: `unit/`, `integration/`, `scripts/`, and `fixtures/`. Consult `tests/TEST_GUIDELINES.md` before adding new assets. `assets/` aggregates static icons and marketing images consumed by the Chrome store listing.

## Build, Test, and Development Commands
- Install dependencies once with `npm install`.
- `npm run build` produces an obfuscated unpacked bundle in `build/dist/` using the default manifest.
- `npm run build:test` keeps source maps and relaxed obfuscation for debugging.
- `npm run dist` cleans prior artifacts and performs a fresh production build.
- Run targeted diagnostics via `node tests/scripts/<script>.js`; keep usage notes inside each script header.

## Coding Style & Naming Conventions
- Use two-space indentation, trailing semicolons, and single quotes in JavaScript. Prefer `const` and `let`; avoid `var`.
- Follow `camelCase` for functions and variables, `SCREAMING_SNAKE_CASE` for immutable configuration (see `COS_DOMAIN`), and `PascalCase` only for classes or React-style components.
- Keep content scripts modular: export pure helpers to the top, append DOM wiring at the bottom, and co-locate CSS selectors near usage with descriptive names.
- Run `npm run build:test` to confirm formatting-sensitive sections (e.g., template literals) survive obfuscation.

## Testing Guidelines
- New automated tests belong under `tests/unit` or `tests/integration` and should mirror the `<feature>.<scope>.test.js` pattern.
- Manual harnesses reside in `tests/scripts`; document prerequisites and expected output in the opening comment block.
- Refresh or add fixtures under `tests/fixtures` whenever API contracts or DOM snapshots change. Never store production data.
- Record exploratory results in `docs/testing-guide.md` or link to external reports from the PR description.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`) with concise, action-oriented summaries. Reference modules (e.g., `content` or `native-host`) when helpful.
- Squash local work before pushing. Each PR should include: purpose summary, screenshots or screen recordings for UI-affecting changes, test or manual verification notes, and links to relevant issues.
- Flag security-sensitive modifications (native messaging, card-key validation, external endpoints) in the PR body and highlight required follow-up in `docs/` if behavior changes.

## Security & Configuration Tips
- Secrets and card-key values must never land in version control; use `.env.local` references and document expected keys inside `docs/NATIVE_HOST_SETUP.md`.
- When touching `config/` or native host installers, test across Windows (`install_native_host.bat`) and Unix (`install_native_host.sh`) flows, noting any elevation requirements.
