"use client";

import { useEffect } from "react";
import * as d3 from "d3";

export const useZoomPan = (svgRef: React.RefObject<SVGSVGElement>) => {
  useEffect(() => {
    const svg = svgRef.current ? d3.select(svgRef.current) : null;
    if (!svg) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        svg.select("g").attr("transform", event.transform);
      });

    svg.call(zoom as any);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        svg.transition().call(zoom.scaleBy as any, 1.2);
      } else if (e.key === "-") {
        e.preventDefault();
        svg.transition().call(zoom.scaleBy as any, 0.8);
      } else if (e.key === "0") {
        e.preventDefault();
        svg.transition().call(zoom.scaleTo as any, 1);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      svg.on(".zoom", null);
    };
  }, [svgRef]);
};

export default useZoomPan;
