import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Database } from '../common/db';
import { config } from '../common/config';

export const checkSentenceSchema = z.object({
  sentence: z.string().trim().min(1).max(1000),
  word: z.string().trim().min(1).max(100),
  meaningVi: z.string().optional(),
  partOfSpeech: z.string().optional(),
  dialect: z.enum(['en-us', 'en-gb']).default('en-us'),
  deckId: z.string().uuid().optional(),
}).strict();

export type CheckSentenceInput = z.infer<typeof checkSentenceSchema>;

export interface SentenceErrorDetail {
  message: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements: string[];
  ruleId?: string;
}

export interface SentenceCheckResult {
  isValid: boolean;
  hasTargetWord: boolean;
  matchedWord?: string;
  grammarCorrect: boolean;
  score: number;
  suggestedRating: 1 | 2 | 3 | 4;
  feedback: string;
  errors: SentenceErrorDetail[];
  correctedSentence: string;
  improvedSentences: string[];
  improvedPhrases: string[];
  analysis: {
    sentenceType: 'sentence' | 'phrase';
    wordCount: number;
    provider: 'gemini' | 'languagetool' | 'heuristic';
  };
}

// Common irregular verbs map: base -> set of irregular forms
const IRREGULAR_VERBS: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  become: ['became', 'becomes', 'becoming'],
  begin: ['began', 'begun', 'begins', 'beginning'],
  break: ['broke', 'broken', 'breaks', 'breaking'],
  bring: ['brought', 'brings', 'bringing'],
  build: ['built', 'builds', 'building'],
  buy: ['bought', 'buys', 'buying'],
  catch: ['caught', 'catches', 'catching'],
  choose: ['chose', 'chosen', 'chooses', 'choosing'],
  come: ['came', 'comes', 'coming'],
  do: ['does', 'did', 'done', 'doing'],
  draw: ['drew', 'drawn', 'draws', 'drawing'],
  drink: ['drank', 'drunk', 'drinks', 'drinking'],
  drive: ['drove', 'driven', 'drives', 'driving'],
  eat: ['ate', 'eaten', 'eats', 'eating'],
  fall: ['fell', 'fallen', 'falls', 'falling'],
  feel: ['felt', 'feels', 'feeling'],
  find: ['found', 'finds', 'finding'],
  fly: ['flew', 'flown', 'flies', 'flying'],
  forget: ['forgot', 'forgotten', 'forgets', 'forgetting'],
  get: ['got', 'gotten', 'gets', 'getting'],
  give: ['gave', 'given', 'gives', 'giving'],
  go: ['goes', 'went', 'gone', 'going'],
  grow: ['grew', 'grown', 'grows', 'growing'],
  have: ['has', 'had', 'having'],
  hear: ['heard', 'hears', 'hearing'],
  hold: ['held', 'holds', 'holding'],
  keep: ['kept', 'keeps', 'keeping'],
  know: ['knew', 'known', 'knows', 'knowing'],
  leave: ['left', 'leaves', 'leaving'],
  lose: ['lost', 'loses', 'losing'],
  make: ['made', 'makes', 'making'],
  meet: ['met', 'meets', 'meeting'],
  pay: ['paid', 'pays', 'paying'],
  read: ['read', 'reads', 'reading'],
  run: ['ran', 'runs', 'running'],
  say: ['said', 'says', 'saying'],
  see: ['saw', 'seen', 'sees', 'seeing'],
  sell: ['sold', 'sells', 'selling'],
  send: ['sent', 'sends', 'sending'],
  sing: ['sang', 'sung', 'sings', 'singing'],
  sit: ['sat', 'sits', 'sitting'],
  sleep: ['slept', 'sleeps', 'sleeping'],
  speak: ['spoke', 'spoken', 'speaks', 'speaking'],
  spend: ['spent', 'spends', 'spending'],
  stand: ['stood', 'stands', 'standing'],
  swim: ['swam', 'swum', 'swims', 'swimming'],
  take: ['took', 'taken', 'takes', 'taking'],
  teach: ['taught', 'teaches', 'teaching'],
  tell: ['told', 'tells', 'telling'],
  think: ['thought', 'thinks', 'thinking'],
  understand: ['understood', 'understands', 'understanding'],
  wear: ['wore', 'worn', 'wears', 'wearing'],
  win: ['won', 'wins', 'winning'],
  write: ['wrote', 'written', 'writes', 'writing'],
};

