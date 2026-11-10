/**
 * Data for /history: a verified timeline of the languages and methodologies
 * this course teaches. Every event cites at least one source in HISTORY_SOURCES,
 * and every date was checked against that source (see
 * docs/curriculum-quality/reviews/6a-page-history.author.md). Anything that
 * could not be checked against an official page, a standard's own text or the
 * original announcement was left out.
 */

export type HistoryLane = "language" | "methodology";

/** Who published the milestone. Shown as a text tag and a marker shape, never by colour alone. */
export type HistoryKind = "ieee" | "accellera" | "vendor";

export interface HistorySource {
  id: string;
  /** Who published it and what it is, as a reader would cite it. */
  label: string;
  /** Omitted for the IEEE standards, which are read from the standard's own text. */
  url?: string;
}

export interface HistoryEvent {
  id: string;
  /** ISO date (YYYY-MM-DD) or month (YYYY-MM) or year (YYYY), for <time dateTime>. */
  date: string;
  /** The date as shown to the reader. */
  dateLabel: string;
  lane: HistoryLane;
  kind: HistoryKind;
  title: string;
  /** What happened. */
  what: string;
  /** Why it happened: the problem this step solved. */
  why: string;
  /** Ids from HISTORY_SOURCES. */
  sources: string[];
}

export interface HistoryEra {
  id: string;
  label: string;
  years: string;
  /** Event ids, in date order. */
  events: string[];
}

export const LANE_LABELS: Record<HistoryLane, string> = {
  language: "Language",
  methodology: "Methodology",
};

export const KIND_LABELS: Record<HistoryKind, string> = {
  ieee: "IEEE standard",
  accellera: "Accellera",
  vendor: "Vendor release",
};

