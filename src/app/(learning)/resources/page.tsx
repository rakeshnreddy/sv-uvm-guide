import React from 'react';
import type { Metadata } from 'next';

import { RESOURCE_GROUPS, VERIFIED_ON } from '@/lib/resources';
import { resolveResources } from '@/lib/resources-lessons';

import ResourceLibrary from './ResourceLibrary';

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'A checked reference library for SystemVerilog, UVM and AMBA: IEEE 1800-2023 and IEEE 1800.2-2020 (free through the IEEE GET Program), Accellera uvm-core, the Arm AMBA specifications by document number, and free tools such as Verilator, Icarus Verilog, EDA Playground, cocotb, pyuvm and riscv-dv, with the lessons that use each one.',
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${day} ${months[month - 1]} ${year}`;
}

export default function ResourcesPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Resources</h1>
        <p className="mt-3 text-lg leading-relaxed text-foreground/90">
          The standards, specifications and free tools the lessons rely on, grouped by what you need them for. Each
          entry says what it covers, when to reach for it and which lessons use it.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Every link was opened and checked on {formatDate(VERIFIED_ON)}. Statements about what a tool supports come
          from that tool&apos;s own pages; tools change quickly, so check its current documentation before you rely
          on a feature. The two IEEE standards are free as PDFs through the IEEE GET Program, courtesy of Accellera.
          The Arm links open the latest issue of each specification, while lessons cite a particular issue, so match
          the issue letter before following a section number.
        </p>
      </header>

      <ResourceLibrary groups={RESOURCE_GROUPS} resources={resolveResources()} />
    </div>
  );
}
