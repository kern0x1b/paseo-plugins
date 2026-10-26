# Contributing

Issues and pull requests are welcome. Conventions that apply to every package live here and in
[AGENTS.md](AGENTS.md). Package-specific rules live in the package's own `AGENTS.md` or `docs/`.

## Setup

```bash
npm install          # one install for the whole repository; also enables the commit-msg hook
npm run check        # format check, typecheck and tests across all packages
```

Run a single package with `npm test -w paseo-gitlab` or `npm run typecheck -w paseo-usage-sidebar`.

## Before you open a pull request

- `npm run check` passes and the tests stay offline.
- Plugin changes are loaded into a live Paseo (`paseo plugin add ./plugins/<name>`, then
  `paseo plugin reload <id>`) and checked on a light and a dark theme.
- The package's `CHANGELOG.md` Unreleased section is updated where the package has one.
- One concern per pull request.

## Where plugin code belongs

Paseo builds one bundle per entry and enforces the client/server boundary by directory.

| Path                          | Runs in           | Rules                                                        |
| ----------------------------- | ----------------- | ------------------------------------------------------------ |
| `index.client.tsx`, `client/` | App               | React, React Native, DOM allowed. Must not import `server/`. |
| `index.server.ts`, `server/`  | Daemon subprocess | `node:*` allowed. Must not import `client/`.                 |
| `shared/`                     | Both              | Zod contracts and pure helpers only. No platform APIs.       |

A module left at the plugin root is a compile error.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), checked by `.githooks/commit-msg`:

```text
<type>[(scope)][!]: <subject>
```

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Scope is the package name without the `paseo-` prefix: `fix(gitlab): ...`.
- Lower-case subject, no trailing period, header up to 100 characters.
- `!` marks a breaking change and needs a `BREAKING CHANGE:` footer.

Skip the hook for one commit with `git commit --no-verify`.

## Releases

Each package is versioned independently and tagged `<package>@<version>`, for example
`paseo-gitlab@1.2.0`. Update the package's `package.json` version and `CHANGELOG.md` in the same pull
request.
