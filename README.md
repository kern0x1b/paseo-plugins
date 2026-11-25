# Paseo plugins

Plugins and tools for [Paseo](https://paseo.sh), kept in one repository.

## Plugins

Install any plugin straight from this repository by pointing at its folder:

```bash
paseo plugin add git:kern0x1b/paseo-plugins:plugins/<name>
```

| Folder                                         | What it does                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| [`plugins/paseo-gitlab`](plugins/paseo-gitlab) | Mini GitLab in Paseo: explorer UI, CLI, event router and MCP server |
| [`plugins/paseo-slack`](plugins/paseo-slack)   | Mini Slack in Paseo: Web API access, event router and MCP tools     |

Use `--ref <branch|tag|commit>` to pick a version for the first install.

## Tools and libraries

Standalone command-line tools and shared libraries. None of them is a Paseo plugin.

| Folder                                         | What it does                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`libs/paseo-fleet-kit`](libs/paseo-fleet-kit) | Shared library for adapters: channel events, subscriptions, dispatcher, daemon state |
| [`tools/paseo-fleet`](tools/paseo-fleet)       | Coordinator, Worker and Reviewer skills plus the event protocol                      |

## Connecting another platform

`tools/paseo-fleet` defines how platforms push events to an agent Coordinator, and Slack and GitLab are
the two reference adapters, both built on [`libs/paseo-fleet-kit`](libs/paseo-fleet-kit). To add Microsoft Teams, Jira or anything else, follow the
[adapter author guide](tools/paseo-fleet/protocol/author-guide.md): it lists every command an adapter
provides, the event shape, subscriptions, and the snapshot contract.

## Development

One `npm install` at the root sets up every package.

```bash
npm run check        # format check, typecheck and tests across all packages
npm test -w paseo-gitlab
```

Shared configuration is defined once at the root: `tsconfig.base.json`, `.prettierrc.json`,
`.githooks/commit-msg`, CI in `.github/workflows`, and the dev dependencies in `package.json`. Each
package keeps only its own code, `package.json`, `CHANGELOG.md` and docs. See
[CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).

## License

MIT, see [LICENSE](LICENSE).
