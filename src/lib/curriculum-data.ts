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
    slug: "t1_foundational",
    tier: "T1",
    sections: [
      {
        title: "Why Verification?",
        slug: "f1_why_verification",
        topics: [
          { title: "Welcome", slug: "index", description: "An introduction to the SystemVerilog Language." }
        ]
      },
    ],
  },
  {
    title: "Intermediate",
    slug: "t2_intermediate",
    tier: "T2",
    sections: [
        {
            title: "Object-Oriented Programming",
            slug: "i-sv-1_oop",
            topics: [
                { title: "Advanced SystemVerilog", slug: "index", description: "..." },
            ]
        },
    ]
  },
  {
      title: "Advanced",
      slug: "t3_advanced",
      tier: "T3",
      sections: [
          {
              title: "Advanced Sequencing",
              slug: "a-uvm-1_advanced_sequencing",
              topics: [
                  { title: "Advanced UVM", slug: "index", description: "..." },
              ]
          },
      ]
  },
  {
      title: "Expert",
      slug: "t4_expert",
      tier: "T4",
      sections: [
          {
              title: "UVM Performance",
              slug: "e-perf-1_uvm_performance",
              topics: [
                  { title: "UVM Performance", slug: "index", description: "..." },
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
