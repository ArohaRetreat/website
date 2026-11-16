# Delivery

## Weekly production release

Merge and verify changes in pre-production as they are ready. Every Sunday (Asia/Kolkata), the Aroha maintainer reviews the accepted changes in the release milestone and approves one production promotion. Keep the candidate version stable across pre-production builds, identified by source revision and CI run. Use minor releases for compatible features and patch releases for fixes. Release approval and the checked promotion PR control publication. Skip an empty or unready release window. Critical outages and urgent fixes can use a separately approved, tested patch.

The [Aroha Retreat Project](https://github.com/orgs/ArohaRetreat/projects/1) tracks the planned release milestone separately from the two-week sprint.

## Documentation review

Every PR records a visible decision under **Documentation impact**. Use one of these lines.

```text
Updated: <affected guides or links>
No change: <reason the guides still apply>
```

Foundation CI checks for the entry. The PR review checks the accuracy and scope of the decision, including for Dependabot. Use the [Aroha handbook](https://aroharetreat.github.io/website/handbook/) for public instructions and keep private operational details in the owning service's documentation.

These practices and the bundled skill were adopted from [App Launchpad 1.14.0](https://github.com/theharithsa/app-launchpad-template/releases/tag/v1.14.0), source `97aff26610feed99e9d0329c8eab4ea33794c1ed`. The template metadata records the original scaffold.

- [Issue-to-merge and release procedure](../.agents/skills/app-launchpad/references/github-release.md)
- [Authorization and safety](../.agents/skills/app-launchpad/references/safety.md)
- [Evidence states](../.agents/skills/app-launchpad/references/evidence.md)
- [Baseline repository ruleset](repository-ruleset.md)
- [Template versions and consumer upgrades](versioning.md)
