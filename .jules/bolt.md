## 2025-05-14 - Optimized node lookup in UVM architecture diagram
**Learning:** Mapping over an array and performing an `Array.find` inside the map results in O(N*M) complexity. Pre-indexing the array into a Map allows for O(1) lookups, reducing total complexity to O(N+M).
**Action:** Use `useMemo` to create a lookup Map for collections when performing multiple lookups by ID in React components.
