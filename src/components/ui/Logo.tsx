import React from "react";

/**
 * The wordmark, set in live text: "SV/UVM" in the mono face (like a signal
 * name) and "Hub" in the sans face, 17 px on one line. The links that wrap it
 * carry their own name ("SV/UVM Hub home"); the image role keeps the
 * wordmark's own name, "SV/UVM Hub logo".
 */
const Logo = () => {
  return (
    <span
      role="img"
      aria-label="SV/UVM Hub logo"
      className="inline-flex items-baseline gap-[0.3em] whitespace-nowrap text-[17px] leading-6"
    >
      <span className="font-mono font-semibold text-foreground">SV/UVM</span>
      <span className="font-sans font-medium text-muted-foreground">Hub</span>
    </span>
  );
};

export default Logo;
