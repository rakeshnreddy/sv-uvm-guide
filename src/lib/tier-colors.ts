/**
 * Tier colours (DESIGN.md section 11): which tier a module code belongs to,
 * read from the curriculum manifest, never from the code's prefix (B-AXI-1
 * sits in tier 3 although its prefix names no tier). The manifest is the same
 * JSON module src/lib/site-links.ts and the course outline already ship to the
 * browser, so this adds no second copy of the curriculum to a bundle.
 *
 * A tier number drives the `data-tier` scope in globals.css, which sets
 * --tier-current (and -subtle, -border) for the subtree:
 *
 *   <span data-tier={tierOfModuleCode("I-UVM-1B")} className="text-tier-current" />
 *
 * Milestone ids (M0 to M8), tier codes (T1) and unknown codes return
 * undefined, and their element stays neutral.
 */
import manifest from "../../content/curriculum/curriculum.manifest.json";

export type TierNumber = 1 | 2 | 3 | 4;

export const TIER_NUMBERS: readonly TierNumber[] = [1, 2, 3, 4];

/** "T2_Intermediate" → 2. */
function tierNumberOfId(tierId: string): TierNumber | undefined {
  const match = /^T([1-4])(?:_|$)/i.exec(tierId);
  return match ? (Number(match[1]) as TierNumber) : undefined;
}

/** "I-SV-5_Synchronization_and_IPC" → "I-SV-5" (the folder prefix up to the first underscore). */
function codeOfModuleId(moduleId: string): string {
  return moduleId.split("_")[0] ?? moduleId;
}

/** "T1_Foundational", "t1-foundational", "T1 Foundational" → "t1-foundational". */
function slugKey(segment: string): string {
  return segment
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildModuleTiers(): ReadonlyMap<string, TierNumber> {
  const map = new Map<string, TierNumber>();
  for (const tier of manifest.tiers) {
    const tierNumber = tierNumberOfId(tier.id);
    if (!tierNumber) continue;
    for (const mod of tier.modules) map.set(codeOfModuleId(mod.id).toUpperCase(), tierNumber);
  }
  return map;
}

function buildTierSlugs(): ReadonlyMap<string, TierNumber> {
  const map = new Map<string, TierNumber>();
  for (const tier of manifest.tiers) {
    const tierNumber = tierNumberOfId(tier.id);
    if (tierNumber) map.set(slugKey(tier.id), tierNumber);
  }
  return map;
}

/** Module code (upper case) → tier, from the manifest. */
export const MODULE_TIERS: ReadonlyMap<string, TierNumber> = buildModuleTiers();

const TIER_SLUGS = buildTierSlugs();

/**
 * The tier a module code belongs to: "F1A" → 1, "I-UVM-1B" → 2, "B-AXI-1" → 3,
 * "E-DBG-1" → 4. Case and surrounding space are ignored. A full module folder
 * name ("F1A_The_Cost_of_Bugs") works too. Milestones, tier codes and unknown
 * codes return undefined.
 */
export function tierOfModuleCode(code: string | null | undefined): TierNumber | undefined {
  if (!code) return undefined;
  return MODULE_TIERS.get(codeOfModuleId(code.trim()).toUpperCase());
}

/**
 * The tier a curriculum URL segment names: the tier folder ("T2_Intermediate")
 * or its pretty form ("t2-intermediate"). Anything else returns undefined.
 */
export function tierOfTierSlug(segment: string | null | undefined): TierNumber | undefined {
  if (!segment) return undefined;
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Keep the raw segment.
  }
  return TIER_SLUGS.get(slugKey(decoded));
}

/**
 * A lesson URL's tier: /curriculum/<tier>/<module>[/<lesson>], with the tier
 * segment in any form the lesson route accepts. Hub pages (/curriculum,
 * /curriculum/expert-index, /practice, …) return undefined.
 */
export function lessonTierFromPathname(pathname: string | null | undefined): TierNumber | undefined {
  if (!pathname) return undefined;
  const segments = pathname.split(/[?#]/)[0].split("/").filter(Boolean);
  if (segments[0] !== "curriculum" || segments.length < 3) return undefined;
  return tierOfTierSlug(segments[1]);
}

/** The `data-tier` attribute value for a tier, or undefined to leave the attribute off. */
export function tierDataAttribute(tier: TierNumber | undefined): `${TierNumber}` | undefined {
  return tier ? (String(tier) as `${TierNumber}`) : undefined;
}
