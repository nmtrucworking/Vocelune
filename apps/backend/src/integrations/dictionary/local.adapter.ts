import { Database } from '../../common/db';
import { AdapterResult, DictionaryAdapter, DictionaryCandidate, DictionaryQuery, persistFieldNames, ProviderStatus } from './contracts';
import { normalizeWord } from './lexical';

export class LocalDictionaryAdapter implements DictionaryAdapter {
  constructor(private db: Database, private provider: 'local_kaikki' | 'local_wordnet') {}
  status(): ProviderStatus {
    const kaikki = this.provider === 'local_kaikki';
    return { id: this.provider, name: kaikki ? 'Kaikki / Wiktionary local' : 'Open English WordNet local', tier: 'local', configured: true,
      licenseMode: 'OPEN_LICENSE', persistenceSupported: true, persistFields: [...persistFieldNames],
      description: 'Tra trong PostgreSQL, không tốn lượt API. Cần nhập dataset trước khi sử dụng.',
      attribution: kaikki ? { name: 'Wiktionary contributors / Kaikki', url: 'https://kaikki.org/dictionary/English/', license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } }
        : { name: 'Princeton WordNet / Open English WordNet contributors', url: 'https://en-word.net/', license: { name: 'CC BY 4.0 / WordNet License', url: 'https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md' } } };
  }
  request(): never { throw new Error('Local dictionary must not use the network transport'); }
  parse(): never { throw new Error('Local dictionary reads validated imported candidates'); }
  async lookup(query: DictionaryQuery): Promise<AdapterResult> {
    const entries = await this.db.dictionaryEntry.findMany({ where: { provider: this.provider, normalized: normalizeWord(query.word), partOfSpeech: query.partOfSpeech }, orderBy: { entryRef: 'asc' }, take: 50 });
    return { candidates: entries.map(e => e.candidate as unknown as DictionaryCandidate), suggestions: [], warnings: entries.length ? [] : ['Kho local chưa có từ này; có thể nhập hoặc cập nhật dataset.'] };
  }
}
