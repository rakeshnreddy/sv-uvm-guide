# CodeReviewAssistant

The `CodeReviewAssistant` component provides a lightweight, client-side simulation of a typical peer-review workflow. It bundles automated checks for documentation, tests, architecture, and coding standards while allowing reviewers to leave comments and approve a commit.

## Automated Checks

Each check uses the generic `useTimedCheck(delay, details)` hook, which returns a `CheckResult` object with a `status` (`"pending" | "pass" | "fail"`) and optional `details` message. The hook simply resolves after the provided delay with the supplied details.

The component invokes this hook to simulate checks for documentation, tests, architecture, and coding standards, but any additional timed verification could be added in the same way.

## Expected Inputs

The review form collects three pieces of information from reviewers:

- **Commit ID** – A SHA string (7–40 hexadecimal characters) identifying the commit under review.
- **Comment** – Free‑form feedback text. Multiple comments can be submitted.
- **Approval Toggle** – A boolean flag indicating whether the review has been approved.

## Peer‑Review Workflow

1. **Commit ID** – Reviewers supply the hash of the commit being inspected. The field validates input against a Git SHA regex and shows an error if the value is invalid.
2. **Comments** – Reviewers can leave multiple textual comments which are listed below the form. Each comment is sent to `/api/reviews`, and any server response errors are displayed.
3. **Approval Toggle** – Once satisfied, the reviewer can mark the review as approved. The approval state is also posted to `/api/reviews`, and failures are surfaced to the user. A confirmation message appears when approval is set.

## Usage Example

The component is showcased on the [Interactive Demo page](../../src/app/practice/interactive-demo/page.tsx) where it is rendered without props:

```tsx
import { CodeReviewAssistant } from '@/components/ui/CodeReviewAssistant';

// …within the page component
<CodeReviewAssistant />
```

This demo illustrates how the assistant might be embedded alongside other interactive learning tools.

