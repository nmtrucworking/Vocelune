import { FieldProvenance, persistFieldNames } from './contracts';

type Provenance = { provider?: string; licenseMode?: string; persistedFields?: string[]; exportableFields?: string[]; fieldSources?: Record<string, FieldProvenance[]> };
export function exportableField(provenance: unknown, field: string): boolean {
  const source = provenance as Provenance | null;
  if (!source?.exportableFields?.includes(field)) return false;
  const sources = source.fieldSources?.[field];
  if (sources?.length) return sources.every(s => s.exportable && s.persistable && s.licenseMode === 'OPEN_LICENSE');
  // Backward compatibility for open-licensed vocabulary saved before field sources.
  return source.provider === 'free_dictionary' && source.licenseMode === 'OPEN_LICENSE';
}
export function hasRestrictedContent(item: { sourceKind: string; provenance: unknown }) {
  if (item.sourceKind !== 'licensed') return false;
  const provenance = item.provenance as Provenance | null;
  return !provenance || (provenance.persistedFields ?? []).some(field => !exportableField(provenance, field));
}
export function redactForSharing<T extends { sourceKind?: string; provenance?: unknown; lexicalMetadata?: unknown }>(item: T): T {
  if (item.sourceKind !== 'licensed') return item;
  const dto = { ...item } as T & Record<string, unknown>;
  const provenance = item.provenance as Provenance | null;
  for (const field of provenance?.persistedFields ?? ['definitionEn', 'exampleEn', 'phonetic']) {
    if (!exportableField(provenance, field) && ['definitionEn', 'exampleEn', 'phonetic', 'meaningVi', 'exampleVi'].includes(field)) Object.assign(dto, { [field]: '' });
  }
  if (item.lexicalMetadata && typeof item.lexicalMetadata === 'object') {
    const metadata = { ...item.lexicalMetadata } as Record<string, unknown>;
    for (const field of persistFieldNames) if (!exportableField(provenance, field)) delete metadata[field];
    dto.lexicalMetadata = metadata;
  }
  return dto;
}
