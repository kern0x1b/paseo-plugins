# Security model

How `paseo-gitlab` handles credentials and untrusted data. To report a vulnerability, follow the
repository's [SECURITY.md](../../../SECURITY.md).

## Scope

In scope:

- storage and handling of the GitLab personal access token (the OS keychain path and the
  server-side connection);
- the sanitiser for GitLab-rendered note and description HTML;
- the server-side image proxy (avatars and uploaded attachments) and its host allowlist;
- parsing of untrusted GitLab responses (diffs, job logs, uploads) before they reach the UI;
- the demo backend, if it can be reached for a host that is not the demo host.

Out of scope:

- vulnerabilities in Paseo itself, or in the `@getpaseo/plugin` SDK — report those to
  [Paseo](https://getpaseo.com);
- vulnerabilities in GitLab — report those to
  [GitLab](https://about.gitlab.com/security/disclosure/);
- findings that require an attacker to already have local code execution as the user, or read
  access to the OS keychain;
- issues in a GitLab instance you connect to.

## Design notes

The token is verified against GitLab, then stored in the OS keychain (on macOS via `security`,
one item per host), written through stdin rather than argv, and never returned to the plugin's
client side. Only **https** hosts are accepted, because the token travels in every request.
Avatars and uploaded images are fetched server-side and only from the connected host; images are
identified by their magic bytes and SVG is never inlined. Note and description HTML is sanitised
against an allowlist. The demo backend answers only for the host `https://demo.gitlab.local` and
makes no network calls.
