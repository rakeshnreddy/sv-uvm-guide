"use client";

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Lock, Award, Clock } from 'lucide-react';

type CertificationStatus = 'Locked' | 'In Progress' | 'Completed';

interface Certification {
  id: string;
  title: string;
  description: string;
  status: CertificationStatus;
  progress: number;
}

const mockCertifications: Certification[] = [
  {
    id: 'sv-assoc',
    title: 'SystemVerilog Associate',
    description: 'Demonstrates fundamental knowledge of SystemVerilog for design and verification.',
    status: 'Completed',
    progress: 100,
  },
  {
    id: 'uvm-prof',
    title: 'UVM Professional',
    description: 'Validates proficiency in building and managing complex UVM environments.',
    status: 'In Progress',
    progress: 65,
  },
  {
    id: 'cov-expert',
    title: 'Coverage Expert',
    description: 'Showcases expertise in advanced coverage modeling and analysis techniques.',
    status: 'Locked',
    progress: 0,
  },
  {
    id: 'assertion-master',
    title: 'Assertion-Based Verification Master',
    description: 'Certifies mastery in writing and managing SystemVerilog Assertions.',
    status: 'Locked',
    progress: 0,
  },
];

const StatusIcon = ({ status }: { status: CertificationStatus }) => {
  switch (status) {
    case 'Completed':
      return <Award className="h-8 w-8 text-yellow-400" />;
    case 'In Progress':
      return <Clock className="h-8 w-8 text-blue-400" />;
    case 'Locked':
      return <Lock className="h-8 w-8 text-gray-500" />;
  }
};

export const CompetencyCertification = () => {
  return (
    <div className="p-4 border border-dashed border-white/30 rounded-lg my-6 bg-white/5">
      <h2 className="text-2xl font-bold text-primary mb-4">Competency Certification</h2>
      <p className="text-foreground/80 mb-6">
        Achieve industry-recognized certifications to validate your skills and advance your career.
      </p>

      <div className="space-y-6">
        {mockCertifications.map((cert) => (
          <div key={cert.id} className="flex items-center gap-6 p-4 bg-white/5 rounded-lg">
            <div className="flex-shrink-0">
              <StatusIcon status={cert.status} />
            </div>
            <div className="flex-grow">
              <h3 className="text-lg font-semibold text-primary">{cert.title}</h3>
              <p className="text-sm text-muted-foreground mb-2">{cert.description}</p>
              {cert.status !== 'Locked' && (
                <>
                  <Progress value={cert.progress} className="h-2 mb-1" />
                  <p className="text-xs text-muted-foreground">{cert.progress}% complete</p>
                </>
              )}
            </div>
            <div className="flex-shrink-0">
              {cert.status === 'Completed' && <Button variant="secondary" disabled>View Certificate</Button>}
              {cert.status === 'In Progress' && <Button>Continue</Button>}
              {cert.status === 'Locked' && <Button variant="outline" disabled>Unlock</Button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompetencyCertification;
