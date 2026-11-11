/**
 * The classes for the bank pages' question lists. The rows and their rich
 * text are HTML strings with no classes of their own (see rich-text-html.ts
 * for why); these scope classes, set once on the element around the list,
 * style them through descendant selectors. Written out in full: Tailwind finds
 * classes by reading the source text. Joined, not merged with cn: every
 * class has its own selector, so none may be dropped as a duplicate.
 */
/** Styles the rich text (rich-text-html.ts) inside the element that carries it. */
export const RICH_TEXT_SCOPE_CLASS = [
  // Running text holds the measure (PROSE_MEASURE_CLASS); code and tables use the full column.
  '[&_[data-rich]>p]:max-w-[30em] [&_[data-rich]>ul]:max-w-[30em] [&_[data-rich]>ol]:max-w-[30em]',
  '[&_[data-rich]]:[overflow-wrap:anywhere] [&_[data-rich]>*+*]:mt-3',
  '[&_[data-rich]_ul]:list-disc [&_[data-rich]_ol]:list-decimal [&_[data-rich]_ul]:pl-5 [&_[data-rich]_ol]:pl-5',
  '[&_[data-rich]_li]:pl-1 [&_[data-rich]_li+li]:mt-1.5 [&_[data-rich]_li::marker]:text-muted-foreground',
  '[&_[data-rich]_strong]:font-semibold',
  // Inline code: the raised surface, mono, no ligatures.
  '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5',
  '[&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.88em] [&_:not(pre)>code]:text-foreground [&_code]:[font-variant-ligatures:none]',
  // Code blocks: the code surface, dark in both modes; long lines scroll inside the block.
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-code-border [&_pre]:bg-code-surface',
  '[&_pre]:px-4 [&_pre]:py-3 [&_pre]:font-mono [&_pre]:text-code [&_pre]:text-code-foreground',
  // Scrolling regions (code, tables) are focusable: the shared focus ring.
  '[&_[data-scroll]:focus-visible]:outline-none [&_[data-scroll]:focus-visible]:ring-2 [&_[data-scroll]:focus-visible]:ring-primary',
  '[&_[data-scroll]:focus-visible]:ring-offset-2 [&_[data-scroll]:focus-visible]:ring-offset-background',
  // Tables.
  '[&_[data-table]]:overflow-x-auto [&_[data-table]]:rounded-lg [&_[data-table]]:border [&_[data-table]]:border-border',
  '[&_table]:w-full [&_table]:min-w-[34rem] [&_table]:border-collapse [&_table]:text-left [&_table]:text-ui [&_table]:[overflow-wrap:normal]',
  '[&_table_code]:whitespace-nowrap [&_thead]:bg-muted [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold',
  '[&_tbody_tr]:border-b [&_tbody_tr]:border-border [&_tbody_tr:last-child]:border-b-0 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
].join(' ');

/** Styles the question rows (question-html.ts) inside the element that carries it. */
export const QUESTION_LIST_CLASS = [
  RICH_TEXT_SCOPE_CLASS,
  // The list: rows divided by hairlines.
  '[&_[data-question-rows]]:divide-y [&_[data-question-rows]]:divide-border [&_[data-question-rows]]:border-y [&_[data-question-rows]]:border-border',
  // The row: a 44 px or taller target with the raised surface on hover and the focus ring.
  '[&_summary]:flex [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:list-none [&_summary]:items-start [&_summary]:gap-3',
  '[&_summary]:rounded-lg [&_summary]:px-3 [&_summary]:py-3.5 [&_summary::-webkit-details-marker]:hidden',
  '[&_summary]:transition-colors [&_summary]:duration-150 [&_summary]:ease-bench motion-reduce:[&_summary]:transition-none [&_summary:hover]:bg-muted',
  '[&_summary:focus-visible]:outline-none [&_summary:focus-visible]:ring-2 [&_summary:focus-visible]:ring-inset [&_summary:focus-visible]:ring-ring',
  '[&_[data-chevron]]:mt-1 [&_[data-chevron]]:size-4 [&_[data-chevron]]:shrink-0 [&_[data-chevron]]:text-muted-foreground',
  '[&_[data-chevron]]:transition-transform [&_[data-chevron]]:duration-150 motion-reduce:[&_[data-chevron]]:transition-none [&_details[open]>summary_[data-chevron]]:rotate-90',
  '[&_[data-prompt]]:block [&_[data-prompt]]:text-h4 [&_[data-prompt]]:font-medium [&_[data-prompt]]:text-foreground [&_[data-prompt]]:[overflow-wrap:anywhere]',
  '[&_[data-kind]]:mt-1 [&_[data-kind]]:block [&_[data-kind]]:text-label [&_[data-kind]]:text-muted-foreground',
  // The open answer: body text, indented under the prompt from 640 px.
  '[&_[data-answer]]:space-y-6 [&_[data-answer]]:px-3 [&_[data-answer]]:pb-8 [&_[data-answer]]:pt-2 [&_[data-answer]]:text-body [&_[data-answer]]:text-foreground sm:[&_[data-answer]]:pl-10',
  '[&_[data-part]>h3]:text-ui [&_[data-part]>h3]:font-semibold [&_[data-part]>h3]:text-foreground [&_[data-part]>h3+*]:mt-2',
  // "Learn it in": signal tag and lesson title as one link.
  '[&_[data-lessons]]:text-ui [&_[data-lessons]>h3]:font-semibold [&_[data-lessons]_ul]:mt-1 [&_[data-lessons]_ul]:flex [&_[data-lessons]_ul]:flex-wrap [&_[data-lessons]_ul]:gap-x-4 [&_[data-lessons]_ul]:gap-y-1',
  '[&_[data-lesson-link]]:inline-flex [&_[data-lesson-link]]:max-w-full [&_[data-lesson-link]]:items-baseline [&_[data-lesson-link]]:gap-2 [&_[data-lesson-link]]:rounded-sm [&_[data-lesson-link]]:py-1',
  '[&_[data-lesson-link]]:font-medium [&_[data-lesson-link]]:text-primary [&_[data-lesson-link]]:underline-offset-4 [&_[data-lesson-link]:hover]:underline',
  '[&_[data-lesson-link]:focus-visible]:outline-none [&_[data-lesson-link]:focus-visible]:ring-2 [&_[data-lesson-link]:focus-visible]:ring-ring',
  '[&_[data-sources]]:text-ui [&_[data-sources]]:text-muted-foreground [&_[data-sources]>h3]:font-medium [&_[data-sources]>h3+*]:mt-1.5',
].join(' ');
