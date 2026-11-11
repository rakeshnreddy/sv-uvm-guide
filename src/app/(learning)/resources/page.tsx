import React from 'react';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { siteLabel } from '@/lib/nav-labels';
import { RESOURCE_GROUPS, VERIFIED_ON } from '@/lib/resources';
import { resolveResources } from '@/lib/resources-lessons';

import ResourceLibrary from './ResourceLibrary';

export const metadata: Metadata = {
  title: siteLabel('/resources'),
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
    <PageShell width="content">
      <PageHeader
        title={siteLabel('/resources')}
        lead="The standards, specifications and free tools the lessons rely on, grouped by what you need them for, with the lessons that use each one."
        meta={<span>Every link checked on {formatDate(VERIFIED_ON)}</span>}
      />
      <p className="mb-8 max-w-[30em] text-ui text-muted-foreground">
        Statements about what a tool supports come from that tool&apos;s own pages; tools change quickly, so check its
        current documentation before you rely on a feature. The two IEEE standards are free as PDFs through the IEEE GET
        Program, courtesy of Accellera. The Arm links open the latest issue of each specification, while lessons cite a
        particular issue, so match the issue letter before following a section number.
      </p>

      <ResourceLibrary groups={RESOURCE_GROUPS} resources={resolveResources()} />
    </PageShell>
  );
}
