// @/lib/knowledge-graph-engine.ts

/**
 * @file This file will contain the core logic for the knowledge graph engine.
 * It will handle data fetching, processing, and analysis for all knowledge-related components.
 * This includes interacting with a graph database (e.g., Neo4j), performing semantic analysis,
 * and providing data to the frontend components.
 */

// --- Type Definitions ---

export interface ConceptNode {
  id: string;
  name: string;
  description: string;
  tier: 'Foundational' | 'Intermediate' | 'Advanced' | 'Expert';
  // Add other properties like importance, maturity, etc.
}

export interface RelationshipEdge {
  source: string; // ID of the source concept
  target: string; // ID of the target concept
  type: 'PREREQUISITE' | 'RELATED' | 'EXAMPLE' | 'NEXT_STEP';
  strength?: number;
}

export interface KnowledgeGraphData {
  nodes: ConceptNode[];
  edges: RelationshipEdge[];
}

// --- API Functions ---

/**
 * Fetches the complete knowledge graph data.
 * In a real implementation, this would query a graph database.
 */
export const getFullKnowledgeGraph = async (): Promise<KnowledgeGraphData> => {
  console.log('Fetching full knowledge graph...');
  // Expanded placeholder data
  const nodes: ConceptNode[] = [
    // Foundational
    { id: 'data_types', name: 'Data Types', description: 'Logic, integers, arrays, queues.', tier: 'Foundational' },
    { id: 'procedural_blocks', name: 'Procedural Blocks', description: 'Initial and always blocks.', tier: 'Foundational' },
    { id: 'rtl_modeling', name: 'RTL Modeling', description: 'Combinational and sequential logic design.', tier: 'Foundational' },
    { id: 'sv_interfaces', name: 'SV Interfaces', description: 'Bundling signals for communication.', tier: 'Foundational' },

    // Intermediate
    { id: 'oop_sv', name: 'OOP in SV', description: 'Classes, objects, inheritance.', tier: 'Intermediate' },
    { id: 'randomization', name: 'Constrained Randomization', description: 'rand, randc, constraints.', tier: 'Intermediate' },
    { id: 'coverage', name: 'Functional Coverage', description: 'Covergroups, coverpoints, bins.', tier: 'Intermediate' },
    { id: 'assertions', name: 'SVA', description: 'SystemVerilog Assertions.', tier: 'Intermediate' },
    { id: 'uvm_intro', name: 'UVM Introduction', description: 'UVM methodology and components.', tier: 'Intermediate' },
    { id: 'uvm_factory', name: 'UVM Factory', description: 'Object and component creation.', tier: 'Intermediate' },
    { id: 'uvm_sequences', name: 'UVM Sequences', description: 'Generating stimulus for the DUT.', tier: 'Intermediate' },

    // Advanced
    { id: 'uvm_ral', name: 'UVM RAL', description: 'Register Abstraction Layer.', tier: 'Advanced' },
    { id: 'adv_sequences', name: 'Advanced Sequences', description: 'Virtual sequences, layering.', tier: 'Advanced' },
    { id: 'uvm_phasing', name: 'UVM Phasing', description: 'Synchronization and execution flow.', tier: 'Advanced' },

    // Expert
    { id: 'custom_uvm', name: 'Customizing UVM', description: 'Extending UVM for custom methodologies.', tier: 'Expert' },
  ];

  const edges: RelationshipEdge[] = [
    // Foundational Prerequisites
    { source: 'data_types', target: 'procedural_blocks', type: 'PREREQUISITE' },
    { source: 'procedural_blocks', target: 'rtl_modeling', type: 'PREREQUISITE' },
    { source: 'rtl_modeling', target: 'sv_interfaces', type: 'RELATED' },

    // Intermediate Prerequisites
    { source: 'data_types', target: 'oop_sv', type: 'PREREQUISITE' },
    { source: 'oop_sv', target: 'randomization', type: 'PREREQUISITE' },
    { source: 'randomization', target: 'coverage', type: 'RELATED' },
    { source: 'rtl_modeling', target: 'assertions', type: 'PREREQUISITE' },
    { source: 'oop_sv', target: 'uvm_intro', type: 'PREREQUISITE' },
    { source: 'sv_interfaces', target: 'uvm_intro', type: 'PREREQUISITE' },

    // UVM Intermediate Dependencies
    { source: 'uvm_intro', target: 'uvm_factory', type: 'PREREQUISITE' },
    { source: 'uvm_intro', target: 'uvm_sequences', type: 'PREREQUISITE' },
    { source: 'uvm_factory', target: 'uvm_sequences', type: 'RELATED' },

    // Advanced Prerequisites
    { source: 'uvm_sequences', target: 'adv_sequences', type: 'PREREQUISITE' },
    { source: 'uvm_factory', target: 'uvm_ral', type: 'PREREQUISITE' },
    { source: 'uvm_intro', target: 'uvm_phasing', type: 'PREREQUISITE' },
    { source: 'adv_sequences', target: 'uvm_ral', type: 'RELATED' },

    // Expert Prerequisites
    { source: 'adv_sequences', target: 'custom_uvm', type: 'PREREQUISITE' },
    { source: 'uvm_ral', target: 'custom_uvm', type: 'PREREQUISITE' },
    { source: 'uvm_phasing', target: 'custom_uvm', type: 'PREREQUISITE' },
  ];

  return Promise.resolve({ nodes, edges });
};

