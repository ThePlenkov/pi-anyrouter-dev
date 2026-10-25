# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| 1.x.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of pi-anyrouter seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to **security@theplenkov.com**.

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information in your report:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

This information will help us triage your report more quickly.

## Security Update Process

When we receive a security vulnerability report, we will:

1. Confirm the issue and determine its severity
2. Develop a fix
3. Release a patch version as soon as possible
4. Publish a security advisory on GitHub

## Scope

This security policy applies to the following packages:

- `@pi-anyrouter-dev/core`
- `@pi-anyrouter-dev/cli`
- All packages under the `packages/` directory

## Out of Scope

The following are considered out of scope for this security policy:

- Issues in third-party dependencies (please report those to the respective maintainers)
- Denial of service attacks that require excessive resource consumption
- Social engineering attacks
- Physical security issues

## Credits

We would like to thank the following researchers for responsibly disclosing security vulnerabilities:

- (None yet)

---

**Last updated:** 2025-10-25

**Note:** Version 0.1.x is currently supported as the project is pre-1.0. When 1.0.0 is released, the 0.x line will reach end-of-life per standard semantic versioning.