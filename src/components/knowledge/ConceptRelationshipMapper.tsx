'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { KnowledgeGraphData, getFullKnowledgeGraph, ConceptNode, RelationshipEdge } from '@/lib/knowledge-graph-engine';

const ConceptRelationshipMapper = () => {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [newConcept, setNewConcept] = useState({ id: '', name: '', description: '', tier: 'Foundational' as ConceptNode['tier'] });
  const [newRelationship, setNewRelationship] = useState({ source: '', target: '', type: 'PREREQUISITE' as RelationshipEdge['type'] });

  useEffect(() => {
    getFullKnowledgeGraph().then(data => {
      data.nodes.sort((a, b) => a.name.localeCompare(b.name));
      setGraphData(data);
      if (data.nodes.length >= 2) {
        setNewRelationship(prev => ({ ...prev, source: data.nodes[0].id, target: data.nodes[1].id }));
      }
    });
  }, []);

  const handleAddConcept = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newConcept.id || !newConcept.name || !newConcept.description) {
      alert('Please fill out all fields for the new concept.');
      return;
    }
    if (graphData?.nodes.some(node => node.id === newConcept.id)) {
      alert('A concept with this ID already exists.');
      return;
    }

    const newConceptNode: ConceptNode = { ...newConcept };

    setGraphData(prevData => {
      if (!prevData) return null;
      const updatedNodes = [...prevData.nodes, newConceptNode].sort((a, b) => a.name.localeCompare(b.name));
      return { ...prevData, nodes: updatedNodes };
    });

    // Reset form
    setNewConcept({ id: '', name: '', description: '', tier: 'Foundational' });
    (e.target as HTMLFormElement).reset();
  };

  const handleNewConceptChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewConcept(prev => ({ ...prev, [name]: value }));
  };

  const handleAddRelationship = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newRelationship.source === newRelationship.target) {
      alert('Source and Target concepts cannot be the same.');
      return;
    }
    const newEdge: RelationshipEdge = { ...newRelationship };
    setGraphData(prevData => {
        if (!prevData) return null;
        return { ...prevData, edges: [...prevData.edges, newEdge] };
    });
    alert('Relationship added locally. Note: This will not persist.');
  };

  const handleNewRelationshipChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewRelationship(prev => ({ ...prev, [name]: value }));
  };

  const relationshipTypes: RelationshipEdge['type'][] = ['PREREQUISITE', 'RELATED', 'EXAMPLE', 'NEXT_STEP'];
  const tierTypes: ConceptNode['tier'][] = ['Foundational', 'Intermediate', 'Advanced', 'Expert'];

  const InputField = ({ label, id, placeholder, value, onChange, type = 'text' }: any) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <input type={type} id={id} name={id} placeholder={placeholder} value={value} onChange={onChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
    </div>
  );

  const SelectField = ({ label, id, options, value, onChange }: any) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <select id={id} name={id} value={value} onChange={onChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
        {options.map((option: any) => {
          const optValue = typeof option === 'string' ? option : option.id;
          const optLabel = typeof option === 'string' ? option : option.name;
          return <option key={optValue} value={optValue}>{optLabel}</option>;
        })}
      </select>
    </div>
  );

  if (!graphData) {
    return <div>Loading graph data...</div>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Concept & Relationship Mapper</h2>
      <p className="text-sm text-gray-600 mb-4">Note: Changes made here are local to your session and will not be saved permanently.</p>
      <div className="space-y-8">
        {/* Add New Concept Form */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Add New Concept</h3>
          <form onSubmit={handleAddConcept} className="space-y-4">
            <InputField label="Concept ID" id="id" placeholder="e.g., uvm_scoreboard" value={newConcept.id} onChange={handleNewConceptChange} />
            <InputField label="Concept Name" id="name" placeholder="e.g., UVM Scoreboard" value={newConcept.name} onChange={handleNewConceptChange} />
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea id="description" name="description" rows={3} value={newConcept.description} onChange={handleNewConceptChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="A brief summary of the concept."></textarea>
            </div>
            <SelectField label="Tier" id="tier" options={tierTypes} value={newConcept.tier} onChange={handleNewConceptChange} />
            <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Add Concept</button>
          </form>
        </div>

        {/* Add New Relationship Form */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Add New Relationship</h3>
          <form onSubmit={handleAddRelationship} className="space-y-4">
            <SelectField label="Source Concept" id="source" options={graphData.nodes} value={newRelationship.source} onChange={handleNewRelationshipChange} />
            <SelectField label="Target Concept" id="target" options={graphData.nodes} value={newRelationship.target} onChange={handleNewRelationshipChange} />
            <SelectField label="Relationship Type" id="type" options={relationshipTypes} value={newRelationship.type} onChange={handleNewRelationshipChange} />
            <button type="submit" className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700">Add Relationship</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ConceptRelationshipMapper;
