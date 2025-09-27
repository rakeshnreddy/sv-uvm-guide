"use client";

import { useEffect } from "react";
import { select } from "d3-selection";
import { zoom, ZoomBehavior } from "d3-zoom";
import "d3-transition";

export const useZoomPan = (
  svgRef: React.RefObject<SVGSVGElement>,
  zoomRef?: React.MutableRefObject<
    ZoomBehavior<SVGSVGElement, unknown> | null
  >,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;
    const svgElement = svgRef.current;
    if (!svgElement) return;
    const svg = select(svgElement);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        svg.select("g").attr("transform", event.transform);
      });

    svg.call(zoomBehavior as any);
    if (zoomRef) {
      zoomRef.current = zoomBehavior;
    }


    const handleKey = (e: KeyboardEvent) => {
      const step = 40;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        svg.transition().call(zoomBehavior.scaleBy as any, 1.2);
      } else if (e.key === "-") {
        e.preventDefault();
        svg.transition().call(zoomBehavior.scaleBy as any, 0.8);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        svg.transition().call(zoomBehavior.translateBy as any, 0, -step);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        svg.transition().call(zoomBehavior.translateBy as any, 0, step);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        svg.transition().call(zoomBehavior.translateBy as any, -step, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        svg.transition().call(zoomBehavior.translateBy as any, step, 0);
      }
    };

    svgElement.addEventListener("keydown", handleKey);
    return () => {
      svgElement.removeEventListener("keydown", handleKey);
      svg.on(".zoom", null);
    };
  }, [svgRef, zoomRef, enabled]);
};

export default useZoomPan;
