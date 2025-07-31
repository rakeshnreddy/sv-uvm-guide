"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.curriculumData = void 0;
exports.findTopicBySlug = findTopicBySlug;
exports.getBreadcrumbs = getBreadcrumbs;
exports.findPrevNextTopics = findPrevNextTopics;
exports.curriculumData = [
  {
    title: "Foundational",
    slug: "T1_Foundational",
    tier: "T1",
    sections: [
      {
        title: "Why Verification?",
        slug: "F1_Why_Verification",
        topics: [
          { title: "Why Verification", slug: "index", description: "An introduction to the world of hardware verification." }
        ]
      },
      {
        title: "SystemVerilog Primer",
        slug: "F2_SystemVerilog_Primer",
        topics: [
          { title: "SystemVerilog Primer", slug: "index", description: "A primer on the SystemVerilog language." }
        ]
      },
      {
        title: "Data Types",
        slug: "F2_Data_Types",
        topics: [
          { title: "Data Types", slug: "index", description: "Exploring SystemVerilog's data types." },
          { title: "User Defined", slug: "user-defined", description: "User defined types in SystemVerilog." },
          { title: "Arrays", slug: "arrays", description: "Arrays in SystemVerilog." }
        ]
      },
      {
        title: "SystemVerilog Basics",
        slug: "F2_SystemVerilog_Basics",
        topics: [
          { title: "SystemVerilog Basics", slug: "index", description: "A comprehensive introduction to the fundamental building blocks of the SystemVerilog language." }
        ]
      },
      {
        title: "SystemVerilog Intro",
        slug: "F3_SystemVerilog_Intro",
        topics: [
          { title: "SystemVerilog Intro", slug: "index", description: "An introduction to SystemVerilog." }
        ]
      },
      {
        title: "Behavioral & RTL Modeling",
        slug: "F3_Behavioral_RTL_Modeling",
        topics: [
          { title: "Behavioral & RTL Modeling", slug: "index", description: "A core module that teaches how to describe hardware behavior in SystemVerilog." }
        ]
      },
      {
        title: "Procedural Constructs",
        slug: "F3_Procedural_Constructs",
        topics: [
          { title: "Procedural Constructs", slug: "index", description: "Understanding the building blocks of SystemVerilog code." },
          { title: "Tasks and Functions", slug: "tasks-functions", description: "Tasks and functions in SystemVerilog." },
          { title: "Flow Control", slug: "flow-control", description: "Flow control in SystemVerilog." },
          { title: "Fork Join", slug: "fork-join", description: "Fork join in SystemVerilog." }
        ]
      },
      {
        title: "RTL and Testbench Constructs",
        slug: "F4_RTL_and_Testbench_Constructs",
        topics: [
          { title: "RTL and Testbench Constructs", slug: "index", description: "Key constructs for design and verification." },
          { title: "Program and Clocking", slug: "program-clocking", description: "Program and clocking blocks in SystemVerilog." },
          { title: "Packages", slug: "packages", description: "Packages in SystemVerilog." },
          { title: "Interfaces", slug: "interfaces", description: "Interfaces in SystemVerilog." }
        ]
      },
      {
        title: "Your First Testbench",
        slug: "F4_Your_First_Testbench",
        topics: [
          { title: "Your First Testbench", slug: "index", description: "Your first testbench in SystemVerilog." }
        ]
      },
      {
        title: "Verification Basics without UVM",
        slug: "F4_Verification_Basics_without_UVM",
        topics: [
          { title: "Verification Basics without UVM", slug: "index", description: "Bridging the gap between basic SystemVerilog and the complex UVM methodology." }
        ]
      },
      {
        title: "Intro to OOP in SV",
        slug: "F5_Intro_to_OOP_in_SV",
        topics: [
          { title: "Intro to OOP in SV", slug: "index", description: "The final prerequisite before diving into UVM." }
        ]
      }
    ],
  },
  {
    title: "Intermediate",
    slug: "T2_Intermediate",
    tier: "T2",
    sections: [
        {
            title: "Advanced SystemVerilog Features",
            slug: "I1_Advanced_SystemVerilog_Features",
            topics: [
                { title: "Advanced SystemVerilog Features", slug: "index", description: "Advanced SystemVerilog features." },
            ]
        },
        {
            title: "UVM Primer",
            slug: "I2_UVM_Primer",
            topics: [
                { title: "UVM Primer", slug: "index", description: "A primer on UVM." },
            ]
        },
        {
            title: "UVM Factory and Config",
            slug: "I3_UVM_Factory_and_Config",
            topics: [
                { title: "UVM Factory and Config", slug: "index", description: "UVM factory and config." },
            ]
        },
        {
            title: "Building a UVM Testbench",
            slug: "I4_Building_a_UVM_Testbench",
            topics: [
                { title: "Building a UVM Testbench", slug: "index", description: "Building a UVM testbench." },
            ]
        },
        {
            title: "Debugging and Tracing",
            slug: "I5_Debugging_and_Tracing",
            topics: [
                { title: "Debugging and Tracing", slug: "index", description: "Debugging and tracing in UVM." },
            ]
        },
        {
            title: "Object-Oriented Programming",
            slug: "I-SV-1_OOP",
            topics: [
                { title: "Object-Oriented Programming", slug: "index", description: "The fundamentals of OOP in SystemVerilog." },
                { title: "Constructors", slug: "constructors", description: "Constructors in SystemVerilog." },
                { title: "Parameterized Classes", slug: "parameterized-classes", description: "Parameterized classes in SystemVerilog." }
            ]
        },
        {
            title: "Constrained Randomization",
            slug: "I-SV-2_Constrained_Randomization",
            topics: [
                { title: "Constrained Randomization", slug: "index", description: "Generating random data with constraints." },
                { title: "Constraint Blocks", slug: "constraint-blocks", description: "Constraint blocks in SystemVerilog." },
                { title: "Controlling Randomization", slug: "controlling-randomization", description: "Controlling randomization in SystemVerilog." },
                { title: "Advanced Constraints", slug: "advanced-constraints", description: "Advanced constraints in SystemVerilog." }
            ]
        },
        {
            title: "Functional Coverage",
            slug: "I-SV-3_Functional_Coverage",
            topics: [
                { title: "Functional Coverage", slug: "index", description: "Measuring verification effectiveness." },
                { title: "Mailboxes", slug: "mailboxes", description: "Mailboxes in SystemVerilog." },
                { title: "Semaphores", slug: "semaphores", description: "Semaphores in SystemVerilog." },
                { title: "Coverage Options", slug: "coverage-options", description: "Coverage options in SystemVerilog." },
                { title: "Linking Coverage", slug: "linking-coverage", description: "Linking coverage in SystemVerilog." },
                { title: "Events", slug: "events", description: "Events in SystemVerilog." }
            ]
        },
        {
            title: "SystemVerilog Assertions (SVA)",
            slug: "I-SV-4_Assertions_SVA",
            topics: [
                { title: "SystemVerilog Assertions (SVA)", slug: "index", description: "Using SystemVerilog Assertions for verification." },
                { title: "Immediate vs Concurrent", slug: "immediate-vs-concurrent", description: "Immediate vs concurrent assertions." },
                { title: "Local Variables", slug: "local-variables", description: "Local variables in assertions." },
                { title: "Multi-clocking", slug: "multi-clocking", description: "Multi-clocking in assertions." }
            ]
        },
        {
            title: "UVM Introduction",
            slug: "I-UVM-1_UVM_Intro",
            topics: [
                { title: "UVM Introduction", slug: "index", description: "An introduction to the Universal Verification Methodology." }
            ]
        },
        {
            title: "Building a UVM Testbench",
            slug: "I-UVM-2_Building_TB",
            topics: [
                { title: "Building a UVM Testbench", slug: "index", description: "Exploring the foundational classes of UVM." },
                { title: "UVM Root", slug: "uvm-root", description: "UVM root." },
                { title: "UVM Report Server", slug: "uvm-report-server", description: "UVM report server." }
            ]
        },
        {
            title: "UVM Stimulus Generation",
            slug: "I-UVM-3_Sequences",
            topics: [
                { title: "UVM Stimulus Generation", slug: "index", description: "How UVM components talk to each other." },
                { title: "UVM Config DB", slug: "uvm-config-db", description: "UVM config db." },
                { title: "UVM Resource DB", slug: "uvm-resource-db", description: "UVM resource db." }
            ]
        },
        {
            title: "Phasing and Synchronization",
            slug: "I-UVM-5_Phasing_and_Synchronization",
            topics: [
                { title: "Phasing and Synchronization", slug: "index", description: "Phasing and synchronization in UVM." },
                { title: "Domains and Phase Jumping", slug: "domains-phase-jumping", description: "Domains and phase jumping in UVM." },
                { title: "UVM Event and Barrier", slug: "uvm-event-barrier", description: "UVM event and barrier." }
            ]
        }
    ]
  },
  {
      title: "Advanced",
      slug: "T3_Advanced",
      tier: "T3",
      sections: [
          {
            title: "Advanced Sequencing",
            slug: "A-UVM-1_Advanced_Sequencing",
            topics: [
                { title: "Advanced Sequencing", slug: "index", description: "In-depth guide to UVM sequence mechanics, layering, and the use of virtual sequences." },
                { title: "UVM Monitor", slug: "uvm-monitor", description: "UVM monitor." },
                { title: "Sequence Arbitration", slug: "sequence-arbitration", description: "Sequence arbitration." },
                { title: "UVM Virtual Sequencer", slug: "uvm-virtual-sequencer", description: "UVM virtual sequencer." },
                { title: "Virtual Sequences", slug: "virtual-sequences", description: "Virtual sequences." },
                { title: "Sequence Libraries", slug: "sequence-libraries", description: "Sequence libraries." },
                { title: "UVM Scoreboard", slug: "uvm-scoreboard", description: "UVM scoreboard." },
                { title: "Interrupt Handling", slug: "interrupt-handling", description: "Interrupt handling." },
                { title: "Layered Sequences", slug: "layered-sequences", description: "Layered sequences." },
                { title: "Environment and Test Classes", slug: "environment-test-classes", description: "Environment and test classes." },
                { title: "UVM Subscriber", slug: "uvm-subscriber", description: "UVM subscriber." },
                { title: "UVM Sequence Item", slug: "uvm-sequence-item", description: "UVM sequence item." },
                { title: "Sequencer Driver Handshake", slug: "sequencer-driver-handshake", description: "Sequencer driver handshake." },
                { title: "Connecting", slug: "connecting", description: "Connecting." }
            ]
          },
          {
            title: "The UVM Factory In-Depth",
            slug: "A-UVM-2_The_UVM_Factory_In-Depth",
            topics: [
                { title: "The UVM Factory In-Depth", slug: "index", description: "Go beyond the basics of the factory and configuration database to show how they enable highly reusable, polymorphic, and customizable testbenches." },
                { title: "Heartbeats", slug: "heartbeats", description: "Heartbeats." },
                { title: "UVM Callbacks", slug: "uvm-callbacks", description: "UVM callbacks." }
            ]
          },
          {
            title: "Advanced UVM Techniques",
            slug: "A-UVM-3_Advanced_UVM_Techniques",
            topics: [
                { title: "Advanced UVM Techniques", slug: "index", description: "Advanced UVM techniques." }
            ]
          },
          {
            title: "The UVM Register Abstraction Layer (RAL)",
            slug: "A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL",
            topics: [
                { title: "The UVM Register Abstraction Layer (RAL)", slug: "index", description: "A comprehensive introduction to the UVM Register Abstraction Layer." },
                { title: "Frontdoor vs Backdoor", slug: "frontdoor-vs-backdoor", description: "Frontdoor vs backdoor." },
                { title: "Built-in RAL Sequences", slug: "built-in-ral-sequences", description: "Built-in RAL sequences." },
                { title: "Explicit vs Implicit", slug: "explicit-vs-implicit", description: "Explicit vs implicit." }
            ]
          }
      ]
  },
  {
    title: "Expert",
    slug: "T4_Expert",
    tier: "T4",
    sections: [
        {
            title: "UVM Methodology Customization",
            slug: "E-CUST-1_UVM_Methodology_Customization",
            topics: [
              { title: "UVM Methodology Customization", slug: "index", description: "Strategies for identifying and fixing performance bottlenecks in UVM." }
            ]
        },
        {
            title: "Advanced UVM Debug Methodologies",
            slug: "E-DBG-1_Advanced_UVM_Debug_Methodologies",
            topics: [
              { title: "Advanced UVM Debug Methodologies", slug: "index", description: "Extending UVM with custom ports, reports, and callbacks." },
              { title: "Effective Debug", slug: "effective-debug", description: "Effective debug." },
              { title: "Reusable VIP", slug: "reusable-vip", description: "Reusable VIP." }
            ]
        },
        {
            title: "UVM Performance",
            slug: "E-PERF-1_UVM_Performance",
            topics: [
              { title: "UVM Performance", slug: "index", description: "UVM performance." }
            ]
        },
        {
            title: "Integrating UVM with Formal Verification",
            slug: "E-INT-1_Integrating_UVM_with_Formal_Verification",
            topics: [
              { title: "Integrating UVM with Formal Verification", slug: "index", description: "A comprehensive introduction to the UVM Register Abstraction Layer." },
              { title: "PSS", slug: "pss", description: "PSS." },
              { title: "DPI", slug: "dpi", description: "DPI." }
            ]
        },
        {
            title: "SoC-Level Verification Strategies",
            slug: "E-SOC-1_SoC-Level_Verification_Strategies",
            topics: [
              { title: "SoC-Level Verification Strategies", slug: "index", description: "High-level verification strategy and project planning." },
              { title: "Coverage Closure", slug: "coverage-closure", description: "Coverage closure." },
              { title: "Regression Triage", slug: "regression-triage", description: "Regression triage." }
            ]
        }
    ]
  },
  {
    title: "UVM Core",
    slug: "uvm-core",
    tier: "UVM Core",
    sections: [
        {
            title: "Fundamentals",
            slug: "fundamentals",
            topics: [
              { title: "Factory", slug: "factory", description: "Factory." },
              { title: "Component Communication", slug: "component-communication", description: "Component communication." },
              { title: "Base Classes", slug: "base-classes", description: "Base classes." },
              { title: "Phasing", slug: "phasing", description: "Phasing." }
            ]
        }
    ]
  },
  {
    title: "UVM Building",
    slug: "uvm-building",
    tier: "UVM Building",
    sections: [
        {
            title: "Essentials",
            slug: "essentials",
            topics: [
              { title: "Agents and Environment", slug: "agents-and-environment", description: "Agents and environment." },
              { title: "Architecture Overview", slug: "architecture-overview", description: "Architecture overview." },
              { title: "Analysis Components", slug: "analysis-components", description: "Analysis components." },
              { title: "Stimulus Generation", slug: "stimulus-generation", description: "Stimulus generation." }
            ]
        }
    ]
  },
  {
    title: "Interactive Tools",
    slug: "interactive-tools",
    tier: "Tools",
    sections: [
      {
        title: "UVM Visualizers",
        slug: "uvm-visualizers",
        topics: [
          {
            title: "Interactive UVM Testbench",
            slug: "interactive-testbench",
            description: "A hands-on, interactive visualizer for exploring the UVM testbench architecture, phasing, and data flow in real-time."
          }
        ]
      }
    ]
  }
];
function findTopicBySlug(slug) {
    if (slug.length !== 3)
        return undefined;
    var tierSlug = slug[0], sectionSlug = slug[1], topicSlug = slug[2];
    var courseModule = exports.curriculumData.find(function (m) { return m.slug === tierSlug; });
    if (!courseModule)
        return undefined;
    var section = courseModule.sections.find(function (s) { return s.slug === sectionSlug; });
    if (!section)
        return undefined;
    return section.topics.find(function (t) { return t.slug === topicSlug; });
}
function getBreadcrumbs(slug) {
    var breadcrumbs = [];
    if (slug.length > 0) {
        var courseModule = exports.curriculumData.find(function (m) { return m.slug === slug[0]; });
        if (courseModule) {
            breadcrumbs.push({ title: "Curriculum", path: "/curriculum" });
            breadcrumbs.push({ title: courseModule.title, path: "/curriculum/".concat(courseModule.slug) });
            if (slug.length > 1) {
                var section = courseModule.sections.find(function (s) { return s.slug === slug[1]; });
                if (section) {
                    breadcrumbs.push({ title: section.title, path: "/curriculum/".concat(courseModule.slug, "/").concat(section.slug) });
                    if (slug.length > 2) {
                        var topic = section.topics.find(function (t) { return t.slug === slug[2]; });
                        if (topic) {
                            breadcrumbs.push({ title: topic.title, path: "/curriculum/".concat(courseModule.slug, "/").concat(section.slug, "/").concat(topic.slug) });
                        }
                    }
                }
            }
        }
    }
    return breadcrumbs;
}
function findPrevNextTopics(slug) {
    if (slug.length !== 3)
        return { prev: undefined, next: undefined };
    var allTopics = [];
    exports.curriculumData.forEach(function (m) {
        m.sections.forEach(function (s) {
            s.topics.forEach(function (t) {
                allTopics.push(__assign(__assign({}, t), { slug: "".concat(m.slug, "/").concat(s.slug, "/").concat(t.slug) }));
            });
        });
    });
    var currentIndex = allTopics.findIndex(function (t) { return t.slug === slug.join('/'); });
    if (currentIndex === -1)
        return { prev: undefined, next: undefined };
    var prev = currentIndex > 0 ? allTopics[currentIndex - 1] : undefined;
    var next = currentIndex < allTopics.length - 1 ? allTopics[currentIndex + 1] : undefined;
    return { prev: prev, next: next };
}