export const HISTORY_SOURCES: HistorySource[] = [
  {
    id: "ieee-1364-1995",
    label: "IEEE SA, IEEE 1364-1995 standard page (board approval 1995-12-12, published 1996-10-14)",
    url: "https://standards.ieee.org/standard/1364-1995.html",
  },
  {
    id: "ieee-1364-2001",
    label: "IEEE SA, IEEE 1364-2001 standard page (board approval 2001-03-17, published 2001-09-28)",
    url: "https://standards.ieee.org/ieee/1364/2052/",
  },
  {
    id: "ieee-1364-2005",
    label: "IEEE SA, IEEE 1364-2005 standard page (board approval 2005-11-08, published 2006-04-07, superseded by IEEE 1800-2009)",
    url: "https://standards.ieee.org/standard/1364-2005.html",
  },
  {
    id: "accellera-sv30-vote",
    label: "Accellera vlog-pp mailing list archive, “SystemVerilog 3.0 is Officially An Accellera Standard”, 3 June 2002",
    url: "https://accellera.org/images/eda/vlog-pp/0678.html",
  },
  {
    id: "accellera-sv30-donations",
    label: "Accellera news release on the SystemVerilog 3.0 donations, as published by Electronicstalk, 4 July 2002",
    url: "https://old.electronicstalk.com/news/acc/acc104.html",
  },
  {
    id: "synopsys-sv31-donation",
    label: "Synopsys, “Synopsys Donates Key Verification Technologies to Accellera's SystemVerilog 3.1 Standard”, 11 June 2002 (Accellera archive copy)",
    url: "https://accellera.org/images/eda/vlog-pp/0708.html",
  },
  {
    id: "accellera-sv31-approved",
    label: "Accellera sv-bc mailing list archive, “SystemVerilog 3.1 Is An Accellera Standard”, 29 May 2003",
    url: "https://accellera.org/images/eda/sv-bc/0860.html",
  },
  {
    id: "ieee-1800-2005-approval",
    label: "Accellera sv-bc mailing list archive, IEEE-SA P1800 approval notification, 8 November 2005",
    url: "https://www.accellera.org/images/eda/sv-bc/3419.html",
  },
  {
    id: "ieee-1800-2009",
    label: "IEEE SA, IEEE 1800-2009 standard page (board approval 2009-11-09, published 2009-12-11)",
    url: "https://standards.ieee.org/ieee/1800/3989/",
  },
  {
    id: "ieee-1800-2012-approval",
    label: "Accellera sv-ec mailing list archive, “Congratulations - P1800 is approved”, 5 December 2012",
    url: "https://accellera.org/images/eda/sv-ec/8431.html",
  },
  {
    id: "ieee-1800-2017",
    label: "IEEE SA, IEEE 1800-2017 standard page (board approval 2017-12-06, published 2018-02-22)",
    url: "https://standards.ieee.org/ieee/1800/6700/",
  },
  {
    id: "ieee-1800-2023",
    label: "IEEE SA, IEEE 1800-2023 standard page (board approval 2023-12-06, published 2024-02-28)",
    url: "https://standards.ieee.org/ieee/1800/7743/",
  },
  {
    id: "lrm-1800-2023",
    label: "IEEE Std 1800-2023, Introduction, §1.2, §1.3 (NOTE on the 2009 merger), §1.4, §22.14 (Tables 22-1 to 22-6) and Annex C.2.8",
  },
  {
    id: "ieee-1647-2006",
    label: "IEEE news release, “IEEE Ratifies First Open 'e' Language Standard”, 5 April 2006 (Design & Reuse copy)",
    url: "https://design-reuse.com/news/13013/ieee-ratifies-open-e-language-standard-verifying-complex-system-chip-designs.html",
  },
  {
    id: "vmm-book",
    label: "Springer news release, “Springer Publishes ARM-Synopsys Verification Methodology Manual for SystemVerilog”, 21 September 2005 (Design & Reuse copy)",
    url: "https://www.design-reuse.com/news/11413/springer-publishes-arm-synopsys-verification-methodology-manual-systemverilog.html",
  },
  {
    id: "vmm-doi",
    label: "Crossref record for DOI 10.1007/b135575, Verification Methodology Manual for SystemVerilog (Springer, 2006)",
    url: "https://doi.org/10.1007/b135575",
  },
  {
    id: "mentor-avm",
    label: "Mentor Graphics news release, “Mentor Graphics Delivers the Next Generation of Functional Verification”, 8 May 2006 (Design & Reuse copy)",
    url: "https://www.design-reuse.com/news/13294/mentor-graphics-generation-functional-verification.html",
  },
  {
    id: "ovm-launch",
    label: "Cadence and Mentor Graphics news release, “Cadence and Mentor Announce Immediate Availability of the Open Verification Methodology”, 9 January 2008 (Design & Reuse copy)",
    url: "https://design-reuse.com/news/17416/open-verification-methodology-ovm.html",
  },
  {
    id: "uvm-10",
    label: "Accellera news release, “Accellera Approves Universal Verification Methodology (UVM) Standard”, 21 February 2011 (Design & Reuse copy)",
    url: "https://www.design-reuse.com/news/25729/accellera-uvm-standard.html",
  },
  {
    id: "accellera-uvm-downloads",
    label: "Accellera, UVM downloads page (class references, library releases 2020-1.0 to 2020-3.2 and their dates)",
    url: "https://www.accellera.org/downloads/standards/uvm",
  },
  {
    id: "uvm-12",
    label: "Accellera Community Newsletter, July 2014 (UVM 1.2 release of 24 June 2014 and its public review)",
    url: "https://accellera.org/news/newsletters/2014-july",
  },
  {
    id: "ieee-1800-2-2017",
    label: "IEEE SA, IEEE 1800.2-2017 standard page (board approval 2017-02-14, published 2017-05-26)",
    url: "https://standards.ieee.org/ieee/1800.2/6021/",
  },
  {
    id: "accellera-1800-2-press",
    label: "Accellera news release, “IEEE 1800.2 for UVM Approved as an IEEE Standard”, 11 April 2017",
    url: "https://accellera.org/news/press-releases/239-ieee-1800-2-for-uvm-approved-as-an-ieee-standard",
  },
  {
    id: "ieee-1800-2-2020",
    label: "IEEE SA, IEEE 1800.2-2020 standard page (board approval 2020-06-04, published 2020-09-14)",
    url: "https://standards.ieee.org/ieee/1800.2/7567/",
  },
  {
    id: "lrm-1800-2-2020",
    label: "IEEE Std 1800.2-2020, Introduction",
  },
  {
    id: "uvm-core-github",
    label: "Accellera, uvm-core repository releases on GitHub (tags 2020-2.0, 2020.3.0 and 2020.3.1; GitHub release dates can differ from the downloads page)",
    url: "https://github.com/accellera-official/uvm-core/releases",
  },
];

