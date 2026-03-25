## 2024-03-15 - [Added Accessible Progress Bars and Controls to Coverage Analyzer]
**Learning:** Adding ARIA roles to custom visual progress bars (using `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`) drastically improves the screen-reader experience for components that only indicate progress via colored `div` widths. Adding context-specific `aria-label`s to controls like play/pause and selectors makes complex interactives more understandable.
**Action:** When building custom visual progress indicators, always ensure they are accompanied by the proper `role="progressbar"` and current value attributes, rather than relying on visual CSS properties alone.
## 2026-03-16 - Missing ARIA Labels on Icon-Only Navigation Buttons
**Learning:** The application's top-level navigation components (like the Navbar) frequently omit accessible labels for icon-only buttons (e.g., User Profile, Notifications, Search), which breaks screen reader usage for critical application features.
**Action:** Always ensure icon-only buttons have an appropriate `aria-label` and, for dropdown triggers, an `aria-expanded` attribute.
