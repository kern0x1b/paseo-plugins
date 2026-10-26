# Development

Setup, commit rules and the client/server directory layout are in the repository's
[CONTRIBUTING.md](../../../CONTRIBUTING.md). This file keeps what is specific to this plugin.

If you change behavior, update both `README.md` and `README.zh-CN.md`.

## Tests

`npm test` runs Node's own test runner against the TypeScript sources directly: no test framework
and no extra dependencies. `test/loader.mjs` is a resolver hook that restores the `.ts` extension the
plugin's bundler-style imports omit, so tests can import `../../shared/…` as written.

Add a case under `test/` next to the existing ones. Anything with a decision worth reviewing — the
colour ramp, the window labels, the dropped-session classifier — is worth a table-driven test.

`PASEO_USAGE_SIDEBAR_FAULT=proven|suspected|unrelated` makes `readUsage` fail on demand, which is how
the dropped-session UI is exercised without suspending the machine and waiting for the daemon's lease
to expire.
