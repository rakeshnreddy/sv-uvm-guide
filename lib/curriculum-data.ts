export interface CurriculumNode {
  id: string; // A unique identifier, e.g., 'sv-foundations-data-types'
  title: string;
  path: string; // The full URL path, e.g., '/curriculum/sv-foundations/data-types/literals-and-basic-types'
  status: 'published' | 'draft' | 'planned';
  children?: CurriculumNode[]; // Corrected to be an array of CurriculumNode
}

export const curriculumData: CurriculumNode = {
  id: 'curriculum-home',
  title: 'Curriculum Home',
  path: '/curriculum',
  status: 'planned',
  children: [
    // MODULE 1: SystemVerilog Foundations
    {
      id: 'sv-foundations',
      title: 'SystemVerilog Foundations',
      path: '/curriculum/sv-foundations',
      status: 'planned',
      children: [
        {
          id: 'sv-foundations-introduction',
          title: 'Introduction to SystemVerilog Foundations',
          path: '/curriculum/sv-foundations/introduction',
          status: 'planned',
        },
        {
          id: 'sv-foundations-data-types',
          title: 'Data Types',
          path: '/curriculum/sv-foundations/data-types',
          status: 'planned',
          children: [
            {
              id: 'sv-foundations-data-types-literals-and-basic-types',
              title: 'Literals and Basic Types',
              path: '/curriculum/sv-foundations/data-types/literals-and-basic-types',
              status: 'planned',
            },
            {
              id: 'sv-foundations-data-types-nets-and-variables-logic-vs-wire',
              title: 'Nets and Variables: logic vs. wire',
              path: '/curriculum/sv-foundations/data-types/nets-and-variables-logic-vs-wire',
              status: 'planned',
            },
            // Add other data type sub-topics here
          ],
        },
        // Add other Module 1 topics here (e.g., Procedural Blocks, Basic Testbench Constructs)
      ],
    },
    // MODULE 2: Advanced SystemVerilog & Verification Concepts
    {
      id: 'sv-advanced',
      title: 'Advanced SystemVerilog & Verification Concepts',
      path: '/curriculum/sv-advanced',
      status: 'planned',
      children: [
        {
          id: 'sv-advanced-object-oriented-programming',
          title: 'Object-Oriented Programming in SystemVerilog',
          path: '/curriculum/sv-advanced/object-oriented-programming',
          status: 'planned',
          children: [
            {
              id: 'sv-advanced-object-oriented-programming-inheritance-polymorphism-virtual-methods',
              title: 'Inheritance, Polymorphism, and Virtual Methods',
              path: '/curriculum/sv-advanced/object-oriented-programming/inheritance-polymorphism-virtual-methods',
              status: 'planned',
            },
            // Add other OOP sub-topics here
          ],
        },
        // Add other Module 2 topics here
      ],
    },
    // MODULE 3: UVM Core Concepts & Methodology
    {
      id: 'uvm-core',
      title: 'UVM Core Concepts & Methodology',
      path: '/curriculum/uvm-core',
      status: 'planned',
      children: [
        {
          id: 'uvm-core-base-class-library',
          title: 'UVM Base Class Library',
          path: '/curriculum/uvm-core/base-class-library',
          status: 'planned',
          children: [
            {
              id: 'uvm-core-base-class-library-uvm-object-vs-uvm-component',
              title: 'uvm_object vs. uvm_component',
              path: '/curriculum/uvm-core/base-class-library/uvm-object-vs-uvm-component',
              status: 'planned',
            },
            // Add other BCL sub-topics here
          ],
        },
        {
          id: 'uvm-core-phasing-and-synchronization',
          title: 'Phasing and Synchronization',
          path: '/curriculum/uvm-core/phasing-and-synchronization',
          status: 'planned',
          children: [
            {
              id: 'uvm-core-phasing-and-synchronization-the-uvm-phases-in-detail',
              title: 'The UVM Phases in Detail',
              path: '/curriculum/uvm-core/phasing-and-synchronization/the-uvm-phases-in-detail',
              status: 'planned',
            },
            // Add other phasing sub-topics here
          ],
        },
        // Add other Module 3 topics here
      ],
    },
    // Add other Modules (e.g., Module 4: UVM Advanced Topics, Module 5: Functional Coverage, etc.) here
  ],
};
