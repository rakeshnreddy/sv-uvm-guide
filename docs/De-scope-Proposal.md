# De-scope Proposal

This document outlines the specific UI elements, pages, and components recommended for removal or feature-flagging to align with the "Learning-First" objective and improve performance.

## 1. UI Components & Pages to Feature-Flag

The following features provide no immediate learning value and are either mock implementations or placeholders for future functionality. They should be disabled by default using the `featureFlags.ts` utility.

| Feature / Page(s) | Component(s) / Route(s) | Proposal | Feature Flag | Re-enable Instructions |
|---|---|---|---|---|
| **Community Features** | `/app/community/**` | Flag | `community` | Set `community: true` in `featureFlags.ts` and re-deploy. |
| **User Dashboard** | `/app/dashboard/**` | Flag | `tracking` | Set `tracking: true` in `featureFlags.ts` and re-deploy. |
| **User Settings** | `/app/settings` | Flag | `accountUI` | Set `accountUI: true` in `featureFlags.ts` and re-deploy. |
| **Notifications** | `/app/notifications` | Flag | `accountUI` | Set `accountUI: true` in `featureFlags.ts` and re-deploy. |
| **User History** | `/app/history` | Flag | `tracking` | Set `tracking: true` in `featureFlags.ts` and re-deploy. |
| **User Projects** | `/app/projects` | Flag | `tracking` | Set `tracking: true` in `featureFlags.ts` and re-deploy. |
| **Assessments** | `/app/assessment` | Flag | `tracking` | Set `tracking: true` in `featureFlags.ts` and re-deploy. |

## 2. Heavy Components Used by Mock Features

By flagging the pages above, the following heavy components will no longer be included in the initial bundles for any core learning paths, providing a significant performance boost.

- `components/assessment/ProgressAnalytics.tsx` (uses `d3`)
- `components/assessment/SkillMatrixVisualizer.tsx` (uses `d3`)
- `components/charts/HistoryTimelineChart.tsx` (uses `recharts`)
- `components/gamification/EngagementEngine.tsx` (uses `recharts`)

**Recommendation:**
Implement task `[L3]` to wrap the page components for these routes in a feature flag check. This is the quickest path to realizing the performance gains.