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
            title: "Assertions (SVA)",
            slug: "I-SV-4_Assertions_SVA",
            topics: [
                { title: "Assertions (SVA)", slug: "index", description: "Using SystemVerilog Assertions for verification." },
            ]
        },
        {
            title: "Core UVM Concepts",
            slug: "I-UVM-1_Core_Concepts",
            topics: [
                { title: "Core UVM Concepts", slug: "index", description: "An introduction to the Universal Verification Methodology." },
            ]
        },
        {
            title: "UVM Base Class Library",
            slug: "I-UVM-2_Base_Class_Library",
            topics: [
                { title: "UVM Base Class Library", slug: "index", description: "Exploring the foundational classes of UVM." },
            ]
        },
        {
            title: "UVM Component Communication",
            slug: "I-UVM-3_Component_Communication",
            topics: [
                { title: "UVM Component Communication", slug: "index", description: "How UVM components talk to each other." },
            ]
        },
        {
            title: "UVM Factory and Overrides",
            slug: "I-UVM-4_Factory_and_Overrides",
            topics: [
                { title: "UVM Factory and Overrides", slug: "index", description: "The power of the UVM factory." },
            ]
        },
        {
            title: "UVM Phasing and Synchronization",
            slug: "I-UVM-5_Phasing_and_Synchronization",
            topics: [
                { title: "UVM Phasing and Synchronization", slug: "index", description: "Managing the UVM simulation lifecycle." },
            ]
        },
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
              title: "Advanced UVM Techniques",
              slug: "A-UVM-3_Advanced_UVM_Techniques",
              topics: [
                { title: "Advanced UVM Techniques", slug: "index", description: "Exploring advanced UVM features." },
              ]
          },
          {
              title: "The UVM Register Abstraction Layer (RAL)",
              slug: "A-UVM-4_The_UVM_Register_Abstraction_Layer_RAL",
              topics: [
                { title: "The UVM Register Abstraction Layer (RAL)", slug: "index", description: "Simplifying register access in UVM." },
              ]
          },
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
              title: "UVM Performance",
              slug: "E-PERF-1_UVM_Performance",
              topics: [
                { title: "UVM Performance", slug: "index", description: "Optimizing UVM for speed." },
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
