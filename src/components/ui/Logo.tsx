import React from 'react';

const Logo = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 20"
      className="text-accent w-full max-w-[150px] h-auto"
      role="img"
      aria-label="SV/UVM Hub logo"
    >
      <text
        x="0"
        y="15"
        fontFamily="var(--font-cal-sans)"
        fontSize="16"
        fill="hsl(var(--primary))"
        className="font-bold"
      >
        SV/UVM Hub
      </text>
    </svg>
  );
};

export default Logo;
