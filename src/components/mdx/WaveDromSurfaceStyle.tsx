import React from 'react';
import { wavedromSurfaceCss } from '@/lib/wavedrom-surface';

const css = wavedromSurfaceCss();

/**
 * Inlines the code-surface WaveDrom skin (src/lib/wavedrom-surface.ts). Render it
 * next to any element that carries WAVEDROM_SURFACE_ATTR; repeated copies are harmless.
 */
export function WaveDromSurfaceStyle() {
  return <style data-wavedrom-skin="" dangerouslySetInnerHTML={{ __html: css }} />;
}

export default WaveDromSurfaceStyle;
