# CodeReviewAssistant

The `CodeReviewAssistant` component provides a lightweight, client-side simulation of a typical peer-review workflow. It bundles automated checks for documentation, tests, architecture, and coding standards while allowing reviewers to leave comments and approve a commit.

## Custom Hooks

Each automated check is implemented as a custom React hook that returns a `CheckResult` object containing a `status` (`"pending" | "pass" | "fail"`) and optional `details` text.

- **`useDocumentationCheck()`** – Resolves after a short delay to report whether modules are documented.
- **`useTestCoverageCheck()`** – Simulates a test coverage verification.
- **`useArchitectureCheck()`** – Confirms that architectural patterns are followed.
- **`useCodingStandardsCheck()`** – Verifies adherence to the project's style guide.

All hooks take no arguments and are purely illustrative; they would typically accept configuration or data about the commit under review.

## Peer‑Review Workflow

1. **Commit ID** – Reviewers supply the hash of the commit being inspected.
2. **Comments** – Reviewers can leave multiple textual comments which are listed below the form.
3. **Approval Toggle** – Once satisfied, the reviewer can mark the review as approved. A confirmation message appears when approval is set.

## Usage Example

The component is showcased on the [Interactive Demo page](../../src/app/practice/interactive-demo/page.tsx) where it is rendered without props:

```tsx
import { CodeReviewAssistant } from '@/components/ui/CodeReviewAssistant';

// …within the page component
<CodeReviewAssistant />
```

This demo illustrates how the assistant might be embedded alongside other interactive learning tools.

