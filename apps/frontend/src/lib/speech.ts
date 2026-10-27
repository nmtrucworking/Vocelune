// Advanced Audio Engine for Vocelune
// Combines authentic human studio recordings + enhanced neural speech synthesis with voice caching.

interface PlaybackCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

// In-memory cache for human studio audio URLs
const audioUrlCache = new Map<string, string | null>();
let currentAudioElement: HTMLAudioElement | null = null;
let voicesLoaded = false;
let availableVoices: SpeechSynthesisVoice[] = [];

// Ensure voices are loaded asynchronously in Web Speech API
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      voicesLoaded = true;
    }
  };

  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

/**
 * Fetch authentic human pronunciation recording from public dictionary API
 */
async function fetchHumanAudioUrl(word: string, dialect: 'en-gb' | 'en-us'): Promise<string | null> {
  const cacheKey = `${word.toLowerCase().trim()}_${dialect}`;
  if (audioUrlCache.has(cacheKey)) {
    return audioUrlCache.get(cacheKey) || null;
  }

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`);
    if (!res.ok) {
      audioUrlCache.set(cacheKey, null);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      audioUrlCache.set(cacheKey, null);
      return null;
    }

    // Look for phonetic audio matching dialect
    const phonetics: Array<{ audio?: string }> = data[0]?.phonetics || [];
    const targetSuffix = dialect === 'en-gb' ? '-uk.mp3' : '-us.mp3';

    // 1st preference: exact dialect match
    let match = phonetics.find((p) => p.audio && p.audio.toLowerCase().includes(targetSuffix))?.audio;

    // 2nd preference: any non-empty audio
    if (!match) {
      match = phonetics.find((p) => p.audio && p.audio.trim().length > 0)?.audio;
    }

    if (match) {
      // Fix protocol-relative URLs if needed
      const fullUrl = match.startsWith('//') ? `https:${match}` : match;
      audioUrlCache.set(cacheKey, fullUrl);
      return fullUrl;
    }

    audioUrlCache.set(cacheKey, null);
    return null;
  } catch {
    audioUrlCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Find highest-fidelity voice for Web Speech Synthesis
 */
function getBestVoice(dialect: 'en-gb' | 'en-us'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  if (availableVoices.length === 0) {
    availableVoices = window.speechSynthesis.getVoices();
  }

  const isGB = dialect === 'en-gb';
  const targetCode = isGB ? 'en-GB' : 'en-US';
  const targetPrefix = isGB ? 'en-GB' : 'en-US';

  // Quality ranking keywords
  const preferredNamesGB = [
    'Google UK English Female',
    'Google UK English Male',
    'Daniel (Enhanced)',
    'Daniel (Premium)',
    'Serena (Enhanced)',
    'Oliver (Enhanced)',
    'Kate (Enhanced)',
    'Microsoft Sonia',
    'Microsoft George',
  ];

  const preferredNamesUS = [
    'Google US English',
    'Samantha (Enhanced)',
    'Samantha (Premium)',
    'Ava (Enhanced)',
    'Ava (Premium)',
    'Allison (Enhanced)',
    'Tom (Enhanced)',
    'Microsoft Jenny',
    'Microsoft Guy',
    'Alex',
  ];

  const preferredList = isGB ? preferredNamesGB : preferredNamesUS;

  // 1. Try matching preferred high-definition voices
  for (const name of preferredList) {
    const found = availableVoices.find(
      (v) => v.name.toLowerCase().includes(name.toLowerCase()) && v.lang.replace('_', '-').startsWith('en')
    );
    if (found) return found;
  }

  // 2. Try any Enhanced / Premium / Natural voice matching language
  const naturalVoice = availableVoices.find(
    (v) =>
      v.lang.replace('_', '-').startsWith(targetPrefix) &&
      (v.name.includes('Natural') || v.name.includes('Enhanced') || v.name.includes('Premium'))
  );
  if (naturalVoice) return naturalVoice;

  // 3. Any voice matching language code exactly
  const exactMatch = availableVoices.find(
    (v) => v.lang.replace('_', '-') === targetCode || v.lang.replace('_', '-').startsWith(targetCode)
  );
  if (exactMatch) return exactMatch;

  // 4. Any English voice
  return availableVoices.find((v) => v.lang.startsWith('en')) || null;
}

/**
 * Play speech using SpeechSynthesis with optimized tone & rate
 */
function playSpeechSynthesis(
  text: string,
  dialect: 'en-gb' | 'en-us',
  callbacks?: PlaybackCallbacks
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks?.onError?.(new Error('SpeechSynthesis not supported'));
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = dialect === 'en-gb' ? 'en-GB' : 'en-US';
  utterance.rate = 0.92; // Natural, clear cadence
  utterance.pitch = 1.0;

  const voice = getBestVoice(dialect);
  if (voice) {
    utterance.voice = voice;
  }

  if (callbacks?.onStart) utterance.onstart = callbacks.onStart;
  if (callbacks?.onEnd) utterance.onend = callbacks.onEnd;
  if (callbacks?.onError) utterance.onerror = callbacks.onError;

  window.speechSynthesis.speak(utterance);
}

/**
 * Main Speak Word API:
 * Tries authentic studio recording first, seamlessly falls back to enhanced SpeechSynthesis.
 */
export async function speakWord(
  text: string,
  dialect: 'en-gb' | 'en-us' = 'en-us',
  callbacks?: PlaybackCallbacks
): Promise<void> {
  if (!text || typeof window === 'undefined') return;

  // Stop any previous audio
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  // Check if text is a single word or short phrase eligible for human recording
  const isSimpleWord = /^[a-zA-Z\s-]+$/.test(text.trim()) && text.trim().split(/\s+/).length <= 2;

  if (isSimpleWord) {
    try {
      callbacks?.onStart?.();
      const humanAudioUrl = await fetchHumanAudioUrl(text, dialect);

      if (humanAudioUrl) {
        const audio = new Audio(humanAudioUrl);
        currentAudioElement = audio;

        audio.onended = () => {
          currentAudioElement = null;
          callbacks?.onEnd?.();
        };

        audio.onerror = () => {
          // Fall back to high quality SpeechSynthesis
          currentAudioElement = null;
          playSpeechSynthesis(text, dialect, callbacks);
        };

        await audio.play();
        return;
      }
    } catch {
      // Fallback
    }
  }

  // Fallback to high-quality SpeechSynthesis
  playSpeechSynthesis(text, dialect, callbacks);
}