export const HISTORY_EVENTS: HistoryEvent[] = [
  {
    id: "ieee-1364-1995",
    date: "1995-12-12",
    dateLabel: "12 Dec 1995",
    lane: "language",
    kind: "ieee",
    title: "IEEE 1364-1995: Verilog becomes an IEEE standard",
    what: "The IEEE SA Standards Board approved IEEE 1364-1995, a standard hardware description language based on Verilog. It was published in October 1996.",
    why: "A vendor-neutral IEEE text gives every simulator and synthesis tool the same syntax and semantics to implement, so the same source means the same thing in every tool.",
    sources: ["ieee-1364-1995"],
  },
  {
    id: "ieee-1364-2001",
    date: "2001-03-17",
    dateLabel: "17 Mar 2001",
    lane: "language",
    kind: "ieee",
    title: "IEEE 1364-2001: Verilog grows up for large designs",
    what: "The second edition replaced 1364-1995. Among its new reserved words are generate, genvar, localparam, signed, unsigned and automatic, plus config and library for configurations.",
    why: "Generate blocks replace hand-copied structure, signed declarations make signed vector arithmetic explicit, and configurations choose which source each instance uses, so one source can describe many design variants.",
    sources: ["ieee-1364-2001", "lrm-1800-2023"],
  },
  {
    id: "accellera-sv30",
    date: "2002-06-03",
    dateLabel: "3 Jun 2002",
    lane: "language",
    kind: "accellera",
    title: "Accellera SystemVerilog 3.0",
    what: "Accellera's board vote made SystemVerilog 3.0 an Accellera standard. Co-Design Automation donated its Superlog Extended Synthesisable Subset (ESS), and Co-Design and Real Intent donated the Superlog Design Assertion Subset (DAS).",
    why: "IEEE 1800 describes SystemVerilog as providing the capabilities lacking in the languages designers already used. Building them on top of Verilog, as an industry standard, kept existing Verilog code and skills usable.",
    sources: ["accellera-sv30-vote", "accellera-sv30-donations"],
  },
  {
    id: "synopsys-openvera-donation",
    date: "2002-06-11",
    dateLabel: "11 Jun 2002",
    lane: "language",
    kind: "vendor",
    title: "Synopsys donates OpenVera technology for SystemVerilog 3.1",
    what: "Synopsys donated OpenVera testbench constructs (classes, mailboxes and other testbench primitives), OpenVera Assertions, a C/C++ model interface and a coverage API to Accellera for SystemVerilog 3.1.",
    why: "The donation was meant to let engineers develop testbenches within the Verilog language itself. Folding testbench, assertion, C-interface and coverage features into SystemVerilog put design and verification in one language.",
    sources: ["synopsys-sv31-donation"],
  },
  {
    id: "accellera-sv31",
    date: "2003-05-29",
    dateLabel: "29 May 2003",
    lane: "language",
    kind: "accellera",
    title: "Accellera board approves SystemVerilog 3.1",
    what: "The Accellera board approved SystemVerilog 3.1, the release that added the donated testbench and verification features.",
    why: "A board-approved specification gave tool vendors a common target for the new verification features, instead of each vendor's own extensions.",
    sources: ["accellera-sv31-approved"],
  },
  {
    id: "accellera-sv31a",
    date: "2004",
    dateLabel: "2004",
    lane: "language",
    kind: "accellera",
    title: "Accellera SystemVerilog 3.1a",
    what: "Accellera published the SystemVerilog 3.1a Language Reference Manual. IEEE 1800 names it as the base of the IEEE standard and as the precursor to IEEE 1800-2005.",
    why: "IEEE 1800 is based on the 3.1a extensions, so 3.1a is where the official standard starts.",
    sources: ["lrm-1800-2023"],
  },
  {
    id: "vmm",
    date: "2005-09-21",
    dateLabel: "21 Sep 2005",
    lane: "methodology",
    kind: "vendor",
    title: "VMM: the Verification Methodology Manual for SystemVerilog",
    what: "Springer announced the ARM and Synopsys Verification Methodology Manual for SystemVerilog, written by two verification engineers from each company. Its Springer record is dated 2006.",
    why: "SystemVerilog gave teams the language features, but not a shared way to use them. The manual described constrained-random stimulus, coverage-driven closure and a standard library of assertions and verification functions.",
    sources: ["vmm-book", "vmm-doi"],
  },
  {
    id: "ieee-2005",
    date: "2005-11-08",
    dateLabel: "8 Nov 2005",
    lane: "language",
    kind: "ieee",
    title: "IEEE 1800-2005 and IEEE 1364-2005",
    what: "On the same day the IEEE SA Standards Board approved the first SystemVerilog standard, IEEE 1800-2005, and the third Verilog edition, IEEE 1364-2005. IEEE 1800-2005 held only the extensions and relied on IEEE 1364-2005 for the base language.",
    why: "Moving SystemVerilog from Accellera to the IEEE gave it the same formal standing and change control as Verilog, while Verilog itself stayed a separate, self-contained standard.",
    sources: ["ieee-1800-2005-approval", "ieee-1364-2005", "lrm-1800-2023"],
  },
  {
    id: "ieee-1647",
    date: "2006-04-05",
    dateLabel: "5 Apr 2006",
    lane: "language",
    kind: "ieee",
    title: "IEEE 1647: the e verification language is standardized",
    what: "The IEEE announced IEEE 1647, the Standard for the Functional Verification Language 'e'. Verisity, which pioneered e, contributed the technology base.",
    why: "e was a separate verification language used beside Verilog and VHDL designs. An open IEEE specification let more than one vendor implement it. Its reuse methodology, eRM, later fed concepts into OVM and UVM.",
    sources: ["ieee-1647-2006", "lrm-1800-2-2020"],
  },
  {
    id: "avm",
    date: "2006-05-08",
    dateLabel: "8 May 2006",
    lane: "methodology",
    kind: "vendor",
    title: "Mentor Graphics announces AVM",
    what: "Mentor Graphics announced the Advanced Verification Methodology: a transaction-level modeling (TLM) based framework implemented in both SystemC and SystemVerilog, with code and documentation under the Apache 2.0 open-source license.",
    why: "An open-source library let teams share testbench components that talk through standard transaction-level interfaces, instead of building that infrastructure in every project.",
    sources: ["mentor-avm"],
  },
  {
    id: "ovm",
    date: "2008-01-09",
    dateLabel: "9 Jan 2008",
    lane: "methodology",
    kind: "vendor",
    title: "Cadence and Mentor release OVM",
    what: "Cadence and Mentor Graphics announced the Open Verification Methodology, based on IEEE 1800-2005 SystemVerilog, under the Apache 2.0 license and backward compatible with Mentor's AVM and Cadence's URM.",
    why: "AVM and Cadence's URM were separate libraries. One joint library, running on both companies' simulators, let a single set of reusable verification components serve users of either.",
    sources: ["ovm-launch", "lrm-1800-2-2020"],
  },
  {
    id: "ieee-1800-2009",
    date: "2009-11-09",
    dateLabel: "9 Nov 2009",
    lane: "language",
    kind: "ieee",
    title: "IEEE 1800-2009: Verilog and SystemVerilog merge",
    what: "IEEE 1800-2009 merged IEEE 1364-2005 and IEEE 1800-2005 into one document, and IEEE 1364-2005 was superseded by it. New reserved words include checker, let, global, unique0 and the strong and weak temporal operators.",
    why: "Users had to read two standards that were designed to be used as one language. The merger put all syntax and semantics in a single document.",
    sources: ["ieee-1800-2009", "ieee-1364-2005", "lrm-1800-2023"],
  },
  {
    id: "uvm-10",
    date: "2011-02-21",
    dateLabel: "21 Feb 2011",
    lane: "methodology",
    kind: "accellera",
    title: "Accellera UVM 1.0",
    what: "Accellera approved UVM 1.0. Its early adopter release was a direct derivative of OVM, and the 1.0 release added a phasing mechanism, a register package derived from VMM technology, and TLM-2.0 support. It shipped with an open-source base class library and a user guide.",
    why: "Verification IP written for one methodology did not plug into another. One industry methodology aimed at portable verification data and interoperable VIP across tools and companies.",
    sources: ["uvm-10", "accellera-uvm-downloads"],
  },
  {
    id: "uvm-11",
    date: "2011-06",
    dateLabel: "Jun 2011",
    lane: "methodology",
    kind: "accellera",
    title: "Accellera UVM 1.1",
    what: "Accellera released the UVM 1.1 class reference. Library updates 1.1a to 1.1d followed, with 1.1d listed in March 2013.",
    why: "A methodology is only as usable as its library. The 1.1 line, with its point releases, was the maintained base for UVM users until 1.2 arrived in 2014.",
    sources: ["accellera-uvm-downloads"],
  },
  {
    id: "ieee-1800-2012",
    date: "2012-12-05",
    dateLabel: "5 Dec 2012",
    lane: "language",
    kind: "ieee",
    title: "IEEE 1800-2012",
    what: "The IEEE SA Standards Board approved the P1800 revision that became IEEE 1800-2012. New reserved words are implements, interconnect, nettype and soft.",
    why: "The new keywords show what this edition added: interface classes (implements), soft constraints, user-defined net types (nettype) and generic interconnect.",
    sources: ["ieee-1800-2012-approval", "lrm-1800-2023"],
  },
  {
    id: "uvm-12",
    date: "2014-06-24",
    dateLabel: "24 Jun 2014",
    lane: "methodology",
    kind: "accellera",
    title: "Accellera UVM 1.2",
    what: "Accellera released the UVM 1.2 class reference, with enhanced messaging and register-layer improvements, and opened a public review that ran to 1 October 2014.",
    why: "Accellera committed to take the reviewed UVM 1.2 to the IEEE, so the methodology would get a formal standard like the language beneath it.",
    sources: ["uvm-12", "accellera-uvm-downloads"],
  },
  {
    id: "ieee-1800-2-2017",
    date: "2017-02-14",
    dateLabel: "14 Feb 2017",
    lane: "methodology",
    kind: "ieee",
    title: "IEEE 1800.2-2017: UVM becomes an IEEE standard",
    what: "The IEEE SA Standards Board approved IEEE 1800.2-2017, developed from UVM 1.2, which Accellera transferred to the IEEE. Responsibility for the UVM Language Reference Manual moved to the IEEE, while Accellera kept improving the base class library and user guide.",
    why: "UVM became the first verification methodology to be standardized. The IEEE 1800.2 introduction gives the reason: multiple, incompatible methodologies across internal and external teams limit productivity.",
    sources: ["ieee-1800-2-2017", "accellera-1800-2-press", "lrm-1800-2-2020"],
  },
  {
    id: "ieee-1800-2017",
    date: "2017-12-06",
    dateLabel: "6 Dec 2017",
    lane: "language",
    kind: "ieee",
    title: "IEEE 1800-2017",
    what: "The IEEE SA Standards Board approved IEEE 1800-2017, which superseded IEEE 1800-2012. It added no new reserved words.",
    why: "A revision can change the standard without changing its keyword set. IEEE 1800-2017 added no reserved words (§22.14.9), so code written for IEEE 1800-2012 kept the same reserved words, and it deprecated the operator overloading construct carried in IEEE 1800-2012 (Annex C.2.8).",
    sources: ["ieee-1800-2017", "lrm-1800-2023"],
  },
  {
    id: "ieee-1800-2-2020",
    date: "2020-06-04",
    dateLabel: "4 Jun 2020",
    lane: "methodology",
    kind: "ieee",
    title: "IEEE 1800.2-2020",
    what: "The IEEE SA Standards Board approved IEEE 1800.2-2020, which superseded IEEE 1800.2-2017. It was published in September 2020.",
    why: "The methodology is now maintained the same way as the language: through revisions under IEEE change control, with the earlier edition superseded.",
    sources: ["ieee-1800-2-2020"],
  },
  {
    id: "uvm-core-2020",
    date: "2020-12",
    dateLabel: "Dec 2020 onward",
    lane: "methodology",
    kind: "accellera",
    title: "Accellera's UVM 2020 library (uvm-core)",
    what: "Accellera's UVM downloads page lists the UVM 2020 reference implementation releases for IEEE 1800.2: 2020-1.0 (2020-12), 2020-1.1 (2021-02), 2020-2.0 (2023-02), 2020-3.0 (2024-02), 2020-3.1 (2024-08) and 2020-3.2 (2026-08). Releases are also published in the accellera-official/uvm-core repository on GitHub, whose dates can differ from the downloads page: GitHub shows 2020-2.0 in July 2023, for example.",
    why: "The IEEE standard defines the API; a testbench needs working code. Accellera's open-source library is the implementation that tracks the standard.",
    sources: ["accellera-uvm-downloads", "uvm-core-github"],
  },
  {
    id: "ieee-1800-2023",
    date: "2023-12-06",
    dateLabel: "6 Dec 2023",
    lane: "language",
    kind: "ieee",
    title: "IEEE 1800-2023",
    what: "The IEEE SA Standards Board approved IEEE 1800-2023, which superseded IEEE 1800-2017 and was published in February 2024. It also adds no new reserved words. This is the edition this course cites.",
    why: "Its stated purpose is to correct errors, clarify the 2017 text, and add features that ease design, improve verification and enhance cross-language interactions.",
    sources: ["ieee-1800-2023", "lrm-1800-2023"],
  },
];

