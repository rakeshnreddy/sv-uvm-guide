import React from 'react';
import InfoPage from '@/components/templates/InfoPage'; // Using InfoPage for a landing page style
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface TopicLink {
  href: string;
  title: string;
  description: string;
}

const svTopicLinks: TopicLink[] = [
  {
    href: '/sv-concepts/data-types',
    title: 'Data Types',
    description: 'Explore SystemVerilog data types, including logic, bit, arrays, structs, and enums.',
  },
  {
    href: '/sv-concepts/procedural-semantics',
    title: 'Procedural Semantics',
    description: 'Understand processes, tasks, functions, and the event scheduler.',
  },
  {
    href: '/sv-concepts/program-clocking-blocks',
    title: 'Program & Clocking Blocks',
    description: 'Learn about testbench structure with program blocks and race-free signal sampling with clocking blocks.',
  },
  {
    href: '/sv-concepts/interfaces-modports',
    title: 'Interfaces & Modports',
    description: 'Discover how interfaces encapsulate communication and modports define directionality.',
  },
  {
    href: '/sv-concepts/class-based-testbenches',
    title: 'Class-Based Testbenches',
    description: 'Introduction to Object-Oriented Programming for building dynamic testbenches.',
  },
  {
    href: '/sv-concepts/randomization-constraints',
    title: 'Randomization & Constraints',
    description: 'Master constrained-random stimulus generation for thorough verification.',
  },
  {
    href: '/sv-concepts/functional-coverage',
    title: 'Functional Coverage',
    description: 'Learn to measure verification progress using covergroups, coverpoints, and crosses.',
  },
  {
    href: '/sv-concepts/sva',
    title: 'SystemVerilog Assertions (SVA)',
    description: 'Specify and check design behavior using temporal logic with SVA properties.',
  },
  {
    href: '/sv-concepts/clock-domain-crossing',
    title: 'Clock Domain Crossing (CDC)',
    description: 'Techniques for safely passing signals between different clock domains.',
  },
  // Add other SV topics here as they are created
];

const SvConceptsLandingPage: React.FC = () => {
  const pageTitle = "SystemVerilog Concepts for Verification";

  const content = (
    <>
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-primary mb-3">The Power of SystemVerilog</h2>
        <p className="mb-4">
          SystemVerilog has become the cornerstone of modern hardware design and verification, extending Verilog&apos;s capabilities to address the escalating complexity of today&apos;s System-on-Chip (SoC) designs. It offers a rich set of constructs for both RTL design and advanced verification, making it an indispensable language for engineers in the semiconductor industry.
        </p>
        <p className="mb-4">
          Born from the need to unify design and verification languages and to incorporate powerful features from Hardware Verification Languages (HVLs) like OpenVera and &apos;e&apos;, SystemVerilog (IEEE 1800) provides a unified platform. It supports object-oriented programming, constrained randomization, functional coverage, and assertions, all crucial for building robust and reusable verification environments.
        </p>
        <p>
          This section delves into the core SystemVerilog concepts vital for verification engineers, from fundamental data types and procedural blocks to advanced techniques like class-based testbenches, assertions, and coverage methodologies. Mastering these concepts is the first essential step towards achieving expertise in functional verification.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-primary mb-4">Explore SystemVerilog Topics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {svTopicLinks.map((topic) => (
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

export default SvConceptsLandingPage;

export async function generateMetadata() {
  return {
    title: "SystemVerilog Concepts | SystemVerilog & UVM Mastery",
    description: "Explore comprehensive guides and detailed explanations of key SystemVerilog concepts for hardware design and functional verification. Learn about data types, OOP, assertions, coverage, and more.",
  };
}
