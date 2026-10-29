import { AdapterResult, DictionaryCandidate, DictionaryProviderId, DictionaryQuery, DictionarySense, FieldProvenance, PersistField, ProviderStatus } from './contracts';

export const normalizeWord = (word: string) => word.normalize('NFC').trim().toLowerCase();
const domainKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stopwords = new Set('a an the of to in on for with by is are was were be this that our and or as it through'.split(' '));
const tokens = (value: string) => new Set(domainKey(value).split(' ').filter(t => t.length > 2 && !stopwords.has(t)));
const key = (candidate: DictionaryCandidate, sense: DictionarySense) => `${normalizeWord(candidate.lemma)}:${candidate.partOfSpeech}:${domainKey(sense.definition.value ?? '')}:${(sense.domains ?? []).map(domainKey).sort().join(',')}`;

export function senseValues(sense: DictionarySense, query: DictionaryQuery): Partial<Record<PersistField, unknown>> {
  const pronunciation = sense.pronunciations.find(p => p.dialect === query.dialect && p.ipa)
    ?? sense.pronunciations.find(p => p.dialect === 'unknown' && p.ipa)
    ?? sense.pronunciations.find(p => Boolean(p.ipa));
  return { definitionEn: sense.definition.value, exampleEn: sense.examples.items[0], phonetic: pronunciation?.ipa,
    domains: sense.domains, registers: sense.registers, synonyms: sense.synonyms, antonyms: sense.antonyms,
    collocations: sense.collocations, wordForms: sense.wordForms, etymology: sense.etymology, frequency: sense.frequency,
    pronunciations: sense.pronunciations, meaningVi: sense.meaningVi?.value, exampleVi: sense.exampleVi?.value,
    cefr: sense.cefr.status === 'verified' ? sense.cefr : null };
}
export const hasValue = (value: unknown) => value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);

// Rights are attached to the actual source of each field, never inferred from
// the primary provider of an aggregated response.
export function sourceResult(result: AdapterResult, status: ProviderStatus, query: DictionaryQuery): AdapterResult {
  const retrievedAt = new Date().toISOString();
  for (const candidate of result.candidates) for (const sense of candidate.senses) {
    sense.provider = status.id;
    sense.domains ??= []; sense.registers ??= []; sense.synonyms ??= []; sense.antonyms ??= [];
    sense.collocations ??= []; sense.wordForms ??= []; sense.etymology ??= null; sense.frequency ??= null;
    sense.meaningVi ??= { status: 'unavailable', value: null }; sense.exampleVi ??= { status: 'unavailable', value: null };
    // An adapter may impose stricter per-sense rights than its provider.
    sense.persistFields = sense.persistFields.filter(field => status.persistFields.includes(field) && status.licenseMode !== 'LIVE_ONLY');
    sense.provenance = {};
    for (const [field, value] of Object.entries(senseValues(sense, query))) {
      if (!hasValue(value)) continue;
      const persistable = sense.persistFields.includes(field as PersistField);
      sense.provenance[field as PersistField] = [{ provider: status.id, providerEntryRef: candidate.providerEntryRef,
        providerSenseRef: sense.providerSenseRef, licenseMode: status.licenseMode, persistable,
        exportable: persistable && status.licenseMode === 'OPEN_LICENSE', attribution: sense.attribution, retrievedAt }];
    }
    sense.missingFields = ['definitionEn', 'exampleEn', 'phonetic', 'meaningVi', 'synonyms', 'cefr'].filter(field => !hasValue(senseValues(sense, query)[field as PersistField]));
  }
  return result;
}