export const HISTORY_ERAS: HistoryEra[] = [
  {
    id: "verilog-standard",
    label: "Verilog becomes a standard",
    years: "1995 to 2001",
    events: ["ieee-1364-1995", "ieee-1364-2001"],
  },
  {
    id: "accellera-systemverilog",
    label: "Accellera builds SystemVerilog",
    years: "2002 to 2004",
    events: ["accellera-sv30", "synopsys-openvera-donation", "accellera-sv31", "accellera-sv31a"],
  },
  {
    id: "standards-and-methodologies",
    label: "IEEE standards and competing methodologies",
    years: "2005 to 2008",
    events: ["vmm", "ieee-2005", "ieee-1647", "avm", "ovm"],
  },
  {
    id: "one-language-one-methodology",
    label: "One language, one methodology",
    years: "2009 to 2014",
    events: ["ieee-1800-2009", "uvm-10", "uvm-11", "ieee-1800-2012", "uvm-12"],
  },
  {
    id: "ieee-maintenance",
    label: "Both under IEEE maintenance",
    years: "2017 to today",
    events: ["ieee-1800-2-2017", "ieee-1800-2017", "ieee-1800-2-2020", "uvm-core-2020", "ieee-1800-2023"],
  },
];

/** Reserved words each edition added, from IEEE 1800-2023 §22.14 (Tables 22-2 to 22-6). */
export interface KeywordEdition {
  edition: string;
  table: string;
  /** A representative selection, not the whole table (except where the table is short). */
  examples: string[];
  complete: boolean;
  takeaway: string;
}

