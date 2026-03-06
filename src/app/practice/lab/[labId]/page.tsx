import React from 'react';
import LabClientPage from './LabClientPage';
import { getLabById } from '@/lib/lab-registry';
import { notFound } from 'next/navigation';

type LabPageProps = {
  params: Promise<{
    labId: string;
  }>;
};

export default async function LabPage({ params }: LabPageProps) {
  const { labId } = await params;
  const lab = getLabById(labId);

  if (!lab) {
    notFound();
  }

  return <LabClientPage lab={lab} />;
}
