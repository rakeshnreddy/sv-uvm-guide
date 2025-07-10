export interface CurriculumNode {
  id: string; // A unique identifier, e.g., 'sv-foundations-data-types'
  title: string;
  path: string; // The full URL path, e.g., '/curriculum/sv-foundations/data-types/literals-and-basic-types'
  status: 'published' | 'draft' | 'planned';
  children?: CurriculumNode[]; // Corrected: children should be an array of CurriculumNode
}

export const curriculumData: CurriculumNode[] = [ // Changed to array to represent multiple top-level modules
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
            id: 'sv-foundations-data-types-literals',
            title: 'Literals and Basic Types',
            path: '/curriculum/sv-foundations/data-types/literals-and-basic-types',
            status: 'planned',
          },
          {
            id: 'sv-foundations-data-types-nets-variables',
            title: 'Nets and Variables: logic vs. wire',
            path: '/curriculum/sv-foundations/data-types/nets-and-variables-logic-vs-wire',
            status: 'planned',
          },
        ],
      },
    ],
  },
  {
    id: 'sv-advanced',
    title: 'Advanced SystemVerilog Topics',
    path: '/curriculum/sv-advanced',
    status: 'planned',
    children: [
      {
        id: 'sv-advanced-oop',
        title: 'Object-Oriented Programming',
        path: '/curriculum/sv-advanced/object-oriented-programming',
        status: 'planned',
        children: [
          {
            id: 'sv-advanced-oop-inheritance',
            title: 'Inheritance, Polymorphism, and Virtual Methods',
            path: '/curriculum/sv-advanced/object-oriented-programming/inheritance-polymorphism-virtual-methods',
            status: 'planned',
          },
        ],
      },
    ],
  },
  {
    id: 'uvm-core',
    title: 'UVM Core Concepts',
    path: '/curriculum/uvm-core',
    status: 'planned',
    children: [
      {
        id: 'uvm-core-base-class-library',
        title: 'Base Class Library',
        path: '/curriculum/uvm-core/base-class-library',
        status: 'planned',
        children: [
          {
            id: 'uvm-core-bcl-object-vs-component',
            title: 'uvm_object vs. uvm_component',
            path: '/curriculum/uvm-core/base-class-library/uvm-object-vs-uvm-component',
            status: 'planned',
          },
        ],
      },
      {
        id: 'uvm-core-phasing',
        title: 'Phasing and Synchronization',
        path: '/curriculum/uvm-core/phasing-and-synchronization',
        status: 'planned',
        children: [
          {
            id: 'uvm-core-phasing-detail',
            title: 'The UVM Phases in Detail',
            path: '/curriculum/uvm-core/phasing-and-synchronization/the-uvm-phases-in-detail',
            status: 'planned',
          },
        ],
      },
    ],
  },
];

// Helper function to get a flat list of all nodes (useful for generateStaticParams)
export function getAllCurriculumNodes(nodes: CurriculumNode[]): CurriculumNode[] {
  let flatList: CurriculumNode[] = [];
  for (const node of nodes) {
    flatList.push(node);
    if (node.children) {
      flatList = flatList.concat(getAllCurriculumNodes(node.children));
    }
  }
  return flatList;
}

// Helper function to find a node by path
export function findNodeByPath(nodes: CurriculumNode[], path: string): CurriculumNode | undefined {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const foundInChildren = findNodeByPath(node.children, path);
      if (foundInChildren) {
        return foundInChildren;
      }
    }
  }
  return undefined;
}

// Helper function to get breadcrumbs for a given path
export function getBreadcrumbs(
  nodes: CurriculumNode[],
  currentPath: string
): CurriculumNode[] {
  const pathSegments = currentPath.split('/').filter(Boolean); // e.g., ['curriculum', 'sv-foundations', 'data-types']
  const breadcrumbs: CurriculumNode[] = [];
  let currentNodes = nodes;
  let builtPath = '';

  for (let i = 1; i < pathSegments.length; i++) { // Start from 1 to skip 'curriculum'
    builtPath += '/' + pathSegments[i-1] ; // Path for parent
    if (i > 1) builtPath += '/' + pathSegments[i]; else builtPath += '/' + pathSegments[i];


    const segmentToFind = pathSegments.slice(0, i + 1).join('/');
    const node = findNodeByPath(nodes, `/${segmentToFind}`);


    if (node) {
       // Check if the node is already added to avoid duplicates from nested searches
      if (!breadcrumbs.find(b => b.id === node.id)) {
        breadcrumbs.push(node);
      }
      currentNodes = node.children || [];
    } else {
      // If a specific segment doesn't match a node path directly,
      // we might be looking for a parent path.
      // This logic might need refinement based on how paths are structured.
      const parentPath = '/' + pathSegments.slice(0, i).join('/');
      const parentNode = findNodeByPath(nodes, parentPath);
      if (parentNode && !breadcrumbs.find(b => b.id === parentNode.id)) {
          // breadcrumbs.push(parentNode); // Avoid pushing parent if current segment is the actual node
      }
    }
  }
   // Add the current page itself to breadcrumbs if it's a valid node path
  const currentNode = findNodeByPath(nodes, currentPath);
  if (currentNode && !breadcrumbs.find(b => b.id === currentNode.id)) {
    // Check if the last breadcrumb added is not the current node already
    if (breadcrumbs.length === 0 || breadcrumbs[breadcrumbs.length-1].path !== currentPath) {
       // breadcrumbs.push(currentNode); // This might be redundant if paths are exact
    }
  }


  // Refined breadcrumb generation
  const resultCrumbs: CurriculumNode[] = [];
  let pathAcc = '';
  for(const segment of pathSegments) {
    pathAcc += `/${segment}`;
    const foundNode = findNodeByPath(nodes, pathAcc);
    if (foundNode && !resultCrumbs.find(n => n.id === foundNode.id)) {
      resultCrumbs.push(foundNode);
    }
  }


  return resultCrumbs;
}


// Helper function to find next and previous lessons
export function getNextPrevLessons(
  flatNodes: CurriculumNode[],
  currentPath: string
): { prev?: CurriculumNode; next?: CurriculumNode } {
  const currentIndex = flatNodes.findIndex(node => node.path === currentPath && !node.children); // Only consider leaf nodes as "lessons"
  if (currentIndex === -1) {
    return {};
  }

  let prevNode: CurriculumNode | undefined = undefined;
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!flatNodes[i].children) { // Found previous leaf node
      prevNode = flatNodes[i];
      break;
    }
  }

  let nextNode: CurriculumNode | undefined = undefined;
  for (let i = currentIndex + 1; i < flatNodes.length; i++) {
    if (!flatNodes[i].children) { // Found next leaf node
      nextNode = flatNodes[i];
      break;
    }
  }
  return { prev: prevNode, next: nextNode };
}