export interface DependencyAnalysis {
  prerequisites: ConceptNode[];
  dependents: ConceptNode[];
}

/**
 * Analyzes dependencies for a given concept.
 * @param graphData The full knowledge graph data.
 * @param conceptId The ID of the concept to analyze.
 */
export const analyzeDependencies = (graphData: KnowledgeGraphData, conceptId: string): DependencyAnalysis => {
  const nodeMap = new Map(graphData.nodes.map(node => [node.id, node]));

  const prerequisites = graphData.edges
    .filter(edge => edge.target === conceptId && edge.type === 'PREREQUISITE')
    .map(edge => nodeMap.get(edge.source as string))
    .filter((node): node is ConceptNode => node !== undefined);

  const dependents = graphData.edges
    .filter(edge => edge.source === conceptId && edge.type === 'PREREQUISITE')
    .map(edge => nodeMap.get(edge.target as string))
    .filter((node): node is ConceptNode => node !== undefined);

  return { prerequisites, dependents };
};

export interface LearningPath {
  path: ConceptNode[];
  // estimatedTime could be added later
}

/**
 * Generates a personalized learning path using Breadth-First Search.
 * @param graphData The full knowledge graph data.
 * @param startConceptId The ID of the starting concept.
 * @param goalConceptId The ID of the target concept.
 */
export const generateLearningPath = (
  graphData: KnowledgeGraphData,
  startConceptId: string,
  goalConceptId: string
): LearningPath => {
  const nodeMap = new Map(graphData.nodes.map(node => [node.id, node]));
  const adj = new Map<string, string[]>();

  for (const edge of graphData.edges) {
    if (edge.type === 'PREREQUISITE') {
      if (!adj.has(edge.source as string)) adj.set(edge.source as string, []);
      adj.get(edge.source as string)!.push(edge.target as string);
    }
  }

  const queue: string[][] = [[startConceptId]];
  const visited = new Set<string>([startConceptId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const nodeId = path[path.length - 1];

    if (nodeId === goalConceptId) {
      // Path found, convert IDs to nodes
      const conceptPath = path.map(id => nodeMap.get(id)).filter((n): n is ConceptNode => n !== undefined);
      return { path: conceptPath };
    }

    const neighbors = adj.get(nodeId) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        const newPath = [...path, neighborId];
        queue.push(newPath);
      }
    }
  }

  return { path: [] }; // No path found
};

/**
 * Wraps recognized concepts in a given text with a custom component tag for interactive linking.
 * @param text The raw text content to process.
 * @param nodes The list of all concept nodes.
 * @returns The text with concepts wrapped in <ConceptLink> components.
 */
export const wrapConceptsInText = (text: string, nodes: ConceptNode[]): string => {
  // Sort nodes by name length, descending, to match longer names first
  const sortedNodes = [...nodes].sort((a, b) => b.name.length - a.name.length);
  const nameToIdMap = new Map(sortedNodes.map(node => [node.name.toLowerCase(), node.id]));

  // Create a regex to match any of the concept names as whole words, case-insensitively
  const conceptNamesRegex = new RegExp(
    `\\b(${sortedNodes.map(node => node.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi'
  );

  // Preserve InteractiveCode code props so we don't inject concept tags into string literals
  const codeSnippets: string[] = [];
  const placeholderPrefix = '@@CODE_SNIPPET_';
  const sanitized = text.replace(/code={`[\s\S]*?`}/g, (snippet) => {
    const token = `${placeholderPrefix}${codeSnippets.length}@@`;
    codeSnippets.push(snippet);
    return token;
  });

  // A simple way to avoid replacing text inside code blocks
  const parts = sanitized.split(/(```[\s\S]*?```|`[^`]*?`)/);

  const replaced = parts.map((part, index) => {
    // If the part is a code block (odd index), return it as is
    if (index % 2 === 1) {
      return part;
    }
    // Otherwise, run the replacement
    return part.replace(conceptNamesRegex, (match) => {
      const conceptId = nameToIdMap.get(match.toLowerCase());
      if (conceptId) {
        return `<ConceptLink conceptId="${conceptId}">${match}</ConceptLink>`;
      }
      return match;
    });
  }).join('');

  return codeSnippets.reduce(
    (acc, snippet, index) => acc.replace(`${placeholderPrefix}${index}@@`, snippet),
    replaced,
  );
};

console.log('Knowledge graph engine loaded.');
