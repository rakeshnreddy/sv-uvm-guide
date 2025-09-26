# De-scope Proposal

This document outlines the specific UI elements, pages, and components recommended for removal or feature-flagging to align with the "Learning-First" objective and improve performance.

## 1. UI Components & Pages to Feature-Flag

The following features provide no immediate learning value and are either mock implementations or placeholders for future functionality. They should be disabled by default using the `featureFlags.ts` utility.

| Feature / Page(s) | Component(s) / Route(s) | Proposal | Feature Flag | Re-enable Instructions |
|---|---|---|---|---|
| **Community Features** | `/app/community/**` | Flag | `community` | Set `NEXT_PUBLIC_FEATURE_FLAG_COMMUNITY=true` (or `FEATURE_FLAGS_FORCE_ON=true`) and redeploy. |
| **User Dashboard** | `/app/dashboard/**` | Flag | `tracking` | Set `NEXT_PUBLIC_FEATURE_FLAG_TRACKING=true` (or `FEATURE_FLAGS_FORCE_ON=true`) and redeploy. |
| **User Settings** | `/app/settings` | Flag | `accountUI` | Set `NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI=true` (or `FEATURE_FLAGS_FORCE_ON=true`) and redeploy. |
| **Notifications** | `/app/notifications` | Flag | `accountUI` | Set `NEXT_PUBLIC_FEATURE_FLAG_ACCOUNT_UI=true` (or `FEATURE_FLAGS_FORCE_ON=true`) and redeploy. |
| **User History** | `/app/history` | Flag | `tracking` | Set `NEXT_PUBLIC_FEATURE_FLAG_TRACKING=true` (or `FEATURE_FLAGS_FORCE_ON=true`) and redeploy. |
| **User Projects** | `/app/projects` | Flag | `tracking` | Set `NEXT_PUBLIC_FEATURE_FLAG_TRACKING=true` (or `FEATURE_FLAGS_FORCE_ON=true`) and redeploy. |
| **Assessments** | `/app/assessment` | Flag | `tracking` | Set `NEXT_PUBLIC_FEATURE_FLAG_TRACKING=true` (or `FEATURE_FLAGS_FORCE_ON=true`) and redeploy. |

## 2. Heavy Components Used by Mock Features

By flagging the pages above, the following heavy components will no longer be included in the initial bundles for any core learning paths, providing a significant performance boost.

- `components/assessment/ProgressAnalytics.tsx` (uses `d3`)
- `components/assessment/SkillMatrixVisualizer.tsx` (uses `d3`)
- `components/charts/HistoryTimelineChart.tsx` (uses `recharts`)
- `components/gamification/EngagementEngine.tsx` (uses `recharts`)

**Recommendation:**
Implement task `[L3]` to wrap the page components for these routes in a feature flag check. This is the quickest path to realizing the performance gains.
