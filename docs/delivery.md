# Delivery

Use the public [Aroha Retreat Project](https://github.com/orgs/ArohaRetreat/projects/1) for the website, Natura, developer docs, and MCP repositories. File work in the repository that owns it. The website is the default repository for new issues from the board.

- Use [Backlog](https://github.com/orgs/ArohaRetreat/projects/1/views/3) to triage open work. Set the native issue type to Bug, Feature, or Task. Change requests start as Task and can be classified as Feature during triage.
- Set a repository milestone for each issue and PR. Use Backlog triage while the outcome is open and Dependency maintenance for unplanned Dependabot PRs. Link implementing PRs to their issues and share the milestone when they deliver the same work. [Milestones](https://github.com/orgs/ArohaRetreat/projects/1/views/7)
- Choose work for the next two-week sprint in [Sprint planning](https://github.com/orgs/ArohaRetreat/projects/1/views/9). Review scheduled dates on the [Roadmap](https://github.com/orgs/ArohaRetreat/projects/1/views/4) and track open work by Status in [Kanban](https://github.com/orgs/ArohaRetreat/projects/1/views/8).
- Put prerequisite acceptance before the dependent pilot or rollout. Record hard gates through GitHub issue dependencies. When a gate moves, review the affected milestone and sprint dates together, then verify their order in Sprint planning and the Roadmap.
- Website issues and PRs enter the Project automatically. Add issues and PRs from the other three repositories through the Projects field. Review Project membership, issue type, and milestone coverage at sprint review.

Apply the [Firebase FinOps skill](../.agents/skills/firebase-finops/SKILL.md) when a change affects usage. Record estimated operations before implementation and link actual usage evidence after rollout.

## Public roadmap, releases and delivery lifecycle

The [public roadmap](https://aroharetreat.github.io/website/) summarizes outcomes, audiences and target windows from the Project. The [release notes](https://aroharetreat.github.io/website/releases/) track verified website, npm and developer docs releases. The [SDLC page](https://aroharetreat.github.io/website/sdlc/) diagrams CI checks, each release path and the evidence used to observe them. Use the [product launch procedure](../.agents/skills/app-launchpad/references/product-launch.md) from [App Launchpad 1.13.2](https://github.com/theharithsa/app-launchpad-template/releases/tag/v1.13.2).

The [Pages workflow](https://github.com/ArohaRetreat/website/actions/workflows/public-updates.yml) checks the public Project, npm and developer docs hourly and refreshes after the website Hosting workflow completes. It publishes only when the rendered site changes. Use **Run workflow** on `main` to refresh on demand.

In [the public content](public/updates.json), `scheduleIssue` identifies the issue whose native sprint sets each review window. The companion issues provide context. Adjust sprint dates and assignments in the Project. Edit this file for public wording, new review cards, and curated historical release notes.

Each release source has its own evidence.

- **Website.** A matching Firebase publication receipt from the official Hosting run confirms the deployment and live verification. The note comes from the public changelog at the deployed commit. The sync tracks production and pre-production separately and reconciles runs within the 14-day receipt retention window.
- **MCP.** The public npm registry supplies stable versions and their publication times. Every archive entry requires registry publication. A GitHub release for the same version can enrich an existing entry with notes.
- **Developer docs.** The custom domain and Firebase Hosting origin must serve matching release manifests. The package at the manifest's source commit must also match the version. The date is the Hosting manifest's last-modified date when valid or the first verified observation otherwise. Each observed source revision has its own permanent link. A build superseded between syncs can be missed, so run the workflow on demand after a deployment that needs a record immediately.

Dates are displayed in IST. The published history keeps earlier entries when a source is temporarily unavailable. If the archive itself cannot be read, publishing stops. The external sync usually adds one public npm metadata read and two static manifest reads per run. At one run per hour that is about 720 npm reads and 1,440 manifest reads in 30 days, plus bounded requests for new release copy. There are no new Firebase Functions, database reads, Storage objects or paid services for this sync.

Run `node scripts/build-public-updates.mjs` to preview curated content in `local/public-updates/`. With a GitHub token that has Actions read access, run `node scripts/sync-public-updates.mjs /tmp/aroha-updates.json` and build with that JSON as the first argument to preview the current sources. Verify the deployment and all three public routes. Pages-only pushes skip Firebase Hosting.

- [GitHub Project tracking procedure](../.agents/skills/app-launchpad/references/github-projects.md)
- [Issue-to-merge and release procedure](../.agents/skills/app-launchpad/references/github-release.md)
- [Authorization and safety](../.agents/skills/app-launchpad/references/safety.md)
- [Evidence states](../.agents/skills/app-launchpad/references/evidence.md)
- [Baseline repository ruleset](repository-ruleset.md)
- [Template versions and consumer upgrades](versioning.md)
