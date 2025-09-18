# Pull Request Checklist

Every contribution should ship with a quick self-review. Use this checklist before opening a PR and again before requesting review. It keeps curriculum pages aligned with the topic template, protects the visual system, and ensures automated checks continue to pass.

## Content & Template Alignment
- [ ] Topic pages follow the Quick Take → References & Next Topics structure (`docs/topic-template.mdx`).
- [ ] `docs/topic-template-migration.md` is updated for any curriculum page converted to the new template.
- [ ] Front matter includes `title`, `description`, and `flashcards` identifiers.
- [ ] Cross-links, references, and slugs match the canonical paths in `COMPREHENSIVE_CURRICULUM_MODULE_MAP.md`.

## Visual & Interaction Review
- [ ] Screens, components, and illustrations comply with the guidance in `docs/visual-design-guide.md` (spacing, glass-card usage, accessibility states).
- [ ] Animations respect reduced-motion preferences and follow the motion utilities defined in the design guide.
- [ ] Added imagery or embeds include descriptive `alt` text and keyboard-accessible controls.

## Testing & Automation
- [ ] `npm run lint` passes locally.
- [ ] `npm run type-check` passes locally.
- [ ] `npm run test` (or the targeted subset) passes locally, including `tests/topicTemplate.spec.ts` for migrated curriculum pages.
- [ ] `npm run audit:uvm-factory` passes when UVM sources change.
- [ ] Playwright or lab smoke tests are run when interactive behaviour, routing, or curriculum data changes.

## Documentation & Tracking
- [ ] Relevant planning docs (`TODO.md`, `MASTER_PLAN.md`, or module trackers) reflect scope changes.
- [ ] Changelogs or release notes are updated when behaviour changes impact learners or contributors.
- [ ] Screenshots, GIFs, or Loom walkthroughs are attached when visual updates are non-trivial.

_Need a printable copy? Drop this file into your notes or reference it directly from the repository._
