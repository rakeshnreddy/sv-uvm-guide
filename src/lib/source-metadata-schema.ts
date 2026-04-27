export type SourceType = 'standard' | 'vendor' | 'tertiary';

export interface SourceMetadata {
  title: string;
  type: SourceType;
  identifier?: string; // e.g., "IHI0022H" or "IEEE 1800-2023"
  version?: string;
  url?: string;
}

export function validateSourceMetadata(source: any): source is SourceMetadata {
  if (typeof source !== 'object' || source === null) return false;
  if (typeof source.title !== 'string' || source.title.trim() === '') return false;
  if (!['standard', 'vendor', 'tertiary'].includes(source.type)) return false;
  if (source.identifier !== undefined && typeof source.identifier !== 'string') return false;
  if (source.version !== undefined && typeof source.version !== 'string') return false;
  if (source.url !== undefined && typeof source.url !== 'string') return false;
  return true;
}

export function validateSourcesArray(sources: any): sources is SourceMetadata[] {
  if (!Array.isArray(sources)) return false;
  return sources.every(validateSourceMetadata);
}
