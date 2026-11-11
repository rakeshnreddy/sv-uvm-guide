import React from "react";

/**
 * GitHub-flavoured Markdown pieces on the lesson page that need a little help
 * to be accessible. Both keep the lesson's text exactly as written.
 */

/**
 * A task-list checkbox ("- [ ] item"). remark-gfm draws it disabled; in a
 * lesson it is a printed checklist mark, not a control, so it is hidden from
 * assistive technology and the item's text is read on its own.
 */
export function LessonCheckbox(props: React.ComponentPropsWithoutRef<"input">) {
  if (props.type === "checkbox" && props.disabled) {
    return <input {...props} aria-hidden="true" tabIndex={-1} />;
  }
  return <input {...props} />;
}

function isEmpty(children: React.ReactNode): boolean {
  return React.Children.toArray(children).every((child) => typeof child === "string" && child.trim() === "");
}

/** The fill and padding the lesson table's header cells get from globals.css, for the empty corner cell. */
const EMPTY_HEADER_STYLE: React.CSSProperties = {
  backgroundColor: "hsl(var(--tier-current) / 0.1)",
  paddingTop: "0.625rem",
  paddingBottom: "0.625rem",
};

/**
 * A table header cell. An empty corner cell (a comparison table's first
 * column) is drawn as a plain cell with the header row's fill, because a
 * header with no text names nothing.
 */
export function LessonTableHeader({ children, style, ...props }: React.ComponentPropsWithoutRef<"th">) {
  if (isEmpty(children)) {
    const { scope: _scope, abbr: _abbr, ...cell } = props;
    return <td {...cell} data-empty-header="" style={{ ...EMPTY_HEADER_STYLE, ...style }} />;
  }
  return (
    <th {...props} style={style}>
      {children}
    </th>
  );
}
