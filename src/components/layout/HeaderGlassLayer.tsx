import React from "react";

import { HEADER_BACKING_CLASS, HEADER_BACKING_CUTOUT_CLASS, HEADER_BAR_CLASS, headerBarFrameClass } from "./nav-styles";

/**
 * The header's background layer (aria-hidden, no pointer events, no controls): the rounded glass bar,
 * and behind it a backing in the page colour that covers the gutters around the bar, so scrolled
 * content disappears under the gutter and shows only through the glass. The backing paints nothing
 * under the bar itself (a spread shadow around a cut-out of the bar's shape), so the bar's backdrop
 * blur still sees the content, and it fades out towards the header's lower edge. It has no
 * backdrop-filter, so the three-blur budget is unchanged.
 */
export default function HeaderGlassLayer({ layout }: { layout: "docked" | "frame" | "public" }) {
  const frame = headerBarFrameClass(layout);
  return (
    <div aria-hidden="true" data-header-glass="" className="pointer-events-none absolute inset-0">
      <div data-header-backing="" className={HEADER_BACKING_CLASS}>
        <div className={frame}>
          <div className={HEADER_BACKING_CUTOUT_CLASS} />
        </div>
      </div>
      <div className={frame}>
        <div className={HEADER_BAR_CLASS} data-header-bar="" />
      </div>
    </div>
  );
}
