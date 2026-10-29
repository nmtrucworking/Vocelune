# Multi-source Dictionary

Vocelune supports local Kaikki/Wiktextract and Open English WordNet dictionaries,
Free Dictionary, Wiktionary REST, WordsAPI, Merriam-Webster, Oxford, Collins and
Datamuse. Existing account preferences are preserved. Select **Tự động** in
Settings or Quick Add to use local data first.

## Install / migrate

```sh
npm install
npm run db:generate
npm run db:migrate
```

Migration `202610290002_dictionary_intelligence` adds the shared open-data store,
provider health and `VocabItem.lexicalMetadata`. No existing vocabulary is removed.

## Import local dictionaries

Run from the repository root. Import scripts use `apps/backend/.env` and write to
that database. Data is not bundled in Git. Store downloaded datasets outside the
checkout. Import commands are idempotent; interrupted runs can be restarted.

Download the **JSON** archive from [Open English WordNet downloads](https://en-word.net/downloads),
extract it into a directory containing `entries-*.json`, `noun.*.json`,
`verb.*.json`, `adj.*.json` and `adv.*.json`, then run:

```sh
npm run dictionary:import -- wordnet /absolute/path/english-wordnet-2025 2025
```

The importer joins senses with synsets, resolves sense-specific antonyms and
domain identifiers, preserves homographs and records source attribution. It was
validated against all 135,969 entries / 185,129 senses in the official 2025 JSON
archive. Pronunciations without a documented regional label remain `unknown`.

For Kaikki, use English-language Wiktionary extraction from the
[raw Wiktextract download page](https://kaikki.org/dictionary/rawdata.html).
Decompress the JSONL file first:

```sh
npm run dictionary:import -- kaikki /absolute/path/en-extract.jsonl 2026-10-01
```

Only entries whose `lang_code` is `en` are imported. The CLI streams JSONL rather
than loading the entire dump into memory. Invalid/unsupported entries are counted
as skipped; malformed JSON fails the run. Dataset version and import time are
stored per entry. Import preserves entries absent from a newer dump; use an
explicit maintenance migration if you want to prune retired entries. Updating
local data may require a backend restart or waiting for cache TTL before previews
refresh; saves always revalidate from the current database.

Kaikki supplies sense-level glosses, examples, topics, usage labels, translations,
synonyms/antonyms and entry-level forms/etymology/IPA when present. Entry-wide
synonyms/translations are not copied indiscriminately into each sense. Audio is
excluded from imports until its separate licensing can be verified.

## Configuration

Copy the dictionary variables from `apps/backend/.env.example`. All keys remain
server-side. WordsAPI and Collins are disabled until both a key and a positive
quota are provided. Limits are locally configured budgets, not assertions about
the provider's current free plan.

| Setting | Default | Behavior |
| --- | --- | --- |
| `DICTIONARY_MAX_REQUESTS` | `4` | Maximum online dictionary attempts per lookup/save orchestration, at most `8` |
| `DICTIONARY_CACHE_TTL_SECONDS` | `3600` | Bounded in-memory cache for entirely persistable, open-licensed responses; `0` disables |
| `DICTIONARY_USER_AGENT` | Vocelune project URL | Wikimedia identification; set your application's contact URL |
| `MERRIAM_WEBSTER_DAILY_LIMIT` | `1000` | Shared UTC daily quota |
| `OXFORD_DAILY_LIMIT` | `500` | Shared UTC daily quota; `0` disables network calls |
| `WORDSAPI_DAILY_LIMIT` | `0` | Shared UTC daily quota; RapidAPI key required |
| `COLLINS_MONTHLY_LIMIT` | `0` | Shared UTC calendar-month quota; Collins key required |
| `DATAMUSE_ENABLED` | `false` | Optional lexeme-level related words |
| `DATAMUSE_DAILY_LIMIT` | `10000` | Shared daily quota when enabled |

Daily/monthly quota reservations and health state are shared through PostgreSQL,
including across server instances. The transport reserves quota before sending,
does not retry automatically, honors `Retry-After` seconds/HTTP dates, pauses
401/403 sources for 15 minutes, and opens a 60-second circuit after three
upstream/network failures. Provider status exposes cooldown and local entry counts
without exposing credentials. No request URL or provider body is stored in usage
logs. Each HTTP response is limited to 2 MB and an 8-second timeout.

## Lookup and save

`POST /api/v1/dictionary/lookup` (authenticated, existing CSRF requirements):

```json
{
  "word": "pipeline",
  "partOfSpeech": "noun",
  "dialect": "en-us",
  "provider": "auto",
  "strategy": "auto_enrich",
  "domain": "computer_science",
  "contextSentence": "Our ETL pipeline processes customer data."
}
```

AUTO tries local Kaikki → local WordNet → Free Dictionary → Wiktionary → configured
WordsAPI/Merriam-Webster/Oxford/Collins. It stops when it finds a sense with a
definition, example, IPA and synonyms, or reaches its request budget. A partial
result is usable when enrichment fails. Manual source comparison stops on the
selected source unless fallback is explicitly enabled; fallback also works when
Free Dictionary itself fails. Datamuse, if enabled, uses any remaining request
budget and returns `relatedWords` with `scope: lexeme` and `persistable: false`.

Candidates retain original entry/sense references and each sense identifies its
provider. Domain labels and lexical overlap rank senses; `ranking.verified` is
always false. Ranking is a suggestion, not verified specialist meaning. Only
equal normalized definitions, POS and domain labels merge; missing fields keep
their donor's provenance. Missing data remains empty/null and `missingFields`
identifies gaps. CEFR stays `not_verified` unless an explicitly verified source
supplies it. Kaikki/WordNet import does not invent CEFR or frequency estimates.

Quick Add translates the selected definition after selection through the existing
translation endpoint, with stale-result protection. It does not translate an
ambiguous headword for every sense. The translation is an editable machine
suggestion; users confirm their Vietnamese meaning before saving. LIVE_ONLY
definitions do not trigger automatic translation or field autofill. Translation
is a separate user action with its own timeout/fallback and is not included in
dictionary lookup's network budget.

To save, send the actual selected sense's `provider`, `providerEntryRef` and
`providerSenseRef` to `POST /api/v1/dictionary/vocabulary`, along with `deckId`,
`meaningVi` and the lookup query. Use `strategy: auto_enrich` to revalidate donated
fields as well. The server bypasses preview cache, re-fetches sources and permits
only source-approved fields. Client-supplied provenance/lexical metadata is rejected.

Metadata is saved per vocabulary sense in `lexicalMetadata`; `provenance.fieldSources`
records source refs, retrieval time, attribution and persistence/export rights per
field. Exports, public deck previews and forks apply those rights and retain source
attribution. Commercial storage approval does not imply export permission.

## Source rights and supported formats

- Kaikki/Wiktionary text: CC BY-SA, with Wiktionary page attribution. Retain the
  license and attribution when redistributing adapted content.
- WordNet: attribute both Princeton WordNet and Open English WordNet and retain
  their [license notices](https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md).
- Free Dictionary: persist only entries declaring recognized CC BY-SA licenses
  with a traceable Wiktionary page. Text permission does not grant audio rights.
- WordsAPI, Merriam-Webster and Oxford default to LIVE_ONLY. Their explicit
  persistence flags and field allowlists require an applicable storage license.
- Collins is always LIVE_ONLY, including caching. The adapter supports the JSON
  envelope from `/search/first?format=xml` containing explicit `hom/pos/sense/def/quote`
  markup. Unknown formats fail closed without guessing meanings; verify your
  licensed dictionary's XML before enabling it. See [Collins API reference](https://api.collinsdictionary.com/api/v1/documentation/html).
- Wiktionary's definition endpoint is experimental; contract errors fall back
  within budget. See [Wikimedia REST documentation](https://www.mediawiki.org/wiki/Wikimedia_REST_API/en).
- [WordsAPI response fields](https://www.wordsapi.com/docs/) are mapped per result.
- Datamuse is auxiliary, not a dictionary replacement. Its documented key
  requirement starts February 1, 2027; the adapter disables keyless access after
  that date. See [Datamuse API documentation](https://www.datamuse.com/api/).

## Verification and remaining evaluation

```sh
npm test
npm run typecheck
npm run build
```

Tests cover sense isolation, supported adapter formats, local lookup/save/export,
context ranking, cache rights, strict payload validation, multi-source fallback,
atomic quotas, circuit recovery and a matrix of field/license export policies.
Online responses are mocked: these tests do not assert a live commercial account
has access or establish dictionary quality. A manually labeled set of at least
200 real words/contexts and production P95/semantic-accuracy evaluation remain
release evaluation work. `metrics` reports lookup requests, cache hits and latency;
provider usage logs record actual HTTP status and latency.

Optional P2 ontology sources (OLS4, NCI, Wikidata), embedding ranking, CMUdict
ARPAbet-to-IPA conversion and licensed collocation/frequency/CEFR datasets are not
enabled by this implementation. The storage/contracts accept missing metadata
without fabricating values, and the registry can be extended with these sources.
