# Roadmap

## AI articles — current scope (18 October 2026)

All article writing, including an automatic revision, uses [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) through the existing writer task. The saved publication setting controls reasoning effort and the fixed credit price:

| Quality            | Writer effort | Credits per article |
| ------------------ | ------------- | ------------------- |
| Standard (default) | `high`        | 1                   |
| High               | `xhigh`       | 2                   |
| Ultra              | `max`         | 3                   |

The price includes the existing research, review and one automatic full revision. Manual and scheduled generation capture the selected quality before reserving credits; changing settings during a run does not change its price or effort. Technical failures return the reservation. An explicit stop charges only when useful text has been saved for recovery.

## Deferred: article cost controls

Revisit these only when measured usage shows a need:

- [ ] USD pricing for provider calls, including cache, reasoning, search, images and embeddings.
- [ ] An article cost report grouped by attempt, stage and model.
- [ ] Targeted section revisions instead of the existing full rewrite.
- [ ] Per-run revision budgets and daily spend caps.
- [ ] Separate optional style advice from issues that block publication.

The prototype is saved in the Git stash named `wip(roadmap): article cost controls — USD pricing, cost report, targeted revision, spend caps` (snapshot `f04edcc85c1c60b60fd74debb7b086216c217643`). It also contains `article-cost-controls-mixed-files.patch` for changes in files shared with the current implementation. Restore it on a separate branch and reconcile that patch with the Luna effort settings before using it. Recheck provider prices and model IDs at that point.

The current pipeline retains provider token attribution and the existing editorial checks; it has no USD pricing, cost-report endpoint or spend caps.
