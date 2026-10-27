// Web Speech API helper for native English pronunciation
export function speakWord(text: string, dialect: 'en-gb' | 'en-us' = 'en-us'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = dialect === 'en-gb' ? 'en-GB' : 'en-US';
  utterance.rate = 0.9; // natural cadence for vocabulary learning
  utterance.pitch = 1.0;

  // Attempt to select an authentic English voice
  const voices = window.speechSynthesis.getVoices();
  const targetLang = dialect === 'en-gb' ? 'en-GB' : 'en-US';
  const matchingVoice = voices.find(
    (v) => v.lang.replace('_', '-') === targetLang || v.lang.startsWith(targetLang.split('-')[0])
  );

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  window.speechSynthesis.speak(utterance);
}
