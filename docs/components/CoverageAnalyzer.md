# CoverageAnalyzer

The `CoverageAnalyzer` component demonstrates coverage-driven verification concepts in a visual, interactive way.

## Interactive Controls

- **Example Selector** – choose from coverage scenarios.
- **Play/Pause/Reset** – dynamically collect coverage across steps.
- **Next/Previous** – step through the verification flow manually.
- **Download JSON/HTML** – export coverage reports.

## Visualization

- Cross coverage matrices highlight covered bins in green and holes in red.
- Requirements progress bars track goals for each coverpoint.
- Coverage holes list includes closure strategies for unmet bins.

## Verification Flow

The step display shows the coverage-driven verification process: define coverage model, collect coverage, analyze holes, and close coverage via targeted tests.

## Usage Example

```tsx
import CoverageAnalyzer from '@/components/animations/CoverageAnalyzer';

<CoverageAnalyzer />
```
