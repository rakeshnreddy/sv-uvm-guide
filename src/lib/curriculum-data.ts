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
  tier: string;
  sections: Section[];
}

export const curriculumData: Module[] = [
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
        title: "SystemVerilog Basics",
        slug: "F2_SystemVerilog_Basics",
        topics: [
          { title: "SystemVerilog Basics", slug: "index", description: "A comprehensive introduction to the fundamental building blocks of the SystemVerilog language." }
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
        title: "Verification Basics without UVM",
        slug: "F4_Verification_Basics_without_UVM",
        topics: [
          { title: "Verification Basics without UVM", slug: "index", description: "Bridging the gap between basic SystemVerilog and the complex UVM methodology." }
        ]
      },
      {
        title: "Intro to Object-Oriented Programming (OOP) in SV",
        slug: "F5_Intro_to_OOP_in_SV",
        topics: [
          { title: "Intro to Object-Oriented Programming (OOP) in SV", slug: "index", description: "The final prerequisite before diving into UVM." }
        ]
      },
      {
        title: "Data Types",
        slug: "F2_Data_Types",
        topics: [
            { title: "Data Types", slug: "index", description: "Exploring SystemVerilog's data types." },
        ]
      },
      {
        title: "Procedural Constructs",
        slug: "F3_Procedural_Constructs",
        topics: [
            { title: "Procedural Constructs", slug: "index", description: "Understanding the building blocks of SystemVerilog code." },
        ]
      },
      {
        title: "RTL and Testbench Constructs",
        slug: "F4_RTL_and_Testbench_Constructs",
        topics: [
            { title: "RTL and Testbench Constructs", slug: "index", description: "Key constructs for design and verification." },
        ]
      },
    ],
  },
  {
    title: "Intermediate",
    slug: "T2_Intermediate",
    tier: "T2",
    sections: [
        {
            title: "Object-Oriented Programming",
            slug: "I-SV-1_OOP",
            topics: [
                { title: "Object-Oriented Programming", slug: "index", description: "The fundamentals of OOP in SystemVerilog." },
            ]
        },
        {
            title: "Constrained Randomization",
            slug: "I-SV-2_Constrained_Randomization",
            topics: [
                { title: "Constrained Randomization", slug: "index", description: "Generating random data with constraints." },
            ]
        },
        {
            title: "Functional Coverage",
            slug: "I-SV-3_Functional_Coverage",
            topics: [
              { title: "Functional Coverage", slug: "index", description: "Measuring verification effectiveness." },
            ]
        },
        {
            title: "SystemVerilog Assertions (SVA)",
            slug: "I-SV-4_Assertions_SVA",
            topics: [
                { title: "SystemVerilog Assertions (SVA)", slug: "index", description: "Using SystemVerilog Assertions for verification." },
            ]
        },
        {
            title: "UVM Introduction: Objects, Components, and Factory",
            slug: "I-UVM-1_UVM_Intro",
            topics: [
                { title: "UVM Introduction", slug: "index", description: "An introduction to the Universal Verification Methodology." },
            ]
        },
        {
            title: "Building a UVM Testbench: Components & Hierarchy",
            slug: "I-UVM-2_Building_TB",
            topics: [
                { title: "Building a UVM Testbench", slug: "index", description: "Exploring the foundational classes of UVM." },
            ]
        },
        {
            title: "Basic UVM Sequences and Stimulus Generation",
            slug: "I-UVM-3_Sequences",
            topics: [
                { title: "Basic UVM Sequences", slug: "index", description: "How UVM components talk to each other." },
            ]
        }
    ]
  },
  {
      title: "The UVM Universe - Core Concepts",
      slug: "uvm-core",
      tier: "T2",
      sections: [
        {
          title: "Fundamentals",
          slug: "fundamentals",
          topics: [
            { title: "UVM Base Classes", slug: "base-classes", description: "uvm_object vs uvm_component." },
            { title: "Component Communication", slug: "component-communication", description: "TLM ports and analysis ports." },
            { title: "Factory", slug: "factory", description: "Factory overrides and creation." },
            { title: "Phasing", slug: "phasing", description: "UVM phasing mechanism." }
          ]
        }
      ]
  },
  {
      title: "Building a UVM Testbench",
      slug: "uvm-building",
      tier: "T2",
      sections: [
        {
          title: "Essentials",
          slug: "essentials",
          topics: [
            { title: "Architecture Overview", slug: "architecture-overview", description: "Overview of a UVM testbench." },
            { title: "Stimulus Generation", slug: "stimulus-generation", description: "Sequences and driver handshake." },
            { title: "Analysis Components", slug: "analysis-components", description: "Monitors, subscribers, scoreboards." },
            { title: "Agents and Environment", slug: "agents-and-environment", description: "Agent vs environment." }
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
              title: "Advanced UVM Sequencing",
              slug: "A-UVM-1_Advanced_Sequencing",
              topics: [
                  { title: "Advanced UVM Sequencing", slug: "index", description: "Sophisticated stimulus generation techniques." },
              ]
          },
          {
              title: "The UVM Factory In-Depth",
              slug: "A-UVM-2_The_UVM_Factory_In-Depth",
              topics: [
                { title: "The UVM Factory In-Depth", slug: "index", description: "A deeper dive into the UVM factory." },
              ]
          },
          {
              title: "The UVM Register Abstraction Layer (RAL)",
              slug: "A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL",
              topics: [
                { title: "The UVM Register Abstraction Layer (RAL)", slug: "index", description: "Simplifying register access in UVM." },
              ]
          },
          {
            title: "UVM Sequences and Virtual Sequences",
            slug: "A1_UVM_Sequences",
            topics: [
                { title: "UVM Sequences and Virtual Sequences", slug: "index", description: "In-depth guide to UVM sequence mechanics, layering, and the use of virtual sequences." },
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
                { title: "UVM Methodology Customization", slug: "index", description: "Tailoring UVM to your needs." },
              ]
          },
          {
              title: "Advanced UVM Debug",
              slug: "E-DBG-1_Advanced_UVM_Debug_Methodologies",
              topics: [
                { title: "Advanced UVM Debug", slug: "index", description: "Techniques for debugging complex UVM environments." },
              ]
          },
          {
              title: "Integrating UVM with Formal Verification",
              slug: "E-INT-1_Integrating_UVM_with_Formal_Verification",
              topics: [
                { title: "Integrating UVM with Formal Verification", slug: "index", description: "Combining the power of UVM and formal methods." },
              ]
          },
          {
              title: "SoC-Level Verification",
              slug: "E-SOC-1_SoC-Level_Verification_Strategies",
              topics: [
                { title: "SoC-Level Verification", slug: "index", description: "Strategies for verifying complex SoCs." },
              ]
          },
      ]
  }
];

// Helper functions to navigate the new structure

export function findTopicBySlug(slug: string[]): Topic | undefined {
  if (slug.length !== 3) return undefined;
  const [tierSlug, sectionSlug, topicSlug] = slug;
  const courseModule = curriculumData.find(m => m.slug === tierSlug);
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
      breadcrumbs.push({ title: "Curriculum", path: `/curriculum` });
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

export function findPrevNextTopics(slug: string[]): { prev: Topic | undefined, next: Topic | undefined } {
  if (slug.length !== 3) return { prev: undefined, next: undefined };

  const allTopics: Topic[] = [];
  curriculumData.forEach(m => {
    m.sections.forEach(s => {
      s.topics.forEach(t => {
        allTopics.push({ ...t, slug: `${m.slug}/${s.slug}/${t.slug}` });
      });
    });
  });

  const currentIndex = allTopics.findIndex(t => t.slug === slug.join('/'));
  if (currentIndex === -1) return { prev: undefined, next: undefined };

  const prev = currentIndex > 0 ? allTopics[currentIndex - 1] : undefined;
  const next = currentIndex < allTopics.length - 1 ? allTopics[currentIndex + 1] : undefined;

  return { prev, next };
}
