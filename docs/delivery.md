# Delivery

Use the public [Aroha Retreat Project](https://github.com/orgs/ArohaRetreat/projects/1) for the website, Natura, developer docs, and MCP repositories. File work in the repository that owns it. The website is the default repository for new issues from the board.

- Use [Backlog](https://github.com/orgs/ArohaRetreat/projects/1/views/3) to triage open work. Set the native issue type to Bug, Feature, or Task. Change requests start as Task and can be classified as Feature during triage.
- Set a repository milestone for each issue and PR. Use Backlog triage while the outcome is open and Dependency maintenance for unplanned Dependabot PRs. Link implementing PRs to their issues and share the milestone when they deliver the same work. [Milestones](https://github.com/orgs/ArohaRetreat/projects/1/views/7)
- Choose work for the next two-week sprint in [Sprint planning](https://github.com/orgs/ArohaRetreat/projects/1/views/9). Review scheduled dates on the [Roadmap](https://github.com/orgs/ArohaRetreat/projects/1/views/4) and track open work by Status in [Kanban](https://github.com/orgs/ArohaRetreat/projects/1/views/8).
- Put prerequisite acceptance before the dependent pilot or rollout. Record hard gates through GitHub issue dependencies. When a gate moves, review the affected milestone and sprint dates together, then verify their order in Sprint planning and the Roadmap.
- Website issues and PRs enter the Project automatically. Add issues and PRs from the other three repositories through the Projects field. Review Project membership, issue type, and milestone coverage at sprint review.

This repository adopts the Project tracking guidance from [App Launchpad 1.13.1](https://github.com/theharithsa/app-launchpad-template/releases/tag/v1.13.1). Apply the [Firebase FinOps skill](../.agents/skills/firebase-finops/SKILL.md) when a change affects usage. Record estimated operations before implementation and link actual usage evidence after rollout.

- [GitHub Project tracking procedure](../.agents/skills/app-launchpad/references/github-projects.md)
- [Issue-to-merge and release procedure](../.agents/skills/app-launchpad/references/github-release.md)
- [Authorization and safety](../.agents/skills/app-launchpad/references/safety.md)
- [Evidence states](../.agents/skills/app-launchpad/references/evidence.md)
- [Baseline repository ruleset](repository-ruleset.md)
- [Template versions and consumer upgrades](versioning.md)