@Injectable()
export class SentenceCheckerService {
  constructor(@Inject(Database) private db: Database) {}

  /**
   * Main entry point to evaluate a sentence or phrase using the target vocabulary.
   */
  async evaluate(userId: string, body: unknown): Promise<SentenceCheckResult> {
    const input = checkSentenceSchema.parse(body);
    const trimmedSentence = input.sentence.trim();
    const cleanWord = input.word.trim();

    // 1. Detect target word presence (inflections, plurals, tenses, etc.)
    const wordDetection = this.detectTargetWord(trimmedSentence, cleanWord);

    // 2. Determine whether it's a full sentence or a phrase
    const sentenceType = this.classifySentenceType(trimmedSentence);

    // 3. Fetch lexical context from database if available (for collocations & authentic examples)
    const dbExamples = await this.fetchVocabContext(userId, cleanWord);

    // 4. Try AI Evaluation (Gemini) if configured
    if (config.GEMINI_API_KEY) {
      try {
        const geminiResult = await this.evaluateWithGemini(
          trimmedSentence,
          cleanWord,
          input.meaningVi,
          input.partOfSpeech,
          sentenceType,
          wordDetection
        );
        if (geminiResult) {
          // Merge with DB collocations if AI phrases are sparse
          if (geminiResult.improvedPhrases.length === 0 && dbExamples.collocations.length > 0) {
            geminiResult.improvedPhrases = dbExamples.collocations.slice(0, 3);
          }
          return geminiResult;
        }
      } catch (err) {
        // Fall back to LanguageTool / heuristics on error
        console.warn('Gemini sentence evaluation error, falling back to LanguageTool:', err);
      }
    }

    // 5. Try LanguageTool public or self-hosted API
    try {
      const ltResult = await this.evaluateWithLanguageTool(
        trimmedSentence,
        cleanWord,
        sentenceType,
        wordDetection,
        input.dialect,
        dbExamples
      );
      if (ltResult) {
        return ltResult;
      }
    } catch (err) {
      console.warn('LanguageTool evaluation error, falling back to heuristics:', err);
    }

    // 6. Resilient Fallback: Local Heuristic Rule Engine
    return this.evaluateWithHeuristics(
      trimmedSentence,
      cleanWord,
      sentenceType,
      wordDetection,
      input.meaningVi,
      input.partOfSpeech,
      dbExamples
    );
  }

