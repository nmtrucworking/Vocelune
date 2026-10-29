import { config as loadEnv } from 'dotenv';
import { createReadStream } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { DictionaryCandidate } from '../src/integrations/dictionary/contracts';
import { normalizeWord } from '../src/integrations/dictionary/lexical';
import { parseKaikki, parseWordnet, WordnetEntry, wordnetEntrySchema, WordnetSynset, wordnetSynsetSchema } from '../src/integrations/dictionary/importers';

loadEnv({ quiet: true });
const [source, path, version] = process.argv.slice(2);
if (!['kaikki', 'wordnet'].includes(source) || !path || !version) {
  throw new Error('Usage: npm run dictionary:import -- <kaikki|wordnet> <JSONL file|extracted JSON directory> <dataset-version>');
}
const db = new PrismaClient();
let imported = 0, skipped = 0;
async function save(candidate: DictionaryCandidate | null) {
  if (!candidate) { skipped++; return; }
  const provider = source === 'kaikki' ? 'local_kaikki' : 'local_wordnet';
  const data = { lemma: candidate.lemma, normalized: normalizeWord(candidate.lemma), partOfSpeech: candidate.partOfSpeech, datasetVersion: version,
    candidate: JSON.parse(JSON.stringify(candidate)), importedAt: new Date() };
  await db.dictionaryEntry.upsert({ where: { provider_entryRef: { provider, entryRef: candidate.providerEntryRef } }, create: { provider, entryRef: candidate.providerEntryRef, ...data }, update: data });
  imported++;
  if (imported % 1000 === 0) process.stdout.write(`Imported ${imported}; skipped ${skipped}\n`);
}
async function main() {
  if (source === 'kaikki') {
    const lines = createInterface({ input: createReadStream(resolve(path)), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      // A corrupt line fails loudly; already imported entries remain usable and
      // a repeat run safely upserts them. Never download arbitrary URLs here.
      await save(parseKaikki(JSON.parse(line)));
    }
  } else {
    const directory = resolve(path), files = (await readdir(directory)).filter(f => f.endsWith('.json')).sort();
    const synsets = new Map<string, WordnetSynset>();
    for (const file of files.filter(f => /^(noun|verb|adj|adv)\./.test(f))) {
      const data: Record<string, unknown> = JSON.parse(await readFile(resolve(directory, file), 'utf8'));
      for (const [id, value] of Object.entries(data)) synsets.set(id, wordnetSynsetSchema.parse(value));
    }
    if (!synsets.size) throw new Error('No WordNet synsets found; extract the official JSON archive first.');
    const senseLemmas = new Map<string, string>();
    const entryFiles = files.filter(f => f.startsWith('entries-'));
    if (!entryFiles.length) throw new Error('No WordNet entries-*.json files found.');
    for (const file of entryFiles) {
      const entries: Record<string, Record<string, unknown>> = JSON.parse(await readFile(resolve(directory, file), 'utf8'));
      for (const [lemma, variants] of Object.entries(entries)) for (const value of Object.values(variants)) {
        for (const sense of wordnetEntrySchema.parse(value).sense) senseLemmas.set(sense.id, lemma);
      }
    }
    for (const file of entryFiles) {
      const entries: Record<string, Record<string, unknown>> = JSON.parse(await readFile(resolve(directory, file), 'utf8'));
      for (const [lemma, variants] of Object.entries(entries)) for (const [pos, value] of Object.entries(variants)) {
        await save(parseWordnet(lemma, pos, wordnetEntrySchema.parse(value), synsets, senseLemmas));
      }
    }
  }
  process.stdout.write(`Done. Imported ${imported}; skipped ${skipped}. Existing entries from other versions were preserved.\n`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
