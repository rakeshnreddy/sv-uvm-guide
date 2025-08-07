"use client";

import { useEffect } from "react";
import * as d3 from "d3";

export const useZoomPan = (
  svgRef: React.RefObject<SVGSVGElement>,
  zoomRef?: React.MutableRefObject<
    d3.ZoomBehavior<SVGSVGElement, unknown> | null
  >
) => {
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;
    const svg = d3.select(svgElement);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        svg.select("g").attr("transform", event.transform);
      });

    svg.call(zoom as any);
    if (zoomRef) {
      zoomRef.current = zoom;
    }


    const handleKey = (e: KeyboardEvent) => {
      const step = 40;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        svg.transition().call(zoom.scaleBy as any, 1.2);
      } else if (e.key === "-") {
        e.preventDefault();
        svg.transition().call(zoom.scaleBy as any, 0.8);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        svg.transition().call(zoom.translateBy as any, 0, -step);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        svg.transition().call(zoom.translateBy as any, 0, step);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        svg.transition().call(zoom.translateBy as any, -step, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        svg.transition().call(zoom.translateBy as any, step, 0);
      }
    };

    svgElement.addEventListener("keydown", handleKey);
    return () => {
      svgElement.removeEventListener("keydown", handleKey);
      svg.on(".zoom", null);
    };
  }, [svgRef, zoomRef]);
};

export default useZoomPan;
