
## 2024-05-18 - [React.memo on expensive syntax highlighters]
**Learning:** SyntaxHighlighter within `CodeBlock` components are deeply nested and expensive to render. As these are commonly used across MDX and project pages, they become a performance bottleneck when parent components (like layouts or theme switchers) trigger re-renders.
**Action:** Always wrap heavy, text-rendering UI components like `CodeBlock` with `React.memo` to skip unnecessary re-renders when their text and style props remain identical.
## 2025-05-24 - [buildCurriculumStatus optimization]
**Learning:** `buildCurriculumStatus()` is a moderately expensive function call that gets called directly inside functional component bodies or inside useMemo without dependencies but it is an expensive calculation to run repeatedly.
**Action:** Memoize the result of `buildCurriculumStatus()` at the module level instead of within components to avoid re-calculating it.
