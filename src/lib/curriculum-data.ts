export interface Topic {
  title: string;
  slug: string;
  description: string;
}

export interface Section {
  title: string;
  slug: string;
  topics: Topic[];
}

export interface Module {
  title: string;
  slug: string;
  sections: Section[];
}

export const curriculumData: Module[] = [
  {
    title: "SystemVerilog Language Foundations",
    slug: "sv-foundations",
    sections: [
      {
        title: "Introduction",
        slug: "introduction",
        topics: [
          { title: "Welcome", slug: "welcome", description: "An introduction to the SystemVerilog Language." }
        ]
      },
      {
        title: "Data Types",
        slug: "data-types",
        topics: [
          { title: "Literals and Basic Types", slug: "literals-and-basic-types", description: "A look at the basic data types in SystemVerilog." },
          { title: "Nets and Variables: logic vs. wire", slug: "nets-and-variables-logic-vs-wire", description: "Understanding the difference between nets and variables." },
          { title: "4-state vs. 2-state Data Types", slug: "4-state-vs-2-state-data-types", description: "A look at 4-state and 2-state data types." },
          { title: "Arrays: Packed, Unpacked, Dynamic, Queues, Associative", slug: "arrays-packed-unpacked-dynamic-queues-associative", description: "An overview of arrays in SystemVerilog." },
          { title: "User-Defined Types: structs, unions, enums, typedef", slug: "user-defined-types-structs-unions-enums-typedef", description: "How to create user-defined types." },
        ],
      },
      {
        title: "Procedural Constructs",
        slug: "procedural-constructs",
        topics: [
            { title: "Initial, Always, and Final Blocks", slug: "initial-always-final-blocks", description: "..." },
            { title: "Tasks and Functions: Scoping and Lifetimes", slug: "tasks-and-functions-scoping-and-lifetimes", description: "..." },
            { title: "Procedural Flow Control", slug: "procedural-flow-control", description: "..." },
            { title: "Fork-Join and Process Control", slug: "fork-join-and-process-control", description: "..." },
        ]
      },
      {
          title: "RTL and Testbench Constructs",
          slug: "rtl-and-testbench-constructs",
          topics: [
              { title: "Packages and Compilation Scopes", slug: "packages-and-compilation-scopes", description: "..." },
              { title: "Modules and Hierarchy", slug: "modules-and-hierarchy", description: "..." },
              { title: "Interfaces and Modports", slug: "interfaces-and-modports", description: "..." },
              { title: "Program and Clocking Blocks", slug: "program-and-clocking-blocks", description: "..." },
          ]
      }
    ],
  },
  {
    title: "Advanced SystemVerilog for Verification",
    slug: "sv-advanced",
    sections: [
        {
            title: "Introduction",
            slug: "introduction",
            topics: [
                { title: "Advanced SystemVerilog", slug: "advanced-sv", description: "..." },
            ]
        },
        {
            title: "Object-Oriented Programming",
            slug: "object-oriented-programming",
            topics: [
                { title: "Classes, Objects, and Handles", slug: "classes-objects-handles", description: "..." },
                { title: "Constructors, 'this', and 'super'", slug: "constructors-this-super", description: "..." },
                { title: "Inheritance, Polymorphism, and Virtual Methods", slug: "inheritance-polymorphism-virtual-methods", description: "..." },
                { title: "Parameterized Classes and Abstract Classes", slug: "parameterized-classes-and-abstract-classes", description: "..." },
            ]
        },
        {
            title: "Constrained Randomization",
            slug: "constrained-randomization",
            topics: [
                { title: "rand, randc, and randomize()", slug: "rand-randc-and-randomize", description: "..." },
                { title: "Constraint Blocks, soft, and solve...before", slug: "constraint-blocks-soft-solve-before", description: "..." },
                { title: "Controlling Randomization: pre_randomize and post_randomize", slug: "controlling-randomization-pre-post", description: "..." },
                { title: "Advanced Constraints: implication and iteration", slug: "advanced-constraints-implication-iteration", description: "..." },
            ]
        },
        {
            title: "Inter-Process Communication",
            slug: "inter-process-communication",
            topics: [
                { title: "Events", slug: "events", description: "..." },
                { title: "Semaphores", slug: "semaphores", description: "..." },
                { title: "Mailboxes", slug: "mailboxes", description: "..." },
            ]
        },
        {
            title: "Assertions (SVA)",
            slug: "assertions-sva",
            topics: [
                { title: "Immediate vs. Concurrent Assertions", slug: "immediate-vs-concurrent-assertions", description: "..." },
                { title: "Sequences, Properties, and Operators", slug: "sequences-properties-and-operators", description: "..." },
                { title: "Multi-Clocking and disable-iff", slug: "multi-clocking-and-disable-iff", description: "..." },
                { title: "Local Variables in Sequences", slug: "local-variables-in-sequences", description: "..." },
            ]
        }
    ]
  },
  {
      title: "The UVM Universe - Core Concepts",
      slug: "uvm-core",
      sections: [
          {
              title: "Introduction",
              slug: "introduction",
              topics: [
                  { title: "Welcome to UVM", slug: "welcome-uvm", description: "..." },
              ]
          },
          {
              title: "Base Class Library",
              slug: "base-class-library",
              topics: [
                  { title: "uvm_object vs. uvm_component", slug: "uvm-object-vs-uvm-component", description: "..." },
                  { title: "The UVM Macros: `uvm_field`, `uvm_component`, `uvm_object`", slug: "the-uvm-macros-field-component-object", description: "..." },
                  { title: "UVM Report Server and Verbosity", slug: "uvm-report-server-and-verbosity", description: "..." },
                  { title: "uvm_root and Test Execution", slug: "uvm-root-and-test-execution", description: "..." },
              ]
          },
          {
              title: "Component Communication",
              slug: "component-communication",
              topics: [
                  { title: "uvm_config_db: set and get", slug: "uvm-config-db-set-and-get", description: "..." },
                  { title: "uvm_resource_db and Precedence", slug: "uvm-resource-db-and-precedence", description: "..." },
                  { title: "Transaction-Level Modeling (TLM 1.0)", slug: "transaction-level-modeling-tlm-1.0", description: "..." },
              ]
          },
          {
              title: "Factory and Overrides",
              slug: "factory-and-overrides",
              topics: [
                  { title: "What the Factory Solves", slug: "what-the-factory-solves", description: "..." },
                  { title: "Registering with the Factory", slug: "registering-with-the-factory", description: "..." },
                  { title: "Overriding by Type and Instance", slug: "overriding-by-type-and-instance", description: "..." },
              ]
          },
          {
              title: "Phasing and Synchronization",
              slug: "phasing-and-synchronization",
              topics: [
                  { title: "The UVM Phases in Detail", slug: "the-uvm-phases-in-detail", description: "..." },
                  { title: "Domains and Phase Jumping", slug: "domains-and-phase-jumping", description: "..." },
                  { title: "UVM Objections for Ending the Test", slug: "uvm-objections-for-ending-the-test", description: "..." },
                  { title: "uvm_event and uvm_barrier", slug: "uvm-event-and-uvm-barrier", description: "..." },
              ]
          }
      ]
  },
  {
      title: "Building a UVM Testbench",
      slug: "uvm-building",
      sections: [
          {
              title: "Introduction",
              slug: "introduction",
              topics: [
                  { title: "UVM Testbench Architecture", slug: "uvm-testbench-architecture", description: "..." },
              ]
          },
          {
              title: "Stimulus Generation",
              slug: "stimulus-generation",
              topics: [
                  { title: "uvm_sequence_item and uvm_sequence", slug: "uvm-sequence-item-and-uvm-sequence", description: "..." },
                  { title: "The Sequencer-Driver Handshake", slug: "the-sequencer-driver-handshake", description: "..." },
                  { title: "Layered Sequences and p_sequencer", slug: "layered-sequences-and-p-sequencer", description: "..." },
                  { title: "Sequence Libraries and grab/ungrab", slug: "sequence-libraries-and-grab-ungrab", description: "..." },
              ]
          },
          {
              title: "Analysis Components",
              slug: "analysis-components",
              topics: [
                  { title: "uvm_monitor and Analysis Ports", slug: "uvm-monitor-and-analysis-ports", description: "..." },
                  { title: "uvm_subscriber", slug: "uvm-subscriber", description: "..." },
                  { title: "The UVM Scoreboard", slug: "the-uvm-scoreboard", description: "..." },
              ]
          },
          {
              title: "The UVM Agent",
              slug: "the-uvm-agent",
              topics: [
                  { title: "Agent Structure: Active vs. Passive", slug: "agent-structure-active-vs-passive", description: "..." },
                  { title: "Connecting the Agent Components", slug: "connecting-the-agent-components", description: "..." },
                  { title: "The Environment and Test Classes", slug: "the-environment-and-test-classes", description: "..." },
              ]
          }
      ]
  },
  {
      title: "Advanced UVM Techniques & Strategy",
      slug: "uvm-advanced",
      sections: [
          {
              title: "Introduction",
              slug: "introduction",
              topics: [
                  { title: "Advanced UVM", slug: "advanced-uvm", description: "..." },
              ]
          },
          {
              title: "Register Abstraction Layer (RAL)",
              slug: "register-abstraction-layer-ral",
              topics: [
                  { title: "RAL Model and Integration", slug: "ral-model-and-integration", description: "..." },
                  { title: "Frontdoor vs. Backdoor Access", slug: "frontdoor-vs-backdoor-access", description: "..." },
                  { title: "Explicit vs. Implicit Prediction", slug: "explicit-vs-implicit-prediction", description: "..." },
                  { title: "Built-in RAL Sequences and Adapters", slug: "built-in-ral-sequences-and-adapters", description: "..." },
              ]
          },
          {
              title: "Advanced Sequencing",
              slug: "advanced-sequencing",
              topics: [
                  { title: "Virtual Sequences and Sequencers", slug: "virtual-sequences-and-sequencers", description: "..." },
                  { title: "UVM Virtual Sequencer", slug: "uvm-virtual-sequencer", description: "Coordinating stimulus across multiple agents." },
                  { title: "Sequence Arbitration and Priority", slug: "sequence-arbitration-and-priority", description: "..." },
                  { title: "Interrupt Handling and Layered Stimulus", slug: "interrupt-handling-and-layered-stimulus", description: "..." }
              ]
          },
          {
              title: "Extending UVM",
              slug: "extending-uvm",
              topics: [
                  { title: "UVM Callbacks and Facade Classes", slug: "uvm-callbacks-and-facade-classes", description: "..." },
                  { title: "Heartbeats and Testbench Monitoring", slug: "heartbeats-and-testbench-monitoring", description: "..." },
                  { title: "Custom Phase and Domain Creation", slug: "custom-phase-and-domain-creation", description: "..." },
              ]
          },
          {
              title: "Functional Coverage in UVM",
              slug: "functional-coverage-in-uvm",
              topics: [
                  { title: "Integrating Covergroups in Subscribers", slug: "integrating-covergroups-in-subscribers", description: "..." },
                  { title: "Coverage Options and Sampling", slug: "coverage-options-and-sampling", description: "..." },
                  { title: "Linking Coverage to the V-Plan", slug: "linking-coverage-to-the-vplan", description: "..." },
              ]
          }
      ]
  },
  {
      title: "The Professional Verification Craft",
      slug: "verification-craft",
      sections: [
          {
              title: "Introduction",
              slug: "introduction",
              topics: [
                  { title: "Professional Verification Craft", slug: "professional-verification-craft", description: "..." },
              ]
          },
          {
              title: "Planning and Management",
              slug: "planning-and-management",
              topics: [
                  { title: "The Verification Plan (V-Plan)", slug: "the-verification-plan-vplan", description: "..." },
                  { title: "Coverage Closure and Metrics", slug: "coverage-closure-and-metrics", description: "..." },
                  { title: "Regression and Triage Strategies", slug: "regression-and-triage-strategies", description: "..." },
              ]
          },
          {
              title: "Advanced Design Patterns",
              slug: "advanced-design-patterns",
              topics: [
                  { title: "Reusable Verification IP (VIP) Architecture", slug: "reusable-verification-ip-vip-architecture", description: "..." },
                  { title: "Coding Guidelines and Best Practices", slug: "coding-guidelines-and-best-practices", description: "..." },
                  { title: "Effective Debug Techniques in UVM", slug: "effective-debug-techniques-in-uvm", description: "..." },
              ]
          },
          {
              title: "Interoperability",
              slug: "interoperability",
              topics: [
                  { title: "Direct Programming Interface (DPI)", slug: "direct-programming-interface-dpi", description: "..." },
                  { title: "Clock Domain Crossing (CDC) Verification", slug: "clock-domain-crossing-cdc-verification", description: "..." },
                  { title: "Introduction to Portable Stimulus (PSS)", slug: "introduction-to-portable-stimulus-pss", description: "..." },
              ]
          }
      ]
  }
];

