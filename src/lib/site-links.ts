/**
 * The one source for the site's name, its navigation and its entry points
 * (SPEC-phases-2-4.md, "One source for names and links"). The navbar, phone
 * menu, public header, footer, breadcrumbs and page titles read it; no
 * component types a destination's label or href by hand.
 *
 * Plain constants, safe to import from client components. The tier titles come
 * from the curriculum manifest, which the course outline already ships to the
 * browser. src/lib/learning-paths.ts re-exports some of the entry points.
 */
import manifest from "../../content/curriculum/curriculum.manifest.json";

// ---------------------------------------------------------------------------
// Name and titles
// ---------------------------------------------------------------------------

export const SITE_NAME = "SV/UVM Hub";

/** The default document title. */
export const SITE_TITLE_DEFAULT = "SV/UVM Hub: SystemVerilog, UVM and AMBA verification";

/** The title template for every page below the landing page. */
export const SITE_TITLE_TEMPLATE = "%s | SV/UVM Hub";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  children: NavLink[];
}

export type NavItem = NavLink | NavGroup;

export function isNavGroup(item: NavItem): item is NavGroup {
  return Array.isArray((item as NavGroup).children);
}

/** The labels of the five top-level items, which activeNavLabel returns. */
export type PrimaryNavLabel = "Curriculum" | "Practice" | "Interview prep" | "Reference" | "Dashboard";

// ---------------------------------------------------------------------------
// Section anchors
// ---------------------------------------------------------------------------

/**
 * The section ids on /practice. PracticeHub (src/components/practice/PracticeHub.tsx)
 * reads them from here (through practiceSectionLink in src/lib/practice-links.ts)
 * and sets them on its section headings, so "/practice#interactive-models" lands
 * on "Interactive models". The diagrams, charts and tools sections render only
 * while they have items (they all do today).
 */
export const PRACTICE_SECTION_ID = {
  labs: "labs",
  exercises: "exercises",
  interactiveModels: "interactive-models",
  diagrams: "diagrams",
  charts: "charts",
  tools: "tools",
  interviewPrep: "interview-prep",
} as const;

export type PracticeSection = keyof typeof PRACTICE_SECTION_ID;

export const PRACTICE_HREF = "/practice";

/** "/practice#labs" and the rest, one per section of the Practice hub. */
export const PRACTICE_SECTION_HREF: { readonly [K in PracticeSection]: `/practice#${(typeof PRACTICE_SECTION_ID)[K]}` } = {
  labs: `/practice#${PRACTICE_SECTION_ID.labs}`,
  exercises: `/practice#${PRACTICE_SECTION_ID.exercises}`,
  interactiveModels: `/practice#${PRACTICE_SECTION_ID.interactiveModels}`,
  diagrams: `/practice#${PRACTICE_SECTION_ID.diagrams}`,
  charts: `/practice#${PRACTICE_SECTION_ID.charts}`,
  tools: `/practice#${PRACTICE_SECTION_ID.tools}`,
  interviewPrep: `/practice#${PRACTICE_SECTION_ID.interviewPrep}`,
};

export const CURRICULUM_HREF = "/curriculum";

/**
 * "T3_Advanced" -> "t3": the id of a tier's section on /curriculum. TierSection
 * renders it today (via tierAnchor in src/lib/curriculum-overview.ts, which
 * this matches), and the expert index uses the same ids.
 */
export function tierSectionId(tierId: string): string {
  const match = /^T(\d+)/i.exec(tierId);
  return match ? `t${match[1]}` : tierId.toLowerCase();
}

/** The same function under the name the build spec uses. */
export const TIER_SECTION_ID = tierSectionId;

/** "T3_Advanced" -> "/curriculum#t3". */
export function tierSectionHref(tierId: string): string {
  return `${CURRICULUM_HREF}#${tierSectionId(tierId)}`;
}

// ---------------------------------------------------------------------------
// Entry points (existing exports, kept for their importers)
// ---------------------------------------------------------------------------

/** The route chooser on the curriculum overview: Junior, Practitioner and Expert (G30-PATH-07, G30-SIDE-05). */
export const START_HERE_HREF = "/curriculum#routes";

/** The labs section of the Practice Hub. */
export const LABS_HREF = PRACTICE_SECTION_HREF.labs;

/** The interview question banks (G30-PRAC-07). */
export const INTERVIEW_PREP_HREF = "/interview-prep";

/** One interview bank's own page: `/interview-prep/<slug>`, the slug being the bank file's name. */
export function interviewBankHref(slug: string): string {
  return `${INTERVIEW_PREP_HREF}/${slug}`;
}

/** The placement quiz, "Find your level". */
export const PLACEMENT_QUIZ_HREF = "/quiz/placement";

/** Every "Expert:" topic across the lessons. */
export const EXPERT_INDEX_HREF = "/curriculum/expert-index";

export const WAVEFORM_STUDIO_HREF = "/practice/waveform-studio";
export const DASHBOARD_HREF = "/dashboard";
export const REVIEW_HREF = "/dashboard/review";
export const NOTEBOOK_HREF = "/dashboard/notebook";
export const SELF_ASSESSMENT_HREF = "/assessment";
export const SETTINGS_HREF = "/settings";
export const PRIVACY_POLICY_HREF = "/privacy-policy";
export const TERMS_OF_SERVICE_HREF = "/terms-of-service";

// ---------------------------------------------------------------------------
// Links (one label per destination)
// ---------------------------------------------------------------------------

