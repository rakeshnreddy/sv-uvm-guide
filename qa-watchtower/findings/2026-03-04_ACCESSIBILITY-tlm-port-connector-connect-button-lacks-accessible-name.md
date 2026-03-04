# Finding: TLMPortConnector connect button lacks an accessible name

- Date: 2026-03-04
- Feature ID: FEAT-W5-IUVM2-SPLIT
- Severity: P2
- Status: open

## Summary
The new `TLMPortConnector` interactive uses an icon-only button to start the connection handshake, but the control has no accessible name. Screen-reader and keyboard users can reach a blank button with no descriptive label, which makes the core lab action ambiguous.

## Affected Area
- Files:
  - `src/components/curriculum/interactives/TLMPortConnector.tsx`
  - `content/curriculum/T2_Intermediate/I-UVM-2B_TLM_Connections/index.mdx`
- Modules/Lessons:
  - I-UVM-2B TLM connections lab
- Test(s):
  - `tests/components/TLMPortConnector.test.tsx` (`QA_STRICT_A11Y_AUDIT=1`)

## Reproduction
1. Run `QA_STRICT_A11Y_AUDIT=1 npx vitest --run tests/components/TLMPortConnector.test.tsx`.
2. Observe the strict a11y audit fail because no button matches role `button` with name `/connect/i`.
3. Inspect the rendered DOM and note that the first button's accessible name is empty.

## Expected
The primary action to connect `seq_item_port` to `seq_item_export` should be discoverable through a meaningful accessible name.

## Actual
The icon-only connect button exposes role `button` with an empty accessible name.

## Root Cause Hypothesis
The control was implemented as a purely visual affordance and never received an `aria-label`, visible text, or assistive-only label.

## Suggested Fix Direction
- Add a descriptive `aria-label` such as `Connect seq_item_port to seq_item_export`.
- Optionally add a matching `title` or an `sr-only` text node so the control remains understandable across assistive technologies.
- Keep the label stable enough for future automated accessibility assertions.

## Verification to Close
- [ ] `QA_STRICT_A11Y_AUDIT=1 npx vitest --run tests/components/TLMPortConnector.test.tsx` passes.
- [ ] Keyboard and screen-reader users can identify the connect action unambiguously.
- [ ] Findings status updated to `closed`.
