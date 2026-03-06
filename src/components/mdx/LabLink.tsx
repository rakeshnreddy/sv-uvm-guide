import React from 'react';
import Link from 'next/link';
import { Beaker } from 'lucide-react';
import { getLabById } from '@/lib/lab-registry';

interface LabLinkProps {
  labId: string;
}

export const LabLink = ({ labId }: LabLinkProps) => {
  const lab = getLabById(labId);

  if (!lab) {
    return (
      <div className="my-6 p-4 border border-red-500 bg-red-50 rounded-md text-red-700">
        <strong>Error:</strong> Lab mapping failed for ID <code>{labId}</code>.
      </div>
    );
  }

  return (
    <div className="my-6 p-4 border border-[color:var(--blueprint-accent)] bg-[color:var(--blueprint-bg)] rounded-lg shadow-sm">
      <div className="flex items-start gap-3">
        <Beaker className="w-6 h-6 text-[color:var(--blueprint-accent)] mt-1" />
        <div>
          <h4 className="text-lg font-bold text-[color:var(--blueprint-foreground)] m-0">
            Practice Lab: {lab.title}
          </h4>
          <p className="text-[color:var(--blueprint-foreground)]/80 mt-1 mb-3 text-sm">
            {lab.description}
          </p>
          <Link
            href={`/practice/lab/${labId}`}
            className="inline-flex items-center justify-center px-4 py-2 bg-[color:var(--blueprint-accent)] text-white font-medium rounded hover:bg-opacity-90 transition-colors"
          >
            Launch Lab
          </Link>
        </div>
      </div>
    </div>
  );
};
