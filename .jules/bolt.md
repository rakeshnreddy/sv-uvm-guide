
## 2024-05-18 - [React.memo on expensive syntax highlighters]
**Learning:** SyntaxHighlighter within `CodeBlock` components are deeply nested and expensive to render. As these are commonly used across MDX and project pages, they become a performance bottleneck when parent components (like layouts or theme switchers) trigger re-renders.
**Action:** Always wrap heavy, text-rendering UI components like `CodeBlock` with `React.memo` to skip unnecessary re-renders when their text and style props remain identical.

## 2024-11-06 - Optimized Reward Filtering in RewardRecognitionHub
**Learning:** Performing multiple filter passes on large arrays within a component's render body can lead to O(N*M) complexity if filters depend on each other (e.g., using .includes() on a filtered result). Consolidating filters and using Sets for lookups significantly improves performance.
**Action:** Always use useMemo for derived array data and prefer Sets for membership checks when filtering one array based on another.