export const KEYWORD_EDITIONS: KeywordEdition[] = [
  {
    edition: "IEEE 1364-2001",
    table: "Table 22-2",
    examples: ["generate", "genvar", "localparam", "signed", "unsigned", "automatic", "config", "library"],
    complete: false,
    takeaway: "Parameterized structure, signed arithmetic and configurations.",
  },
  {
    edition: "IEEE 1364-2005",
    table: "Table 22-3",
    examples: ["uwire"],
    complete: true,
    takeaway: "A single-driver net type; otherwise a clarification release.",
  },
  {
    edition: "IEEE 1800-2005",
    table: "Table 22-4",
    examples: ["class", "rand", "constraint", "covergroup", "interface", "clocking", "program", "property", "assert", "always_ff"],
    complete: false,
    takeaway: "The verification language: classes, randomization, coverage, interfaces and assertions.",
  },
  {
    edition: "IEEE 1800-2009",
    table: "Table 22-5",
    examples: ["checker", "let", "global", "unique0", "until", "s_eventually", "strong", "weak"],
    complete: false,
    takeaway: "Richer assertions and checkers, in the merged standard.",
  },
  {
    edition: "IEEE 1800-2012",
    table: "Table 22-6",
    examples: ["implements", "interconnect", "nettype", "soft"],
    complete: true,
    takeaway: "Interface classes, soft constraints and user-defined nets.",
  },
  {
    edition: "IEEE 1800-2017 and 1800-2023",
    table: "§22.14.9",
    examples: [],
    complete: true,
    takeaway: "No new reserved words: clarifications and features within the existing keyword set.",
  },
];

export function historySourceById(id: string): HistorySource | undefined {
  return HISTORY_SOURCES.find((source) => source.id === id);
}

export function historyEventById(id: string): HistoryEvent | undefined {
  return HISTORY_EVENTS.find((event) => event.id === id);
}

/** 1-based reference number of a source, in HISTORY_SOURCES order. */
export function sourceNumber(id: string): number {
  return HISTORY_SOURCES.findIndex((source) => source.id === id) + 1;
}
