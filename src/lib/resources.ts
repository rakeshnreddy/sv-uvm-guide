/**
 * The reference library at /resources: standards, AMBA specifications, free
 * tools and conformance data, each with what it is, what it supports, when to
 * reach for it and which lessons lean on it.
 *
 * Every URL here was opened on VERIFIED_ON (see
 * docs/curriculum-quality/reviews/6a-page-resources.author.md for how each one
 * was checked). Statements about a tool's support come from that tool's own
 * pages, not from memory. Add a resource only with a URL you have opened, and
 * keep `lessons` to lessons that actually use the resource.
 *
 * Plain data, client-safe: no curriculum imports. The page resolves `lessons`
 * (module codes or `<ModuleFolder>/<lesson>` refs) with resolveLessonRef.
 */

export const VERIFIED_ON = '2026-11-10';

export type ResourceGroupId = 'standards' | 'amba' | 'simulators' | 'python' | 'waveforms' | 'conformance';

export interface ResourceGroup {
  id: ResourceGroupId;
  title: string;
  /** One sentence: what this group is for. */
  purpose: string;
}

/** Groups in reading order, by what a learner needs the resource for. */
export const RESOURCE_GROUPS: readonly ResourceGroup[] = [
  {
    id: 'standards',
    title: 'Language and methodology standards',
    purpose: 'The normative definitions of SystemVerilog and UVM, and the reference UVM library the lessons quote.',
  },
  {
    id: 'amba',
    title: 'Arm AMBA protocol specifications',
    purpose: 'The bus protocols taught in the AMBA modules, from Arm, by document number.',
  },
  {
    id: 'simulators',
    title: 'Free simulators and online sandboxes',
    purpose: 'Where to run the lesson code without a commercial licence, and what each tool can and cannot run.',
  },
  {
    id: 'python',
    title: 'Python-based verification and generators',
    purpose: 'Testbench frameworks and stimulus generators outside SystemVerilog.',
  },
  {
    id: 'waveforms',
    title: 'Waveform viewers',
    purpose: 'Free viewers for the VCD and FST dumps that open-source simulators write.',
  },
  {
    id: 'conformance',
    title: 'Lint and tool conformance',
    purpose: 'Checking your style, and checking whether a tool supports a feature before you rely on it.',
  },
];

export type ResourceCost = 'free' | 'free-get-program' | 'free-account';

export const RESOURCE_COST_LABELS: Readonly<Record<ResourceCost, string>> = {
  free: 'Free',
  'free-get-program': 'Free PDF (IEEE GET Program)',
  'free-account': 'Free, sign-in to run',
};

export interface Resource {
  id: string;
  group: ResourceGroupId;
  name: string;
  /** Short identifier shown as a tag: a standard or document number, or the project kind. */
  tag: string;
  publisher: string;
  href: string;
  cost: ResourceCost;
  /** What it is, in one or two sentences. */
  summary: string;
  /** What it supports or contains, as short facts from the resource's own pages. */
  supports: readonly string[];
  /** When to reach for it. */
  whenToUse: string;
  /** Lessons that use it: module codes (`B-AXI-1`) or `<ModuleFolder>/<lesson>` refs. */
  lessons: readonly string[];
  /** Extra search words (aliases, abbreviations). */
  keywords?: readonly string[];
}

