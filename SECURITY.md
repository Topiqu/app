# Security policy

## Supported versions

Security fixes target the current `main` branch. Older commits and forks do not receive a separate
maintenance guarantee. `dev` is the integration branch and should not be treated as a release.

## Report a vulnerability privately

Use [GitHub's private vulnerability reporting form](https://github.com/Topiqu/app/security/advisories/new).
Do not open a public issue containing a vulnerability, credentials, private URLs or customer data.
If private reporting is unavailable, contact a repository maintainer through a private contact
listed on their GitHub profile before sharing sensitive details.

Include the affected commit/version, the component, required access, expected and actual behavior,
and a minimal reproduction using synthetic accounts and data. Explain the impact and any proposed
fix. Redact cookies, tokens, private keys and personal data.

Test only your own isolated environment. Do not access other tenants, probe production availability,
send bulk email, spend provider quota or alter live billing, DNS, certificates or deployments.

Maintainers will coordinate validation, a fix and disclosure through the private report. Response
times and bounty payments are not guaranteed. Reporters should allow remediation before publishing
details that would put users at risk.