  /**
   * Checks whether the target word (or its lemmas/inflections) is present in the text.
   */
  detectTargetWord(sentence: string, targetWord: string): { found: boolean; matchedWord?: string } {
    const sLower = sentence.toLowerCase();
    const wLower = targetWord.toLowerCase().trim();

    // Case 1: Target is a multi-word phrase or idiom (e.g. "look forward to", "run out of")
    if (wLower.includes(' ')) {
      if (sLower.includes(wLower)) {
        return { found: true, matchedWord: targetWord };
      }
      // Check inflected phrase (e.g. "looked forward to", "looking forward to")
      const words = wLower.split(/\s+/);
      const firstWord = words[0];
      const rest = words.slice(1).join(' ');
      const inflections = this.generateInflections(firstWord);
      for (const inf of inflections) {
        const candidate = `${inf} ${rest}`;
        if (sLower.includes(candidate)) {
          return { found: true, matchedWord: candidate };
        }
      }
      return { found: false };
    }

    // Case 2: Target is a single word
    const tokens = sentence
      .toLowerCase()
      .split(/[^a-zA-Z0-9'-]+/)
      .filter(Boolean);

    const inflections = this.generateInflections(wLower);

    for (const token of tokens) {
      if (token === wLower || inflections.has(token)) {
        return { found: true, matchedWord: token };
      }
      // Stem match for longer words (e.g., perseverance vs persevere)
      if (wLower.length >= 6 && token.length >= 6) {
        const stem = wLower.slice(0, Math.min(wLower.length - 2, 5));
        if (token.startsWith(stem)) {
          return { found: true, matchedWord: token };
        }
      }
    }

    return { found: false };
  }

  /**
   * Generates common English inflections (plural, third-person, past, participle, etc.)
   */
  private generateInflections(word: string): Set<string> {
    const set = new Set<string>();
    set.add(word);

    // Regular s/es
    set.add(word + 's');
    set.add(word + 'es');
    if (word.endsWith('y') && word.length > 2 && !/[aeiou]y$/.test(word)) {
      set.add(word.slice(0, -1) + 'ies');
      set.add(word.slice(0, -1) + 'ied');
    }

    // Regular ed/d
    if (word.endsWith('e')) {
      set.add(word + 'd');
      set.add(word.slice(0, -1) + 'ing');
    } else {
      set.add(word + 'ed');
      set.add(word + 'ing');
      // Consonant doubling (e.g. stop -> stopped, stopping)
      if (/[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnprstvz]$/i.test(word) && word.length <= 6) {
        const lastChar = word.slice(-1);
        set.add(word + lastChar + 'ed');
        set.add(word + lastChar + 'ing');
      }
    }

    // Irregular verb forms
    if (IRREGULAR_VERBS[word]) {
      IRREGULAR_VERBS[word].forEach((f) => set.add(f));
    }

    // Check if word itself is an irregular form of a base verb
    for (const [base, forms] of Object.entries(IRREGULAR_VERBS)) {
      if (forms.includes(word)) {
        set.add(base);
        forms.forEach((f) => set.add(f));
      }
    }

    return set;
  }

  /**
   * Classify whether user entered a full sentence or a phrase.
   */
  classifySentenceType(text: string): 'sentence' | 'phrase' {
    const trimmed = text.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const hasTerminalPunctuation = /[.!?]$/.test(trimmed);

    // If it has terminal punctuation and at least 3 words, likely a sentence
    if (hasTerminalPunctuation && words.length >= 3) {
      return 'sentence';
    }

    // Check for common subject pronouns and verbs
    const hasSubject = /\b(i|you|he|she|it|we|they|this|that|there|my|the|a|an)\b/i.test(trimmed);
    if (words.length >= 4 && hasSubject) {
      return 'sentence';
    }

    return words.length >= 5 ? 'sentence' : 'phrase';
  }

  /**
   * Fetch context (collocations, examples) for the word from user's vocabulary items.
   */
  private async fetchVocabContext(userId: string, word: string) {
    try {
      const items = await this.db.vocabItem.findMany({
        where: {
          userId,
          deletedAt: null,
          lexeme: { normalized: word.toLowerCase() },
        },
        include: { lexeme: true },
        take: 3,
      });

      const examples: string[] = [];
      const collocations: string[] = [];

      for (const item of items) {
        if (item.exampleEn) examples.push(item.exampleEn);
        const meta = item.lexicalMetadata as any;
        if (meta?.collocations && Array.isArray(meta.collocations)) {
          for (const c of meta.collocations) {
            if (typeof c === 'string') collocations.push(c);
            else if (c?.text) collocations.push(c.text);
          }
        }
      }

      return {
        examples: Array.from(new Set(examples)),
        collocations: Array.from(new Set(collocations)),
      };
    } catch {
      return { examples: [], collocations: [] };
    }
  }

  /**
   * Evaluate using Gemini AI (Tier 1)
   */
  private async evaluateWithGemini(
    sentence: string,
    targetWord: string,
    meaningVi: string | undefined,
    partOfSpeech: string | undefined,
    sentenceType: 'sentence' | 'phrase',
    wordDetection: { found: boolean; matchedWord?: string }
  ): Promise<SentenceCheckResult | null> {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const prompt = `You are an expert English language assessor for Vietnamese students learning English vocabulary.
The student was tasked with writing a ${sentenceType} in English using the target vocabulary word: "${targetWord}"${partOfSpeech ? ` (${partOfSpeech})` : ''}${meaningVi ? ` meaning "${meaningVi}"` : ''}.

Student's input: "${sentence}"

Analyze the input thoroughly:
1. Did the student use the target word "${targetWord}" or an acceptable grammatical inflection? (hasTargetWord: boolean, matchedWord: string)
2. Is the grammar, syntax, spelling, and preposition usage correct? If it is a phrase, do not penalize for missing subject or ending period.
3. If there are errors, identify each error with: message (clear explanation in Vietnamese), offset (0-based start char index in the student's input), length (char count), replacements (array of 1-3 correct suggestions).
4. Provide the fully corrected sentence/phrase (correctedSentence).
5. Provide 2 natural, native-level complete example sentences using "${targetWord}" (improvedSentences).
6. Provide 2-3 natural collocations or common phrases using "${targetWord}" (improvedPhrases).
7. Provide a friendly, constructive feedback summary in Vietnamese (feedback).
8. Calculate score (0-100) and suggested FSRS rating (1 = Again/Needs Work, 2 = Hard, 3 = Good, 4 = Easy/Excellent).

Return ONLY a valid JSON object with this exact shape:
{
  "hasTargetWord": boolean,
  "matchedWord": string,
  "grammarCorrect": boolean,
  "score": number,
  "suggestedRating": 1 | 2 | 3 | 4,
  "feedback": string,
  "errors": [
    {
      "message": string,
      "shortMessage": string,
      "offset": number,
      "length": number,
      "replacements": string[]
    }
  ],
  "correctedSentence": string,
  "improvedSentences": string[],
  "improvedPhrases": string[]
}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);
      if (!response.ok) return null;

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      const parsed = JSON.parse(rawText);
      const errors = Array.isArray(parsed.errors)
        ? parsed.errors.map((e: any) => ({
            message: String(e.message || ''),
            shortMessage: e.shortMessage ? String(e.shortMessage) : undefined,
            offset: Number(e.offset ?? 0),
            length: Number(e.length ?? 0),
            replacements: Array.isArray(e.replacements) ? e.replacements.map(String) : [],
          }))
        : [];

      const hasWord = Boolean(parsed.hasTargetWord || wordDetection.found);
      const grammarCorrect = Boolean(parsed.grammarCorrect && errors.length === 0);
      const score = Math.max(0, Math.min(100, Number(parsed.score || (grammarCorrect ? 95 : 60))));

      let rating: 1 | 2 | 3 | 4 = (parsed.suggestedRating as 1 | 2 | 3 | 4) || 3;
      if (![1, 2, 3, 4].includes(rating)) {
        rating = score >= 90 ? 4 : score >= 75 ? 3 : score >= 50 ? 2 : 1;
      }

      return {
        isValid: hasWord && grammarCorrect,
        hasTargetWord: hasWord,
        matchedWord: parsed.matchedWord || wordDetection.matchedWord || targetWord,
        grammarCorrect,
        score,
        suggestedRating: rating,
        feedback: parsed.feedback || (grammarCorrect ? 'Ngữ pháp chính xác và sử dụng từ rất tự nhiên!' : 'Có một vài điểm ngữ pháp cần lưu ý.'),
        errors,
        correctedSentence: parsed.correctedSentence || sentence,
        improvedSentences: Array.isArray(parsed.improvedSentences) && parsed.improvedSentences.length > 0
          ? parsed.improvedSentences
          : [sentence],
        improvedPhrases: Array.isArray(parsed.improvedPhrases) && parsed.improvedPhrases.length > 0
          ? parsed.improvedPhrases
          : [`use ${targetWord} in daily context`],
        analysis: {
          sentenceType,
          wordCount: sentence.split(/\s+/).filter(Boolean).length,
          provider: 'gemini',
        },
      };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  /**
   * Evaluate using LanguageTool Public/Private API (Tier 2)
   */
  private async evaluateWithLanguageTool(
    sentence: string,
    targetWord: string,
    sentenceType: 'sentence' | 'phrase',
    wordDetection: { found: boolean; matchedWord?: string },
    dialect: 'en-us' | 'en-gb',
    dbExamples: { examples: string[]; collocations: string[] }
  ): Promise<SentenceCheckResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const langCode = dialect === 'en-gb' ? 'en-GB' : 'en-US';
    const params = new URLSearchParams({
      text: sentence,
      language: langCode,
    });

    try {
      const response = await fetch(config.LANGUAGETOOL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) return null;

      const data = await response.json();
      const rawMatches: any[] = Array.isArray(data.matches) ? data.matches : [];

      // Filter matches that are irrelevant for phrases (e.g. uppercase first letter or ending period)
      const filteredMatches = rawMatches.filter((m) => {
        const ruleId = m.rule?.id || '';
        if (sentenceType === 'phrase') {
          if (ruleId === 'UPPERCASE_SENTENCE_START') return false;
          if (ruleId.includes('PUNCTUATION_PARAGRAPH_END')) return false;
          if (m.ignoreForIncompleteSentence) return false;
        }
        return true;
      });

      // Construct errors list with Vietnamese translation
      const errors: SentenceErrorDetail[] = filteredMatches.map((m) => {
        const replacements = Array.isArray(m.replacements)
          ? m.replacements.slice(0, 3).map((r: any) => (typeof r === 'string' ? r : r.value))
          : [];
        return {
          message: this.translateLanguageToolMessage(m),
          shortMessage: m.shortMessage || 'Lỗi ngữ pháp/chính tả',
          offset: m.offset,
          length: m.length,
          replacements,
          ruleId: m.rule?.id,
        };
      });

      // Construct corrected sentence
      let correctedSentence = sentence;
      const sortedForReplace = [...filteredMatches].sort((a, b) => b.offset - a.offset);
      for (const m of sortedForReplace) {
        if (m.replacements && m.replacements.length > 0) {
          const rep = typeof m.replacements[0] === 'string' ? m.replacements[0] : m.replacements[0].value;
          correctedSentence =
            correctedSentence.slice(0, m.offset) +
            rep +
            correctedSentence.slice(m.offset + m.length);
        }
      }

      // Calculate score and rating
      const hasWord = wordDetection.found;
      const grammarCorrect = errors.length === 0;

      let score = 100;
      if (!grammarCorrect) {
        score -= errors.length * 18;
      }
      if (!hasWord) {
        score -= 40;
      }
      score = Math.max(10, Math.min(100, score));

      let suggestedRating: 1 | 2 | 3 | 4 = 3;
      if (!hasWord || score < 50) suggestedRating = 1;
      else if (score < 75) suggestedRating = 2;
      else if (score < 92) suggestedRating = 3;
      else suggestedRating = 4;

      // Friendly feedback
      let feedback = '';
      if (!hasWord) {
        feedback = `Chưa tìm thấy từ vựng mục tiêu "${targetWord}" trong câu. Hãy nhớ đưa từ này vào câu của bạn nhé!`;
      } else if (grammarCorrect) {
        feedback = `Xuất sắc! Câu của bạn chuẩn ngữ pháp và đã dùng chính xác từ vựng "${wordDetection.matchedWord || targetWord}".`;
      } else {
        feedback = `Bạn đã sử dụng đúng từ vựng "${wordDetection.matchedWord || targetWord}", nhưng có ${errors.length} điểm ngữ pháp cần điều chỉnh.`;
      }

      // Improved sentences and phrases
      const improvedSentences = this.buildImprovedSentences(targetWord, sentence, dbExamples.examples);
      const improvedPhrases = this.buildImprovedPhrases(targetWord, dbExamples.collocations);

      return {
        isValid: hasWord && grammarCorrect,
        hasTargetWord: hasWord,
        matchedWord: wordDetection.matchedWord || targetWord,
        grammarCorrect,
        score,
        suggestedRating,
        feedback,
        errors,
        correctedSentence,
        improvedSentences,
        improvedPhrases,
        analysis: {
          sentenceType,
          wordCount: sentence.split(/\s+/).filter(Boolean).length,
          provider: 'languagetool',
        },
      };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  /**
   * Resilient Fallback: Local Heuristic Rule Engine (Tier 3)
   */
  private evaluateWithHeuristics(
    sentence: string,
    targetWord: string,
    sentenceType: 'sentence' | 'phrase',
    wordDetection: { found: boolean; matchedWord?: string },
    meaningVi: string | undefined,
    partOfSpeech: string | undefined,
    dbExamples: { examples: string[]; collocations: string[] }
  ): SentenceCheckResult {
    const errors: SentenceErrorDetail[] = [];
    let corrected = sentence;

    // Rule 1: Capitalize sentence start if it's a sentence
    if (sentenceType === 'sentence' && /^[a-z]/.test(sentence)) {
      errors.push({
        message: 'Đầu câu nên được viết hoa.',
        shortMessage: 'Viết hoa',
        offset: 0,
        length: 1,
        replacements: [sentence[0].toUpperCase()],
        ruleId: 'CAPITALIZATION',
      });
      corrected = sentence[0].toUpperCase() + sentence.slice(1);
    }

    // Rule 2: Standalone lowercase "i" -> "I"
    const iRegex = /\b(i)\b/g;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = iRegex.exec(sentence)) !== null) {
      errors.push({
        message: 'Đại từ nhân xưng "I" phải luôn luôn viết hoa.',
        shortMessage: 'Viết hoa đại từ I',
        offset: iMatch.index,
        length: 1,
        replacements: ['I'],
        ruleId: 'UPPERCASE_I',
      });
      corrected = corrected.slice(0, iMatch.index) + 'I' + corrected.slice(iMatch.index + 1);
    }

    // Rule 3: Common subject-verb mismatches (e.g., "he do", "she have", "they is", "i goes")
    const agreementRules = [
      { regex: /\b(he|she|it)\s+(do)\b/gi, fix: 'does', msg: 'Chủ ngữ ngôi thứ ba số ít đi với "does" thay vì "do".' },
      { regex: /\b(he|she|it)\s+(have)\b/gi, fix: 'has', msg: 'Chủ ngữ ngôi thứ ba số ít đi với "has" thay vì "have".' },
      { regex: /\b(they|we|you)\s+(is)\b/gi, fix: 'are', msg: 'Chủ ngữ số nhiều đi với "are" thay vì "is".' },
      { regex: /\b(they|we|you)\s+(was)\b/gi, fix: 'were', msg: 'Chủ ngữ số nhiều ở quá khứ đi với "were" thay vì "was".' },
      { regex: /\b(i)\s+(goes|does|has|is)\b/gi, fix: (m: string) => m.replace(/goes/i, 'go').replace(/does/i, 'do').replace(/has/i, 'have').replace(/is/i, 'am'), msg: 'Lỗi hòa hợp chủ vị với đại từ "I".' },
    ];

    for (const rule of agreementRules) {
      let m: RegExpExecArray | null;
      while ((m = rule.regex.exec(sentence)) !== null) {
        const replacement = typeof rule.fix === 'function' ? rule.fix(m[0]) : m[0].replace(new RegExp(m[2], 'i'), rule.fix);
        errors.push({
          message: rule.msg,
          shortMessage: 'Hòa hợp chủ vị',
          offset: m.index,
          length: m[0].length,
          replacements: [replacement],
          ruleId: 'SUBJECT_VERB_AGREEMENT',
        });
      }
    }

    // Rule 4: Article "a" vs "an" before vowel sounds
    const aAnRegex = /\b(a)\s+([aeiou][a-z]+)\b/gi;
    let aAnMatch: RegExpExecArray | null;
    while ((aAnMatch = aAnRegex.exec(sentence)) !== null) {
      errors.push({
        message: `Dùng "an" thay vì "a" trước từ "${aAnMatch[2]}" bắt đầu bằng một nguyên âm.`,
        shortMessage: 'Mạo từ an/a',
        offset: aAnMatch.index,
        length: aAnMatch[1].length,
        replacements: ['an'],
        ruleId: 'A_VS_AN',
      });
    }

    // Rule 5: Repeated words (e.g. "the the")
    const repeatRegex = /\b([a-zA-Z]+)\s+\1\b/gi;
    let repMatch: RegExpExecArray | null;
    while ((repMatch = repeatRegex.exec(sentence)) !== null) {
      errors.push({
        message: `Từ "${repMatch[1]}" bị lặp lại hai lần liên tiếp.`,
        shortMessage: 'Lặp từ',
        offset: repMatch.index,
        length: repMatch[0].length,
        replacements: [repMatch[1]],
        ruleId: 'WORD_REPEAT',
      });
    }

    const hasWord = wordDetection.found;
    const grammarCorrect = errors.length === 0;

    let score = 95;
    if (!grammarCorrect) score -= errors.length * 20;
    if (!hasWord) score -= 45;
    score = Math.max(20, Math.min(100, score));

    let suggestedRating: 1 | 2 | 3 | 4 = 3;
    if (!hasWord || score < 50) suggestedRating = 1;
    else if (score < 75) suggestedRating = 2;
    else if (score < 90) suggestedRating = 3;
    else suggestedRating = 4;

    const feedback = !hasWord
      ? `Chưa tìm thấy từ vựng mục tiêu "${targetWord}" trong câu của bạn.`
      : grammarCorrect
      ? `Câu chuẩn xác! Bạn đã đặt câu thành công với từ "${wordDetection.matchedWord || targetWord}".`
      : `Đã dùng đúng từ "${wordDetection.matchedWord || targetWord}", hãy xem các gợi ý sửa lỗi bên dưới nhé.`;

    const improvedSentences = this.buildImprovedSentences(targetWord, sentence, dbExamples.examples);
    const improvedPhrases = this.buildImprovedPhrases(targetWord, dbExamples.collocations);

    return {
      isValid: hasWord && grammarCorrect,
      hasTargetWord: hasWord,
      matchedWord: wordDetection.matchedWord || targetWord,
      grammarCorrect,
      score,
      suggestedRating,
      feedback,
      errors,
      correctedSentence: corrected,
      improvedSentences,
      improvedPhrases,
      analysis: {
        sentenceType,
        wordCount: sentence.split(/\s+/).filter(Boolean).length,
        provider: 'heuristic',
      },
    };
  }

  /**
   * Helper to build authentic improved sentences
   */
  private buildImprovedSentences(targetWord: string, userSentence: string, dbExamples: string[]): string[] {
    const list: string[] = [];
    if (dbExamples && dbExamples.length > 0) {
      list.push(...dbExamples.slice(0, 2));
    }
    if (list.length === 0) {
      const cap = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
      list.push(`It is essential to understand how to use ${targetWord} in professional communication.`);
      list.push(`${cap} plays an important role in achieving long-term success.`);
    }
    return list.slice(0, 2);
  }

  /**
   * Helper to build improved collocations / phrases
   */
  private buildImprovedPhrases(targetWord: string, dbCollocations: string[]): string[] {
    const list: string[] = [];
    if (dbCollocations && dbCollocations.length > 0) {
      list.push(...dbCollocations.slice(0, 3));
    }
    if (list.length === 0) {
      list.push(`a key ${targetWord}`);
      list.push(`effectively with ${targetWord}`);
      list.push(`deep understanding of ${targetWord}`);
    }
    return Array.from(new Set(list)).slice(0, 3);
  }

  /**
   * Translates LanguageTool English error messages to friendly Vietnamese
   */
  private translateLanguageToolMessage(match: any): string {
    const ruleId = match.rule?.id || '';
    const msg = match.message || '';

    if (ruleId === 'NON3PRS_VERB') {
      return 'Lỗi hòa hợp chủ vị: Đại từ không dùng với dạng chia động từ ngôi thứ ba số ít.';
    }
    if (ruleId === 'EN_A_VS_AN') {
      return "Sử dụng 'an' thay vì 'a' trước từ bắt đầu bằng một nguyên âm.";
    }
    if (ruleId === 'UPPERCASE_SENTENCE_START') {
      return 'Chữ cái đầu câu nên được viết hoa.';
    }
    if (ruleId === 'ENGLISH_WORD_REPEAT_RULE') {
      return 'Từ này bị lặp lại hai lần liên tiếp.';
    }
    if (ruleId.includes('WHITESPACE') || ruleId.includes('COMMA')) {
      return 'Lưu ý về dấu câu hoặc khoảng cách khoảng trắng.';
    }
    if (ruleId.includes('SPELL') || ruleId.includes('MORFOLOGIK')) {
      return `Có thể sai chính tả từ này. Gợi ý đúng: ${match.replacements?.slice(0, 2).map((r: any) => `"${typeof r === 'string' ? r : r.value}"`).join(', ') || ''}`;
    }

    return msg;
  }
}