// Helper functions to navigate the new structure

export function findTopicBySlug(slug: string[]): Topic | undefined {
  if (slug.length !== 3) return undefined;
  const [moduleSlug, sectionSlug, topicSlug] = slug;
  const courseModule = curriculumData.find(m => m.slug === moduleSlug);
  if (!courseModule) return undefined;
  const section = courseModule.sections.find(s => s.slug === sectionSlug);
  if (!section) return undefined;
  return section.topics.find(t => t.slug === topicSlug);
}

export function getBreadcrumbs(slug: string[]): { title: string, path: string }[] {
  const breadcrumbs: { title: string, path: string }[] = [];
  if (slug.length > 0) {
    const courseModule = curriculumData.find(m => m.slug === slug[0]);
    if (courseModule) {
      breadcrumbs.push({ title: courseModule.title, path: `/curriculum/${courseModule.slug}` });
      if (slug.length > 1) {
        const section = courseModule.sections.find(s => s.slug === slug[1]);
        if (section) {
          breadcrumbs.push({ title: section.title, path: `/curriculum/${courseModule.slug}/${section.slug}` });
          if (slug.length > 2) {
            const topic = section.topics.find(t => t.slug === slug[2]);
            if (topic) {
              breadcrumbs.push({ title: topic.title, path: `/curriculum/${courseModule.slug}/${section.slug}/${topic.slug}` });
            }
          }
        }
      }
    }
  }
  return breadcrumbs;
}
