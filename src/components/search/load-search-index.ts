import { prepareSearchDocuments, type SearchDocument, type SearchIndexData } from "./search-engine";

let pending: Promise<SearchDocument[]> | null = null;

/**
 * Loads the generated index on first use. The JSON is a separate chunk, so
 * pages that never search never download it.
 */
export function loadSearchDocuments(): Promise<SearchDocument[]> {
  if (!pending) {
    pending = import("@/generated/search-index.json")
      .then((module) => prepareSearchDocuments((module.default ?? module) as unknown as SearchIndexData))
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

/** Test hook: forget the cached index. */
export function resetSearchDocumentsCache(): void {
  pending = null;
}