export function rankCandidates(candidates: DictionaryCandidate[], query: DictionaryQuery): DictionaryCandidate[] {
  const context = tokens(query.contextSentence ?? '');
  const domain = query.domain ? domainKey(query.domain) : '';
  for (const candidate of candidates) {
    for (const sense of candidate.senses) {
      const domains = (sense.domains ?? []).map(domainKey);
      const domainMatch = !!domain && domains.some(d => d === domain || d.includes(domain) || domain.includes(d));
      const definition = tokens(`${sense.definition.value ?? ''} ${sense.examples.items.join(' ')} ${(sense.synonyms ?? []).join(' ')}`);
      const overlap = [...context].filter(t => definition.has(t) && !tokens(query.word).has(t)).length;
      sense.ranking = { score: (domainMatch ? 10 : 0) + (context.size ? overlap / context.size : 0), method: 'lexical_overlap', domainMatch, verified: false };
    }
    candidate.senses.sort((a, b) => b.ranking!.score - a.ranking!.score);
  }
  return candidates.sort((a, b) => (b.senses[0]?.ranking?.score ?? 0) - (a.senses[0]?.ranking?.score ?? 0));
}

// Merge only equal normalized definitions/POS/domains. Similarity is a ranking
// hint, never evidence that two different senses share synonyms or examples.
export function mergeCandidates(candidates: DictionaryCandidate[], query: DictionaryQuery): DictionaryCandidate[] {
  const seen = new Map<string, DictionarySense>();
  const merged: DictionaryCandidate[] = [];
  for (const candidate of candidates) {
    const senses: DictionarySense[] = [];
    for (const sense of candidate.senses) {
      const identity = key(candidate, sense);
      const previous = sense.definition.value ? seen.get(identity) : undefined;
      if (!previous) { seen.set(identity, sense); senses.push(sense); continue; }
      // Do not union fields with different rights or overwrite primary refs.
      // Only missing sense metadata is filled and retains donor provenance.
      const before = senseValues(previous, query), donor = senseValues(sense, query);
      const metadata = ['domains', 'registers', 'synonyms', 'antonyms', 'collocations', 'wordForms', 'etymology', 'frequency'] as const;
      for (const field of metadata) if (!hasValue(before[field]) && hasValue(donor[field])) {
        Object.assign(previous, { [field]: sense[field] });
        previous.provenance ??= {};
        previous.provenance[field] = sense.provenance?.[field];
        previous.persistFields = previous.persistFields.filter(f => f !== field);
        if (sense.persistFields.includes(field)) previous.persistFields.push(field);
      }
      if (!previous.examples.items.length && sense.examples.items.length) {
        previous.examples = sense.examples;
        previous.provenance ??= {};
        previous.provenance.exampleEn = sense.provenance?.exampleEn;
        previous.persistFields = previous.persistFields.filter(f => f !== 'exampleEn');
        if (sense.persistFields.includes('exampleEn')) previous.persistFields.push('exampleEn');
      }
      // Pronunciation belongs to the same lexeme, but audio rights must remain
      // separate; never copy audio solely on the strength of text permission.
      if (!previous.pronunciations.some(p => p.ipa) && sense.pronunciations.some(p => p.ipa)) {
        previous.pronunciations = sense.pronunciations;
        previous.provenance ??= {};
        for (const field of ['phonetic', 'pronunciations'] as const) {
          previous.provenance[field] = sense.provenance?.[field];
          previous.persistFields = previous.persistFields.filter(f => f !== field);
          if (sense.persistFields.includes(field)) previous.persistFields.push(field);
        }
      }
      previous.attribution = [...new Map([...previous.attribution, ...sense.attribution].map(a => [a.url, a])).values()];
    }
    if (senses.length) merged.push({ ...candidate, senses });
  }
  for (const candidate of merged) for (const sense of candidate.senses) {
    sense.missingFields = ['definitionEn', 'exampleEn', 'phonetic', 'meaningVi', 'synonyms', 'cefr'].filter(field => !hasValue(senseValues(sense, query)[field as PersistField]));
  }
  return rankCandidates(merged, query);
}

export function persistableProvenance(sense: DictionarySense, field: PersistField): FieldProvenance[] {
  return (sense.provenance?.[field] ?? []).filter(p => p.persistable && p.licenseMode !== 'LIVE_ONLY');
}

export const localProviders: DictionaryProviderId[] = ['local_kaikki', 'local_wordnet'];