export const RESOURCES: readonly Resource[] = [
  // ---- Standards -----------------------------------------------------------
  {
    id: 'ieee-1800-2023',
    group: 'standards',
    name: 'IEEE 1800-2023: SystemVerilog',
    tag: 'IEEE 1800-2023',
    publisher: 'IEEE Standards Association',
    href: 'https://standards.ieee.org/ieee/1800/7743/',
    cost: 'free-get-program',
    summary:
      'The SystemVerilog language reference manual (LRM): unified hardware design, specification and verification language. Active standard, published 28 February 2024.',
    supports: [
      'Data types, procedural code, the scheduling regions, interfaces and clocking blocks',
      'Classes, constrained randomization, functional coverage and SystemVerilog Assertions',
      'DPI, compiler directives and the system tasks',
    ],
    whenToUse:
      'When a lesson cites a clause (§) and you want the exact rule, or when two simulators disagree and you need to know which one follows the standard. The IEEE page states the PDF is available at no cost through the IEEE GET Program, courtesy of Accellera; follow the GET Program link on that page.',
    lessons: ['F1C', 'F2B', 'F3B', 'I-SV-6', 'A-UVM-7'],
    keywords: ['LRM', 'SystemVerilog', 'GET Program', 'language reference manual'],
  },
  {
    id: 'ieee-1800-2-2020',
    group: 'standards',
    name: 'IEEE 1800.2-2020: Universal Verification Methodology',
    tag: 'IEEE 1800.2-2020',
    publisher: 'IEEE Standards Association',
    href: 'https://standards.ieee.org/ieee/1800.2/7567/',
    cost: 'free-get-program',
    summary:
      'The UVM language reference manual: the classes, phases, configuration database, factory, sequences and register layer that every UVM library must provide. Published 14 September 2020.',
    supports: [
      'The component hierarchy, phasing and objections',
      'TLM ports, the factory and the configuration database',
      'Sequences and sequencers, and the register layer (RAL)',
    ],
    whenToUse:
      'When you need what UVM promises, as opposed to what one library happens to do. The UVM lessons cite its clauses. The IEEE page states the PDF is available at no cost through the IEEE GET Program.',
    lessons: ['I-SV-9', 'I-UVM-1A', 'I-UVM-1C', 'A-UVM-4A', 'A-UVM-6'],
    keywords: ['UVM', 'LRM', 'GET Program'],
  },
  {
    id: 'uvm-core',
    group: 'standards',
    name: 'Accellera uvm-core',
    tag: 'GitHub',
    publisher: 'Accellera Systems Initiative',
    href: 'https://github.com/accellera-official/uvm-core',
    cost: 'free',
    summary:
      'The Accellera UVM reference implementation: the SystemVerilog class library that matches IEEE 1800.2-2020. Apache-2.0 licensed; tagged releases are on the repository’s releases page.',
    supports: [
      'The full source of the base classes, so you can read what a method really does',
      'A DEVIATIONS.md file listing where the implementation departs from 1800.2',
      'Plain-text release notes for each kit version',
    ],
    whenToUse:
      'When a lesson says “in uvm-core” and quotes behaviour the standard leaves open, or when you are debugging a UVM message and want to find where it is printed. Compile it with any simulator that supports UVM; most commercial simulators also ship their own build.',
    lessons: ['I-UVM-1C', 'I-UVM-3B', 'A-UVM-4B', 'I-UVM-6', 'E-CUST-1'],
    keywords: ['UVM library', 'reference implementation', 'source code', '2020.3'],
  },
  {
    id: 'accellera-uvm-downloads',
    group: 'standards',
    name: 'Accellera UVM downloads',
    tag: 'Downloads',
    publisher: 'Accellera Systems Initiative',
    href: 'https://www.accellera.org/downloads/standards/uvm',
    cost: 'free',
    summary:
      'Accellera’s download page for the UVM library kits: the current IEEE 1800.2 releases and earlier ones (UVM 1.2, UVM 1.1d and older), with their class references and user guides.',
    supports: [
      'Release tarballs of the 1800.2 library',
      'Pre-IEEE UVM 1.2 and 1.1 kits, for reading older testbenches',
    ],
    whenToUse:
      'When you inherit a testbench written for UVM 1.1d or 1.2 and need the matching library, or prefer a release tarball to a Git checkout.',
    lessons: ['I-SV-9', 'E-CUST-1'],
    keywords: ['UVM 1.2', 'UVM 1.1d', 'tarball'],
  },

  // ---- AMBA ----------------------------------------------------------------
  {
    id: 'arm-amba-index',
    group: 'amba',
    name: 'Arm AMBA specifications index',
    tag: 'arm.com',
    publisher: 'Arm',
    href: 'https://www.arm.com/architecture/system-architectures/amba/amba-specifications',
    cost: 'free',
    summary:
      'Arm’s list of every AMBA specification, AMBA 2 to AMBA 5, with a link to each document. It names CHI and AXI as the two key AMBA 5 protocols.',
    supports: ['AXI, AHB, APB, AXI-Stream, CHI and ACE, plus ATB, CXS and the low-power interfaces'],
    whenToUse: 'When you need a protocol not listed below, or want to see which AMBA generation a protocol belongs to.',
    lessons: ['B-AMBA-1'],
    keywords: ['AMBA 5', 'ATB', 'ACE'],
  },
  {
    id: 'arm-axi',
    group: 'amba',
    name: 'AMBA AXI Protocol Specification',
    tag: 'IHI 0022',
    publisher: 'Arm',
    href: 'https://developer.arm.com/documentation/ihi0022/latest/',
    cost: 'free',
    summary:
      'The AXI specification: the five channels, bursts, IDs and ordering, and exclusive accesses, with atomic accesses and the other AXI5 extensions in later issues. This link opens the latest issue.',
    supports: [
      'Issue E covers AXI3, AXI4 and AXI4-Lite, with ACE; later issues add AXI5',
      'Burst address arithmetic, response rules and the ordering model',
    ],
    whenToUse:
      'For any AXI question. The AXI lessons cite issue E (IHI 0022E) for the core rules; later issues add features and renumber some sections, so match the issue letter when you follow a lesson’s section reference.',
    lessons: ['B-AXI-1', 'B-AXI-2', 'B-AXI-3', 'B-AXI-4', 'B-AXI-5', 'B-AXI-6'],
    keywords: ['AXI4', 'AXI5', 'AXI-Lite', 'IHI0022'],
  },
  {
    id: 'arm-ahb',
    group: 'amba',
    name: 'AMBA AHB Protocol Specification',
    tag: 'IHI 0033',
    publisher: 'Arm',
    href: 'https://developer.arm.com/documentation/ihi0033/latest/',
    cost: 'free',
    summary:
      'The AHB specification: AHB5 and AHB-Lite pipelined transfers, HREADY wait states, bursts and responses. This link opens the latest issue.',
    supports: ['AHB5 and AHB-Lite', 'Address and data phase timing, bursts, and the two-cycle ERROR response'],
    whenToUse:
      'For any AHB question. The AHB lessons cite issues B.b (IHI 0033B.b) and C (IHI 0033C); check the issue letter before you follow a section number.',
    lessons: ['B-AHB-1', 'B-AHB-2', 'B-AHB-3', 'B-AMBA-F1'],
    keywords: ['AHB5', 'AHB-Lite', 'IHI0033'],
  },
  {
    id: 'arm-apb',
    group: 'amba',
    name: 'AMBA APB Protocol Specification',
    tag: 'IHI 0024',
    publisher: 'Arm',
    href: 'https://developer.arm.com/documentation/ihi0024/latest/',
    cost: 'free',
    summary:
      'The APB specification: the two-phase setup and access transfer, PREADY wait states, PSLVERR and the later protection and strobe signals. This link opens the latest issue.',
    supports: ['Write and read transfer timing, with and without wait states', 'Error response and the operating states (IDLE, SETUP, ACCESS)'],
    whenToUse:
      'When you build or check an APB agent or a register interface. The APB lessons cite issues C and E; check the issue letter before you follow a section number.',
    lessons: ['B-APB-1', 'A-UVM-7', 'A-UVM-4A'],
    keywords: ['APB4', 'APB5', 'IHI0024', 'register bus'],
  },
  {
    id: 'arm-axi-stream',
    group: 'amba',
    name: 'AMBA AXI-Stream Protocol Specification',
    tag: 'IHI 0051',
    publisher: 'Arm',
    href: 'https://developer.arm.com/documentation/ihi0051/latest/',
    cost: 'free',
    summary:
      'The AXI-Stream specification: a single unidirectional data channel with the TVALID/TREADY handshake, TLAST packet boundaries and optional sideband signals. This link opens the latest issue.',
    supports: ['AXI4-Stream and AXI5-Stream', 'Byte qualifiers (TKEEP, TSTRB) and routing signals (TID, TDEST)'],
    whenToUse:
      'For streaming interfaces such as DMA and video pipes. The lessons cite issue A (IHI 0051A).',
    lessons: ['B-AMBA-1', 'B-AMBA-2'],
    keywords: ['AXI4-Stream', 'AXIS', 'IHI0051', 'streaming'],
  },
  {
    id: 'arm-chi',
    group: 'amba',
    name: 'AMBA CHI Architecture Specification',
    tag: 'IHI 0050',
    publisher: 'Arm',
    href: 'https://developer.arm.com/documentation/ihi0050/latest',
    cost: 'free',
    summary:
      'The Coherent Hub Interface: the packet-based coherent interconnect architecture that Arm lists as superseding ACE. This link opens the latest issue.',
    supports: ['Request, response, snoop and data channels', 'Coherence states and transaction flows'],
    whenToUse:
      'Once you are comfortable with AXI ordering and want to see where coherent interconnects go next. The lessons cite issue E.b (IHI 0050E.b).',
    lessons: ['B-AMBA-F2', 'B-AMBA-1'],
    keywords: ['CHI', 'coherency', 'ACE', 'IHI0050'],
  },

  // ---- Simulators ----------------------------------------------------------
  {
    id: 'verilator',
    group: 'simulators',
    name: 'Verilator',
    tag: 'Simulator',
    publisher: 'Veripool',
    href: 'https://www.veripool.org/verilator/',
    cost: 'free',
    summary:
      'An open-source SystemVerilog simulator that compiles your design into C++ (or a ready-to-run binary with --binary) and lints it on the way. Licensed LGPL-3.0 or Artistic-2.0.',
    supports: [
      'Synthesizable SystemVerilog and, with --timing, delays, event controls, wait and all forms of fork',
      'Classes, assertions and covergroups, each listed as partly supported in its language guide',
      'Its project page says it supports most verification constructs, including UVM',
      'Mostly 2-state: X and Z checks that rely on 4-state values behave differently',
    ],
    whenToUse:
      'The fastest free way to run RTL and self-checking benches, and a strict linter (--lint-only -Wall). The lessons record when a file was compiled with Verilator 5.052 and say so when it rejects a 4-state construct; for those, use a 4-state simulator or an online sandbox. Read the language guide at verilator.org/guide/latest before relying on a verification feature.',
    lessons: ['F2A', 'F2A_Core_Data_Types/operators-and-expressions', 'I-SV-6', 'I-SV-7', 'E-PYUVM-1'],
    keywords: ['open source', 'lint', 'C++', 'two-state', '2-state'],
  },
  {
    id: 'verilator-guide',
    group: 'simulators',
    name: 'Verilator user guide: input languages',
    tag: 'Docs',
    publisher: 'Veripool',
    href: 'https://verilator.org/guide/latest/languages.html',
    cost: 'free',
    summary:
      'The page of the Verilator guide that lists, standard by standard, which SystemVerilog features Verilator accepts and where it differs from a 4-state simulator.',
    supports: ['Per-standard feature notes (2005, 2012, 2017, 2023)', 'Timing, class, assertion and coverage limitations'],
    whenToUse: 'Before you run a lesson’s verification example on Verilator, to see whether each construct it uses is supported.',
    lessons: ['F2A', 'I-SV-6'],
    keywords: ['limitations', 'language support', '--timing'],
  },
  {
    id: 'icarus',
    group: 'simulators',
    name: 'Icarus Verilog',
    tag: 'Simulator',
    publisher: 'Stephen Williams and contributors',
    href: 'https://steveicarus.github.io/iverilog/',
    cost: 'free',
    summary:
      'An open-source Verilog compiler and event-driven simulator (iverilog compiles, vvp runs). GPL-2.0 licensed; source at github.com/steveicarus/iverilog.',
    supports: [
      'Its README aims at all of IEEE 1364 Verilog',
      'A “slowly growing” subset of SystemVerilog (IEEE 1800), in its own words',
      'Waveform dumps for GTKWave and Surfer',
      'A supported simulator for cocotb',
    ],
    whenToUse:
      'For plain Verilog and small 4-state RTL experiments, and as the simulator under a cocotb or pyuvm bench. Not for class-based or UVM testbenches.',
    lessons: ['E-PYUVM-1'],
    keywords: ['iverilog', 'vvp', 'open source', 'Verilog-2005', '4-state'],
  },
  {
    id: 'eda-playground',
    group: 'simulators',
    name: 'EDA Playground',
    tag: 'Online sandbox',
    publisher: 'EDA Playground',
    href: 'https://www.edaplayground.com/',
    cost: 'free-account',
    summary:
      'A browser-based environment for running HDL code with a choice of simulators and libraries, plus the EPWave waveform viewer. You can type without an account, but running code needs a free sign-in.',
    supports: [
      'Open simulators (Icarus Verilog, Verilator, GHDL and others) after signing in with a Google account',
      'Commercial simulators for approved accounts, as its page explains',
      'UVM library options; on 10 November 2026 the menu listed UVM 1.1d, UVM 1.2 and UVM IEEE 1800.2-2017',
      'Python + SystemVerilog testbenches, SVUnit and other libraries',
    ],
    whenToUse:
      'When a lesson says “for example on EDA Playground”: the class-based and 4-state examples that open-source simulators reject run there on a commercial simulator. Check that the UVM version you pick matches the lesson, because 1800.2-2017 and 1800.2-2020 differ in places.',
    lessons: ['F2E', 'F2C', 'F3A', 'F4B', 'F4C', 'I-SV-1', 'I-SV-5'],
    keywords: ['online', 'browser', 'EPWave', 'sandbox', 'commercial simulator'],
  },

  // ---- Python and generators ----------------------------------------------
  {
    id: 'cocotb',
    group: 'python',
    name: 'cocotb',
    tag: 'Python framework',
    publisher: 'cocotb maintainers (a FOSSi Foundation project)',
    href: 'https://www.cocotb.org/',
    cost: 'free',
    summary:
      'An open-source, coroutine-based cosimulation testbench framework: you write the testbench in Python and the simulator runs the VHDL or SystemVerilog design. BSD licensed.',
    supports: [
      'Free simulators: Icarus Verilog, Verilator (5.036 or later), GHDL and NVC',
      'Commercial simulators including VCS, Questa, Xcelium and Riviera-PRO',
      'Documentation at docs.cocotb.org, including the simulator support table',
    ],
    whenToUse:
      'When you want Python’s libraries (models, file parsing, numerics) in the testbench, or a free flow for checking RTL without SystemVerilog classes. It is the base layer under pyuvm.',
    lessons: ['E-PYUVM-1', 'I-SV-9', 'F3B'],
    keywords: ['Python', 'coroutine', 'FOSSi'],
  },
  {
    id: 'cocotb-simulators',
    group: 'python',
    name: 'cocotb simulator support',
    tag: 'Docs',
    publisher: 'cocotb maintainers',
    href: 'https://docs.cocotb.org/en/stable/simulator_support.html',
    cost: 'free',
    summary: 'The cocotb documentation page listing every supported simulator, its minimum version and its known issues.',
    supports: ['Minimum versions (for example Icarus Verilog 11.0, Verilator 5.036)', 'Per-simulator caveats'],
    whenToUse: 'Before you pick a simulator for a cocotb or pyuvm bench.',
    lessons: ['E-PYUVM-1'],
    keywords: ['Icarus', 'Verilator', 'GHDL', 'NVC', 'minimum version'],
  },
  {
    id: 'pyuvm',
    group: 'python',
    name: 'pyuvm',
    tag: 'Python UVM',
    publisher: 'pyuvm project',
    href: 'https://github.com/pyuvm/pyuvm',
    cost: 'free',
    summary:
      'UVM written in Python on top of cocotb: it implements parts of IEEE 1800.2 with Python idioms. Apache-2.0 licensed; installing it with pip also installs cocotb.',
    supports: [
      'Components, the factory, TLM, the configuration database (ConfigDB) and the common phases',
      'Simplified sequences, sequencers and sequence items',
      'Register layer classes, with gaps its README lists (no memory class, incomplete backdoor access)',
      'Not implemented: custom phasing',
    ],
    whenToUse:
      'When you want UVM structure on a free simulator, or a team already writes Python. Read its README’s coverage table before porting a SystemVerilog UVM bench.',
    lessons: ['E-PYUVM-1', 'I-SV-9'],
    keywords: ['Python', 'UVM', 'cocotb', 'ConfigDB'],
  },
  {
    id: 'riscv-dv',
    group: 'python',
    name: 'riscv-dv',
    tag: 'Generator',
    publisher: 'CHIPS Alliance',
    href: 'https://github.com/chipsalliance/riscv-dv',
    cost: 'free',
    summary:
      'An open-source SystemVerilog/UVM random instruction generator for RISC-V processor verification, with Python run scripts. Apache-2.0 licensed.',
    supports: [
      'Needs a simulator with SystemVerilog and UVM 1.2 support; its README lists VCS, Xcelium, Questa and Riviera-PRO',
      'Compares the processor against instruction-set simulators: spike, riscv-ovpsim, whisper and sail-riscv',
    ],
    whenToUse:
      'When you verify a RISC-V core, or want a large real-world example of constrained-random stimulus written in UVM. It does not run on the free simulators listed above.',
    lessons: ['E-RISCV-1'],
    keywords: ['RISC-V', 'instruction generator', 'ISS', 'spike'],
  },

  // ---- Waveforms -----------------------------------------------------------
  {
    id: 'gtkwave',
    group: 'waveforms',
    name: 'GTKWave',
    tag: 'Viewer',
    publisher: 'GTKWave project',
    href: 'https://github.com/gtkwave/gtkwave',
    cost: 'free',
    summary: 'A long-standing open-source waveform viewer for Linux, macOS and Windows. GPL-2.0 licensed.',
    supports: ['VCD and EVCD, FST and GHW dump files'],
    whenToUse: 'To inspect the VCD or FST files that Icarus Verilog, Verilator or a cocotb run writes.',
    lessons: ['E-PYUVM-1'],
    keywords: ['VCD', 'FST', 'waveform'],
  },
  {
    id: 'surfer',
    group: 'waveforms',
    name: 'Surfer',
    tag: 'Viewer',
    publisher: 'Surfer project, Linköping University',
    href: 'https://surfer-project.org/',
    cost: 'free',
    summary:
      'An open-source, extensible waveform viewer. It also runs in the browser at app.surfer-project.org, which is slower and has fewer features than the installed version.',
    supports: ['A native application and a browser version', 'EUPL-1.2 licensed, with MIT and Apache options'],
    whenToUse: 'When you want a modern viewer, or to look at a dump on a machine where you cannot install anything.',
    lessons: ['E-PYUVM-1'],
    keywords: ['VCD', 'waveform', 'browser'],
  },

  // ---- Lint and conformance ------------------------------------------------
  {
    id: 'verible',
    group: 'conformance',
    name: 'Verible',
    tag: 'Lint and format',
    publisher: 'CHIPS Alliance',
    href: 'https://github.com/chipsalliance/verible',
    cost: 'free',
    summary:
      'SystemVerilog developer tools: a parser, a style linter, a formatter and a language server for editors. Apache-2.0 licensed.',
    supports: [
      'verible-verilog-lint, whose messages cite the rule they enforce',
      'verible-verilog-format for whitespace, indentation and line wrapping',
      'verible-verilog-ls for linting and formatting inside your editor',
    ],
    whenToUse:
      'To keep testbench code consistently formatted and catch style problems before review. It checks style, not simulation behaviour, so still compile with a simulator.',
    lessons: [],
    keywords: ['lint', 'formatter', 'language server', 'LSP', 'style'],
  },
  {
    id: 'sv-tests',
    group: 'conformance',
    name: 'sv-tests results',
    tag: 'Conformance',
    publisher: 'CHIPS Alliance',
    href: 'https://chipsalliance.github.io/sv-tests-results/',
    cost: 'free',
    summary:
      'A conformance report that runs one test suite, organised by LRM clause, through open-source SystemVerilog tools and shows which tests each tool passes. Source at github.com/chipsalliance/sv-tests.',
    supports: [
      'Per-clause pass counts for tools such as Verilator, Icarus Verilog, Slang, Surelog, Verible and Yosys',
      'Results for real designs and imported suites, including UVM',
    ],
    whenToUse:
      'Before you rely on a SystemVerilog feature in an open-source tool: look up the clause and see which tools pass it.',
    lessons: [],
    keywords: ['conformance', 'LRM', 'Slang', 'Surelog', 'support matrix'],
  },
];

/** Resources of one group, in table order. */
export function resourcesInGroup(group: ResourceGroupId): Resource[] {
  return RESOURCES.filter((resource) => resource.group === group);
}

/** Lower-case text a search box matches against: name, tag, publisher, summary, supports, use and keywords. */
export function resourceSearchText(resource: Resource): string {
  return [
    resource.name,
    resource.tag,
    resource.publisher,
    resource.summary,
    resource.whenToUse,
    RESOURCE_COST_LABELS[resource.cost],
    ...resource.supports,
    ...(resource.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

/** True when every whitespace-separated word of `query` appears in the resource's search text. */
export function matchesResourceQuery(resource: Resource, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = resourceSearchText(resource);
  return words.every((word) => text.includes(word));
}
