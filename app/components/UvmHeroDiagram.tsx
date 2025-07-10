'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
// Assuming your SVGR setup allows direct import like this:
// If not, you might need a different import path or a .babelrc configuration for SVGR.
import UvmSvg from '@/public/uvm-hero-diagram.svg'; // Adjust path if your public alias is different

interface UvmComponentProps {
  id: string;
  description: string;
  children: React.ReactNode;
  onHover: (desc: string | null) => void;
}

const InteractiveUvmComponent: React.FC<UvmComponentProps> = ({ id, description, children, onHover }) => {
  return (
    <motion.g
      id={id}
      onHoverStart={() => onHover(description)}
      onHoverEnd={() => onHover(null)}
      whileHover={{ scale: 1.05, fill: '#64FFDA' }} // Accent color for fill, applied to shapes within
      transition={{ type: 'spring', stiffness: 300 }}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </motion.g>
  );
};

const UvmHeroDiagram: React.FC = () => {
  const [activeDescription, setActiveDescription] = useState<string | null>(null);

  const components = [
    { id: 'test', description: "The Test instantiates the environment and sequences, and configures the testbench." },
    { id: 'environment', description: "The Environment (Env) encapsulates agents, scoreboards, and other environment components." },
    { id: 'agent-active', description: "The Active Agent drives stimulus to the DUT and may monitor its outputs." },
    { id: 'sequencer', description: "The Sequencer controls the flow of sequence items to the Driver." },
    { id: 'driver', description: "The Driver converts sequence items into pin-level activity on the DUT interface." },
    { id: 'monitor-active', description: "The Active Monitor observes DUT interface signals, typically associated with the active agent." },
    { id: 'agent-passive', description: "The Passive Agent only monitors DUT interfaces and does not drive stimulus." },
    { id: 'monitor-passive', description: "The Passive Monitor observes DUT interface signals, typically for checking or coverage." },
    { id: 'scoreboard', description: "The Scoreboard checks the DUT's behavior by comparing expected data against actual data." },
  ];

  // This is a conceptual way to wrap parts of the imported SVG.
  // In a real scenario with SVGR, UvmSvg would be a component, and you'd either:
  // 1. Edit the SVG source to add motion.g wrappers before SVGR processing.
  // 2. Pass props to the UvmSvg component if SVGR is configured to allow prop spreading to specific SVG elements.
  // 3. Or, more complexly, manipulate the SVG's React tree (less ideal).

  // For this example, we'll assume UvmSvg is a component that we can render,
  // and the interaction will be on a conceptual layer for the description box.
  // The actual per-element highlighting requires modifying the SVG structure itself
  // or having SVGR provide access to its internal elements.

  // A simpler approach for the visual hover effect without deep SVGR modification:
  // The <motion.g> wrappers would ideally be *inside* the SVG structure.
  // Since I can't modify the imported SVG component's internals directly here,
  // the hover effect on individual SVG parts needs to be handled by SVGR's output.
  // If SVGR converts <g id="driver">...</g> to <g id="driver" className="driver-group">...</g>,
  // then Framer Motion could target those groups if the SVG component is structured to allow it.

  // For now, the UvmSvg component will be rendered as is.
  // The interactive description box will be separate.
  // To make individual SVG elements interactive as described,
  // you would typically edit the SVG to wrap elements like <g id="driver">
  // with <motion.g> *before* it's processed by SVGR, or use a library
  // that allows deeper manipulation of SVG components.

  // Let's simulate the description update mechanism.
  // The actual visual highlighting of SVG parts requires the SVG to be structured for it.

  const handleHover = (description: string | null) => {
    setActiveDescription(description);
  };

  // Placeholder style for the description box
  const descriptionBoxStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '20px',
    left: '20px',
    right: '20px',
    padding: '15px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    borderRadius: '8px',
    textAlign: 'center',
    minHeight: '50px',
    display: activeDescription ? 'block' : 'none',
    fontSize: '1rem',
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      {/*
        To make individual SVG elements interactive with Framer Motion as requested:
        1. Modify your SVG: Wrap each interactive group (e.g., <g id="driver">) with a unique identifier
           that can be targeted.
        2. Configure SVGR: Ensure SVGR preserves these IDs or allows you to pass props to them.
           A common pattern is to have SVGR turn IDs into classNames or allow ref forwarding.
        3. In this React component: You would then need to somehow apply Framer Motion's <motion.g>
           to these specific parts. This might involve rendering the SVG inline as JSX if SVGR
           outputs it that way, or using a ref to manipulate the SVG DOM if it's rendered as an <img>
           or <object> (though Framer Motion works best with React components).

        The current UvmSvg import will render the whole SVG. The hover effects on individual
        elements (`<motion.g>`) would need to be part of the `UvmSvg` component itself.
        The following is a conceptual representation of how you might add hover listeners if UvmSvg
        were structured to expose its parts.
      */}

      <div
        onMouseOver={(e) => {
          // A more robust way would be to have the SVG elements themselves trigger hover.
          // This is a simplified example using data attributes on the SVG's groups.
          let target = e.target as SVGElement;
          while(target && target.tagName !== 'svg' && !target.dataset?.description) {
            target = target.parentNode as SVGElement;
          }
          if (target && target.dataset?.description) {
            handleHover(target.dataset.description);
          }
        }}
        onMouseOut={() => handleHover(null)}
      >
        <UvmSvg width="100%" height="auto" />
      </div>

      {activeDescription && (
        <motion.div
          style={descriptionBoxStyle}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          {activeDescription}
        </motion.div>
      )}
    </div>
  );
};

export default UvmHeroDiagram;
