## 2025-03-19 - React Optimization using D3 submodules vs single bundle
**Learning:** React memoization (`React.memo`, `useMemo`) is highly effective for charts to avoid re-rendering D3 computations, however, trying to import submodules directly like `d3-scale`, `d3-array`, and `d3-axis` can introduce unexpected dependencies that break tests if the packages are not individually installed.
**Action:** Always prefer the project's existing main `d3` package configuration rather than attempting to install new micro-packages, preserving the strict project boundaries concerning `package.json`.
