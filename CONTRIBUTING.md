# Contributing to Topiqu

Discuss a substantial feature in an issue before starting. For a small fix, describe the problem and
the expected behavior in your pull request. Report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md).

## Local development

Follow [README.md](README.md) for setup and use the Bun and Node versions pinned in the repository.
Install with `bun install --frozen-lockfile`. Never commit `.env`, credentials, real customer data,
generated output, database dumps or test artifacts. Use a disposable local database for tests;
`TEST_DATABASE_URL` must be separate from `DATABASE_URL`.

Read [AGENTS.md](AGENTS.md) for project conventions and [MAP.md](MAP.md) for architecture. Use the
existing Nuxt UI controls, server authorization utilities and cache invalidation. Preserve tenant
isolation, SSR, accessibility and dark mode. Translate interface copy in English, Czech, German and
French; public reader copy also needs the content-only locale files described in AGENTS.md.

## Changes and verification

- Keep pull requests focused and include a regression test for behavior changes.
- Describe the problem, the resulting behavior and the checks you actually ran. Include screenshots
  for visible changes and migration/rollout notes when applicable.
- Use a concise Conventional Commit title, for example `fix(settings): refresh the topic plan`.
- Run the relevant tests first. The merge gates include `bun run lint`, `bun run prettier`,
  `bun run openapi:check`, `bun run typecheck`, `bun run test` and the production release smoke tests.
  Run expensive checks sequentially. CI owns the complete matrix.
- Author database changes in `prisma/schema.zmodel` / `prisma/models/*.zmodel`, include a complete
  additive migration and regenerate the ORM. Never run migrations against a shared or production
  database as part of a contribution check.
- Target `dev`. Maintainers promote reviewed changes to `main`; contributors should not deploy,
  alter DNS/TLS or change live provider configuration.

## License and conduct

Contributions to the project's AGPL-covered code are provided under [GNU AGPL v3](LICENSE), without
an additional contributor agreement. Preserve notices and licenses on third-party material and
separately licensed files. Participate according to [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
