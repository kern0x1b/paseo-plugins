# AGENTS.md

Guidance for automated agents and contributors. It applies to every package; a package's own
`AGENTS.md` adds rules specific to it.

## Layout

| Path       | Holds                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| `plugins/` | Paseo plugins. Each has a `paseo-plugin.json` and installs with `paseo plugin add`.       |
| `tools/`   | Standalone Node tools and skills that are not Paseo plugins.                              |
| Root files | Shared configuration: `tsconfig.base.json`, `.prettierrc.json`, `.githooks/`, `.github/`. |

Packages are npm workspaces with one lockfile. Shared dev dependencies (TypeScript, Prettier, the
Paseo SDK, React types) are declared once in the root `package.json`; a package declares only what
it needs at runtime.

## Commands

Run from the repository root.

```bash
npm install
npm run typecheck    # tsc --noEmit in every package that has a typecheck script
npm test             # node --test in every package; must not touch the network
npm run format       # prettier --write .
npm run check        # format:check, typecheck and test
```

A change is not done until `npm run check` passes. When a change is visual, reload the plugin in
Paseo and confirm it there.

## Conventions

- Every plugin `tsconfig.json` extends `tsconfig.base.json`. Do not copy compiler options into a plugin.
- Prettier is configured once at the root: `printWidth` 110, single quotes under `tools/`.

- Conventional Commits with a lowercase subject, enforced by `.githooks/commit-msg`.
- Package names are `paseo-<name>`. Package metadata (`license`, `repository.directory`, `engines`) is
  uniform; keep it that way when adding a package.
- English everywhere in code, documentation, and commits.
- Small, surgical changes. Do not reformat or refactor code you are not changing.

## Adding a package

1. Create `plugins/paseo-<name>` or `tools/paseo-<name>` with a `package.json` copied from a sibling.
2. For a plugin, add `paseo-plugin.json`, `OVERVIEW.md`, and a `tsconfig.json` that extends the base.
3. Add the package to the table in the root `README.md` and to the bug report template.
4. Run `npm install` and `npm run check`.

## No personal data

Never commit real usernames, company hostnames, tokens, absolute local paths, or screenshots that
show a real account or private work.
