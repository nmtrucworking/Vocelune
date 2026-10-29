export const ARPABET_PHONEMES: Record<string, string> = {
  AA: 'ɑː', AE: 'æ', AH: 'ʌ', AO: 'ɔː', AW: 'aʊ', AY: 'aɪ',
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', EH: 'e', ER: 'ɜːr',
  EY: 'eɪ', F: 'f', G: 'ɡ', HH: 'h', IH: 'ɪ', IY: 'iː',
  JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ',
  OW: 'oʊ', OY: 'ɔɪ', P: 'p', R: 'r', S: 's', SH: 'ʃ',
  T: 't', TH: 'θ', UH: 'ʊ', UW: 'uː', V: 'v', W: 'w',
  Y: 'j', Z: 'z', ZH: 'ʒ',
};

const VOWELS = new Set([
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
]);

/**
 * Converts CMU ARPAbet transcription string into standard International Phonetic Alphabet (IPA).
 * Example: "W AO1 T ER0" -> "/ˈwɔːtər/", "S K EH1 JH UH0 L" -> "/ˈskedʒʊl/"
 */
export function arpabetToIpa(arpabet: string): string {
  if (!arpabet || typeof arpabet !== 'string') return '';
  const tokens = arpabet.trim().split(/\s+/);
  if (!tokens.length) return '';

  const items = tokens.map(t => {
    const match = t.match(/^([A-Z]+)([012])?$/);
    if (!match) return { base: t, stress: 0, isVowel: false, ipa: t.toLowerCase() };
    const base = match[1];
    const stress = match[2] ? parseInt(match[2], 10) : 0;
    const isVowel = VOWELS.has(base);
    let ipa = ARPABET_PHONEMES[base] || base.toLowerCase();
    if (isVowel && stress === 0) {
      if (base === 'AH') ipa = 'ə';
      else if (base === 'ER') ipa = 'ər';
      else if (base === 'IH') ipa = 'ɪ';
      else if (base === 'IY') ipa = 'i';
      else if (base === 'UW') ipa = 'u';
      else if (base === 'AA') ipa = 'ɑ';
      else if (base === 'AO') ipa = 'ɔ';
    }
    return { base, stress, isVowel, ipa };
  });

  const stressPositions = new Map<number, string>();
  for (let i = 0; i < items.length; i++) {
    if (items[i].isVowel && items[i].stress > 0) {
      const mark = items[i].stress === 1 ? 'ˈ' : 'ˌ';
      let onsetStart = i;
      while (onsetStart > 0 && !items[onsetStart - 1].isVowel && (i - onsetStart < 3)) {
        if (items[onsetStart - 1].base === 'NG') break;
        if (onsetStart - 1 === 0) {
          onsetStart--;
          break;
        }
        if (items[onsetStart - 2]?.isVowel) {
          onsetStart--;
          break;
        }
        onsetStart--;
      }
      stressPositions.set(onsetStart, mark);
    }
  }

  let result = '';
  for (let i = 0; i < items.length; i++) {
    if (stressPositions.has(i)) {
      result += stressPositions.get(i);
    }
    result += items[i].ipa;
  }

  const cleaned = result.trim();
  if (!cleaned) return '';
  return cleaned.startsWith('/') && cleaned.endsWith('/') ? cleaned : `/${cleaned}/`;
}

/**
 * Normalizes an IPA string to standard /.../ formatting
 */
export function formatIpa(rawIpa: string): string {
  if (!rawIpa) return '';
  const trimmed = rawIpa.trim();
  if (!trimmed) return '';
  const cleaned = trimmed.replace(/^[\/\[]+|[\/\]]+$/g, '').trim();
  return cleaned ? `/${cleaned}/` : '';
}

/**
 * High-reliability multi-tier IPA fetcher:
 * 1. Free Dictionary API (extracts phonetic text across any matching or root entry)
 * 2. Datamuse API (fetches ARPAbet pronunciation and converts to standard IPA)
 */
export async function resolveWordIpa(word: string, preferredDialect: 'en-us' | 'en-gb' = 'en-us'): Promise<{ ipa: string; dialect: string; source: string } | null> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return null;

  // 1. Try Free Dictionary API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[0];
        const phonetics: Array<{ text?: string; audio?: string }> = entry.phonetics || [];

        // Exact dialect match
        const dialectKey = preferredDialect === 'en-gb' ? 'uk' : 'us';
        const exactMatch = phonetics.find(p => p.audio && p.audio.toLowerCase().includes(`-${dialectKey}.`) && p.text);
        if (exactMatch?.text) {
          return { ipa: formatIpa(exactMatch.text), dialect: preferredDialect, source: 'free_dictionary' };
        }

        // Any non-empty text in phonetics
        const anyPhoneticText = phonetics.find(p => Boolean(p.text?.trim()))?.text;
        if (anyPhoneticText) {
          return { ipa: formatIpa(anyPhoneticText), dialect: 'unknown', source: 'free_dictionary' };
        }

        // Root phonetic field
        if (entry.phonetic?.trim()) {
          return { ipa: formatIpa(entry.phonetic), dialect: 'unknown', source: 'free_dictionary' };
        }
      }
    }
  } catch {
    // Proceed to Datamuse fallback
  }

  // 2. Fallback to Datamuse CMU Arpabet-to-IPA conversion
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(normalized)}&qe=sp&md=dpr`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const exact = data.find((item: any) => item.word?.toLowerCase() === normalized) || data[0];
        const pronTag = exact?.tags?.find((t: string) => t.startsWith('pron:'));
        if (pronTag) {
          const rawArpabet = pronTag.replace('pron:', '').trim();
          const ipa = arpabetToIpa(rawArpabet);
          if (ipa) {
            return { ipa, dialect: 'en-us', source: 'datamuse_arpabet' };
          }
        }
      }
    }
  } catch {
    // Fallback exhausted
  }

  return null;
}
