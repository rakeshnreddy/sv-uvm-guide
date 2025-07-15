'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Assuming SVGR is configured in next.config.js to handle SVG imports as React components.
// The path should be relative to the `public` directory at the root of `sv-uvm-guide`.
import UvmSvg from '../../public/uvm-hero-diagram.svg'; // Corrected path relative to `sv-uvm-guide/public`

// Note: The InteractiveUvmComponent defined earlier is not used here because
// applying Framer Motion to individual parts of an imported SVG component (UvmSvg)
// requires either modifying the SVG source to include motion elements,
// or a sophisticated SVGR setup that allows prop-spreading to specific SVG children.
// The current approach focuses on a descriptive tooltip for the whole diagram area.

const UvmHeroDiagram: React.FC = () => {
  const [activeDescription, setActiveDescription] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Ensure component is mounted before trying to access browser APIs like dataset
  }, []);

  const handleHover = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!isMounted) return;

    let target = event.target as SVGElement;
    // Traverse up to find the group with data-description
    while (target && target.tagName !== 'svg' && !(target.dataset && target.dataset.description)) {
      if (target.parentNode instanceof SVGElement) {
        target = target.parentNode;
      } else {
        // If parentNode is not SVGElement (e.g., null or HTMLDivElement), stop.
        break;
      }
    }
    if (target && target.dataset && target.dataset.description) {
      setActiveDescription(target.dataset.description);
    }
  };

  const handleMouseOut = () => {
    if (!isMounted) return;
    setActiveDescription(null);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto"> {/* Max width for the diagram container */}
      <div
        onMouseMove={handleHover} // Using onMouseMove for potentially better targeting within SVG
        onMouseOut={handleMouseOut}
        className="cursor-default" // Or 'cursor-pointer' if parts are meant to be interactive
      >
        {/*
          Ensure your next.config.js has SVGR configured. Example:
          webpack(config) {
            config.module.rules.push({
              test: /\.svg$/i,
              issuer: /\.[jt]sx?$/,
              use: ['@svgr/webpack'],
            });
            return config;
          }
        */}
        <UvmSvg className="w-full h-auto" />
      </div>

      <AnimatePresence>
        {activeDescription && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-4 left-4 right-4 p-3 md:p-4 bg-slate-800/80 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg text-brand-text-primary text-xs md:text-sm text-center shadow-xl"
            // Added Tailwind classes for styling the description box
          >
            {activeDescription}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Need to import AnimatePresence or remove it if not used here.
// Assuming Framer Motion is installed.



export default UvmHeroDiagram;
