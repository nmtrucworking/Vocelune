import type { LexicalMetadata } from '@/lib/dictionary';

export function LexicalMetadataView({ metadata }: { metadata?: Partial<LexicalMetadata> | null }) {
  if (!metadata) return null;
  const rows = [
    ['Lĩnh vực', metadata.domains], ['Văn phong', metadata.registers], ['Đồng nghĩa', metadata.synonyms],
    ['Trái nghĩa', metadata.antonyms], ['Cụm từ thường đi kèm', metadata.collocations], ['Biến thể', metadata.wordForms?.map(f => `${f.form}${f.tags.length ? ` (${f.tags.join(', ')})` : ''}`)],
  ] as const;
  return <div className="space-y-2 text-xs">
    {rows.map(([label, items]) => items?.length ? <p key={label}><span className="font-semibold">{label}: </span>{items.join(' · ')}</p> : null)}
    {metadata.etymology && <p><span className="font-semibold">Nguồn gốc: </span>{metadata.etymology}</p>}
    {metadata.frequency && <p>Tần suất: {metadata.frequency.value} {metadata.frequency.unit} · {metadata.frequency.source}</p>}
    {metadata.cefr?.status === 'verified' && <p>CEFR: {metadata.cefr.value} · {metadata.cefr.source}</p>}
  </div>;
}
