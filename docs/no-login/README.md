# No-login mode

Owner decision (2026-10-18): "do not block anything for login; we can eventually implement it and guard it as
required; the initial site should work completely."

- `area-maps.json`: every login, database and feature-flag dependency, area by area, and what an anonymous visitor
  saw before this work (workflow `wf_00e2acf0-bcb`, Map phase).
- `design.json`: the architecture, the decision for each feature, and the work packages (Design phase).
- `critiques.json`: two adversarial reviews of the design (completeness, feasibility). Their gaps are folded into
  the implementation plan.
- `implementation-plan.json`: the revised work packages, with disjoint file ownership, that the implementation
  workflow builds. It is written by that workflow.
