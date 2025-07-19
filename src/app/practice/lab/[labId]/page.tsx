import React from 'react';
import LabClientPage from './LabClientPage';

const lab = {
  id: "1",
  title: "My First Lab",
  steps: [
    {
      id: "1",
      title: "Step 1: Declare a variable",
      instructions: "Declare a variable named 'myVar' of type 'int'.",
      starterCode: "// Your code here",
    },
    {
      id: "2",
      title: "Step 2: Assign a value",
      instructions: "Assign the value 10 to the variable 'myVar'.",
      starterCode: "int myVar;",
    },
  ],
};

type LabPageProps = {
  params: Promise<{
    labId: string;
  }>;
};

export default async function LabPage({ params }: LabPageProps) {
  const { labId } = await params;
  // In a real app, you would fetch the lab data based on the labId
  return <LabClientPage lab={lab} />;
}