const curriculum: NavLink = { label: "Curriculum", href: CURRICULUM_HREF };
const practiceHub: NavLink = { label: "Practice hub", href: PRACTICE_HREF };
/** The practice hub as a link, for text that names it (for example an error message). */
export const PRACTICE_HUB_LINK: NavLink = practiceHub;
const labs: NavLink = { label: "Labs", href: PRACTICE_SECTION_HREF.labs };
const exercises: NavLink = { label: "Exercises", href: PRACTICE_SECTION_HREF.exercises };
const interactiveModels: NavLink = { label: "Interactive models", href: PRACTICE_SECTION_HREF.interactiveModels };
const waveformStudio: NavLink = { label: "Waveform studio", href: WAVEFORM_STUDIO_HREF };
const interviewPrep: NavLink = { label: "Interview prep", href: INTERVIEW_PREP_HREF };
const knowledgeHub: NavLink = { label: "Knowledge hub", href: "/knowledge-hub" };
const resources: NavLink = { label: "Resources", href: "/resources" };
const projects: NavLink = { label: "Projects", href: "/projects" };
const learningStrategies: NavLink = { label: "Learning strategies", href: "/learning-strategies" };
const history: NavLink = { label: "History", href: "/history" };
const dashboard: NavLink = { label: "Dashboard", href: DASHBOARD_HREF };

/** The five Reference pages, in menu order. */
export const REFERENCE_LINKS: readonly NavLink[] = [knowledgeHub, resources, projects, learningStrategies, history];

/**
 * The routes a link to a part of /practice stands for: on /practice/lab/<id>
 * the Practice menu marks "Labs", on /exercises/<id> "Exercises", and so on.
 * A link not listed here stands only for its own href (Waveform studio).
 */
export const NAV_SECTION_ROUTES: Readonly<Record<string, readonly string[]>> = {
  [labs.href]: ["/practice/lab"],
  [exercises.href]: ["/exercises"],
  [interactiveModels.href]: ["/practice/visualizations", "/visualizations"],
};

/** The learning area's top navigation. "Start here" is not in it: the route chooser is on /curriculum and the landing page. */
export const PRIMARY_NAV: readonly NavItem[] = [
  curriculum,
  { label: "Practice", children: [practiceHub, labs, exercises, interactiveModels, waveformStudio] },
  interviewPrep,
  { label: "Reference", children: [...REFERENCE_LINKS] },
  dashboard,
];

/** The public header's three plain links (landing page, privacy, terms). */
export const PUBLIC_NAV: readonly NavLink[] = [curriculum, { label: "Practice", href: PRACTICE_HREF }, interviewPrep];

interface ManifestTierEntry {
  id: string;
  title: string;
}

/** Tier 1 to Tier 4, with their manifest titles ("Tier 1: Foundations"), linking to their sections of /curriculum. */
export const TIER_LINKS: readonly NavLink[] = (manifest as { tiers: ManifestTierEntry[] }).tiers.map((tier) => ({
  label: tier.title,
  href: tierSectionHref(tier.id),
}));

/** The learner pages: the footer group and the phone menu's "Your learning" rows. */
export const YOUR_LEARNING_NAV: NavGroup = {
  label: "Your learning",
  children: [
    dashboard,
    { label: "Review", href: REVIEW_HREF },
    { label: "Notebook", href: NOTEBOOK_HREF },
    { label: "Self-assessment", href: SELF_ASSESSMENT_HREF },
    { label: "Settings", href: SETTINGS_HREF },
  ],
};

export const FOOTER_NAV: readonly NavGroup[] = [
  {
    label: "Learn",
    children: [
      curriculum,
      ...TIER_LINKS,
      { label: "Find your level", href: PLACEMENT_QUIZ_HREF },
      { label: "Expert index", href: EXPERT_INDEX_HREF },
    ],
  },
  { label: "Practice", children: [practiceHub, labs, exercises, interactiveModels, interviewPrep] },
  YOUR_LEARNING_NAV,
  { label: "Reference", children: [...REFERENCE_LINKS] },
];

export const LEGAL_LINKS: readonly NavLink[] = [
  { label: "Privacy policy", href: PRIVACY_POLICY_HREF },
  { label: "Terms of service", href: TERMS_OF_SERVICE_HREF },
];

// ---------------------------------------------------------------------------
// Current item
// ---------------------------------------------------------------------------

/** True when `path` is `base` or below it ("/practice" matches "/practice" and "/practice/lab/x", not "/practiced"). */
function under(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

const ACTIVE_RULES: readonly { label: PrimaryNavLabel; bases: readonly string[] }[] = [
  { label: "Curriculum", bases: [CURRICULUM_HREF, PLACEMENT_QUIZ_HREF] },
  { label: "Practice", bases: [PRACTICE_HREF, "/exercises", "/visualizations"] },
  { label: "Interview prep", bases: [INTERVIEW_PREP_HREF] },
  { label: "Reference", bases: REFERENCE_LINKS.map((link) => link.href) },
  { label: "Dashboard", bases: [DASHBOARD_HREF, SETTINGS_HREF, SELF_ASSESSMENT_HREF] },
];

/**
 * The top-level item that is current on `pathname`, or null. Query strings,
 * hashes and a trailing slash are ignored.
 */
export function activeNavLabel(pathname: string | null | undefined): PrimaryNavLabel | null {
  if (!pathname) return null;
  let path = pathname.split(/[?#]/)[0] ?? "";
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "");
  for (const rule of ACTIVE_RULES) {
    if (rule.bases.some((base) => under(path, base))) return rule.label;
  }
  return null;
}
