# Paseo plugins

Plugins and tools for [Paseo](https://paseo.sh), kept in one repository.

## Plugins

Install any plugin straight from this repository by pointing at its folder:

```bash
paseo plugin add git:kern0x1b/paseo-plugins:plugins/<name>
```

| Folder | What it does |
| --- | --- |
| [`plugins/paseo-gitlab`](plugins/paseo-gitlab) | Mini GitLab in Paseo: explorer UI, CLI, event router and MCP server |
| [`plugins/paseo-usage-sidebar`](plugins/paseo-usage-sidebar) | Provider plan usage in the sidebar, matching Settings → Usage |
| [`plugins/paseo-midnight-theme`](plugins/paseo-midnight-theme) | Dark theme with a warm near-black background |
| [`plugins/paseo-retro-theme`](plugins/paseo-retro-theme) | Green phosphor CRT terminal theme |

Use `--ref <branch|tag|commit>` to pick a version for the first install.

## Tools

Standalone tools that are not Paseo plugins.

| Folder | What it does |
| --- | --- |
| [`tools/paseo-fleet`](tools/paseo-fleet) | Coordinator, Worker and Reviewer skills plus an event protocol |
| [`tools/paseo-slack`](tools/paseo-slack) | Mini Slack in Paseo: Web API access, event router and MCP tools |

## Layout

Each plugin is self-contained: its own `paseo-plugin.json`, `package.json` and `OVERVIEW.md`.
Run `npm install` and `npm run typecheck` inside the plugin folder.

## License

See the `LICENSE` file inside each folder.
