import React from 'react';
import InfoPage from '@/components/templates/InfoPage';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import UvmHeroDiagram from '@/components/UvmHeroDiagram';

interface TopicLink {
  href: string;
  title: string;
  description: string;
}

// Note: Need to confirm the definitive list and paths for UVM topics.
// For example, 'layered-testbench' vs 'layered-testbench-architecture'.
// And 'sequences-sequencer' vs 'uvm-sequences-and-sequencer-handshake'.
// Assuming the more specific/newer ones are preferred or they cover different aspects.
const uvmTopicLinks: TopicLink[] = [
  {
    href: '/uvm-concepts/layered-testbench-architecture',
    title: 'Layered Testbench Architecture',
    description: 'Explore the standard UVM testbench components and their organization.',
  },
  {
    href: '/uvm-concepts/phasing-hierarchy',
    title: 'UVM Phasing & Class Hierarchy',
    description: 'Understand the UVM component lifecycle and base class library structure.',
  },
  {
    href: '/uvm-concepts/uvm-factory',
    title: 'The UVM Factory',
    description: 'Learn about factory patterns for creating UVM objects and components, enabling overrides.',
  },
  {
    href: '/uvm-concepts/tlm',
    title: 'Transaction-Level Modeling (TLM)',
    description: 'Discover how UVM components communicate using abstract TLM ports and exports.',
  },
  {
    href: '/uvm-concepts/uvm-sequences-and-sequencer-handshake',
    title: 'UVM Sequences & Handshake',
    description: 'Master stimulus generation with sequences and the sequencer-driver interaction.',
  },
   {
    href: '/uvm-concepts/sequences-sequencer', // Keeping this if it's a different page/focus
    title: 'Sequences & Sequencers (General)',
    description: 'General concepts of UVM sequences and sequencers.',
  },
  {
    href: '/uvm-concepts/ral',
    title: 'Register Abstraction Layer (RAL)',
    description: 'Learn to model and verify DUT registers using UVM RAL.',
  },
  {
    href: '/uvm-concepts/coding-guidelines-patterns',
    title: 'UVM Coding Guidelines & Patterns',
    description: 'Best practices and common design patterns for writing effective UVM code.',
  },
  // Add other UVM topics here
];


const UvmConceptsLandingPage: React.FC = () => {
  const pageTitle = "Universal Verification Methodology (UVM) Concepts";

  const content = (
    <>
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-primary mb-3">Mastering UVM: The Industry Standard</h2>
        <p className="mb-4">
          The Universal Verification Methodology (UVM) is a standardized framework built on SystemVerilog, designed to enable the creation of robust, reusable, and scalable verification environments. As SystemVerilog provides the language capabilities, UVM provides the methodology—a set of base classes, utilities, and guidelines—to structure complex testbenches efficiently.
        </p>
        <p className="mb-4">
          UVM emerged from a need to consolidate various vendor-specific methodologies (like OVM and VMM) into a single, industry-wide standard. This unification, driven by Accellera, has been pivotal in promoting interoperability of Verification IP (VIP) and fostering a common language and approach for verification engineers worldwide. Understanding UVM is critical for anyone serious about a career in modern ASIC or FPGA functional verification.
        </p>
        <p>
          This section guides you through the essential components and concepts of UVM, from the foundational layered testbench architecture and phasing mechanisms to advanced topics like the UVM factory, Transaction-Level Modeling (TLM), sequences for stimulus generation, and the Register Abstraction Layer (RAL).
        </p>
      </section>

      <section>
        <UvmHeroDiagram />
        <h2 className="text-2xl font-semibold text-primary mb-4">Explore UVM Topics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {uvmTopicLinks.map((topic) => (
            <Link href={topic.href} key={topic.href} legacyBehavior>
              <a className="block p-6 bg-card hover:bg-accent/50 rounded-lg shadow-md transition-all hover:shadow-lg transform hover:-translate-y-1">
                <h3 className="text-xl font-semibold text-accent-foreground mb-2 flex justify-between items-center">
                  {topic.title}
                  <ArrowRight className="w-5 h-5 text-primary" />
                </h3>
                <p className="text-sm text-muted-foreground">{topic.description}</p>
              </a>
            </Link>
          ))}
        </div>
      </section>
    </>
  );

  return (
    <InfoPage title={pageTitle}>
      {content}
    </InfoPage>
  );
};

export default UvmConceptsLandingPage;

export async function generateMetadata() {
  return {
    title: "UVM Concepts | SystemVerilog & UVM Mastery",
    description: "Dive into the Universal Verification Methodology (UVM). Learn about UVM's layered testbenches, components, sequences, RAL, and best practices for advanced functional verification.",
  };
}
