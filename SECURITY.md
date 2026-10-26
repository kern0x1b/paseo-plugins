# Security Policy

## Reporting a vulnerability

Report suspected vulnerabilities to **157722763+kern0x1b@users.noreply.github.com** or through
[GitHub Security Advisories](https://github.com/kern0x1b/paseo-plugins/security/advisories/new).
Do not open a public issue.

Include the package and its version (or commit), your Paseo version, steps to reproduce, and the
impact you believe the issue has.

## What to expect

| Stage                                                 | Target           |
| ----------------------------------------------------- | ---------------- |
| Acknowledgement of your report                        | 3 business days  |
| Initial assessment and severity                       | 10 business days |
| Fix released, or a dated plan if the fix takes longer | 90 days          |

You will be told when the fix ships. Reports are handled without attribution unless you ask for
credit. Please allow 90 days before disclosing publicly. If a vulnerability is being actively
exploited, the announcement is coordinated with you and moves faster.

## Safe harbour

No legal action is pursued against anyone who, in good faith, reports a vulnerability under this
policy, provided you:

- test only against your own installation, accounts, and tokens;
- do not access, modify, or exfiltrate data belonging to anyone else;
- do not degrade the service of any third party;
- give reasonable time to respond before disclosing.

## Supported versions

Only the latest release of each package receives fixes.

## Out of scope

- Vulnerabilities in Paseo itself or in the `@getpaseo/plugin` SDK. Report those to
  [Paseo](https://paseo.sh).
- Vulnerabilities in third-party services a package talks to, such as GitLab or Slack.
- Findings that require an attacker to already have local code execution as the user.

Package-specific security notes: [paseo-gitlab](plugins/paseo-gitlab/docs/security-model.md).
