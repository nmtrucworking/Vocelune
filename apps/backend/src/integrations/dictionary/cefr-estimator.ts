import { cefr } from '../../vocabulary/vocabulary.service';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'unknown';

// Curated high-accuracy CEFR wordlist anchors (Oxford 3000 / Cambridge base)
const A1_ANCHORS = new Set([
  'a', 'about', 'above', 'across', 'action', 'activity', 'actor', 'actress', 'add', 'address', 'adult', 'advice',
  'afraid', 'after', 'afternoon', 'again', 'age', 'ago', 'agree', 'air', 'airport', 'all', 'also', 'always',
  'and', 'animal', 'answer', 'any', 'apple', 'april', 'area', 'arm', 'around', 'arrive', 'art', 'artist',
  'as', 'ask', 'at', 'august', 'aunt', 'autumn', 'away', 'baby', 'back', 'bad', 'bag', 'ball', 'banana', 'band',
  'bank', 'bar', 'baseball', 'basketball', 'bath', 'bathroom', 'be', 'beach', 'beautiful', 'because', 'become',
  'bed', 'bedroom', 'beer', 'before', 'begin', 'behind', 'believe', 'below', 'best', 'better', 'between', 'bicycle',
  'big', 'bike', 'bill', 'bird', 'birthday', 'black', 'blog', 'blonde', 'blue', 'boat', 'body', 'book', 'boot',
  'bored', 'boring', 'born', 'both', 'bottle', 'box', 'boy', 'boyfriend', 'bread', 'break', 'breakfast', 'bring',
  'brother', 'brown', 'build', 'building', 'bus', 'business', 'busy', 'but', 'butter', 'buy', 'by', 'bye', 'cafe',
  'cake', 'call', 'camera', 'can', 'cannot', 'capital', 'car', 'card', 'career', 'carrot', 'carry', 'cat', 'catch',
  'celebrate', 'chair', 'change', 'cheap', 'cheese', 'chicken', 'child', 'children', 'chocolate', 'choose', 'cinema',
  'city', 'class', 'classroom', 'clean', 'clever', 'clock', 'close', 'clothes', 'cloud', 'cloudy', 'coat', 'coffee',
  'cold', 'college', 'color', 'come', 'common', 'company', 'computer', 'conversation', 'cook', 'cooking', 'cool',
  'corner', 'cost', 'country', 'countryside', 'cousin', 'cow', 'cream', 'cup', 'cut', 'dad', 'dance', 'dancer',
  'dancing', 'dark', 'date', 'daughter', 'day', 'dear', 'december', 'decide', 'delicious', 'describe', 'desk',
  'detail', 'dictionary', 'die', 'diet', 'difference', 'different', 'difficult', 'dinner', 'dirty', 'discuss',
  'dish', 'do', 'doctor', 'dog', 'dollar', 'door', 'down', 'draw', 'drawing', 'dress', 'drink', 'drive', 'driver',
  'dry', 'during', 'each', 'early', 'earth', 'easily', 'east', 'easy', 'eat', 'egg', 'eight', 'eighteen', 'eighty',
  'elephant', 'eleven', 'else', 'email', 'end', 'engine', 'engineer', 'enjoy', 'enough', 'enter', 'especially',
  'euro', 'even', 'evening', 'event', 'ever', 'every', 'everybody', 'everyone', 'everything', 'everywhere',
  'exam', 'example', 'excited', 'exciting', 'exercise', 'expensive', 'explain', 'extra', 'eye', 'face', 'fact',
  'fall', 'family', 'famous', 'fan', 'far', 'farm', 'farmer', 'fast', 'fat', 'father', 'favorite', 'february',
  'feel', 'feeling', 'festival', 'few', 'fifteen', 'fifth', 'fifty', 'film', 'final', 'find', 'fine', 'finish',
  'fire', 'first', 'fish', 'fit', 'five', 'flat', 'flight', 'floor', 'flower', 'fly', 'food', 'foot', 'football',
  'for', 'foreign', 'forest', 'forget', 'fork', 'form', 'forty', 'four', 'fourteen', 'fourth', 'free', 'fresh',
  'friday', 'fridge', 'friend', 'friendly', 'from', 'front', 'fruit', 'full', 'fun', 'funny', 'future', 'game',
  'garden', 'gas', 'gate', 'geography', 'get', 'girl', 'girlfriend', 'give', 'glad', 'glass', 'glasses', 'glove',
  'go', 'goal', 'good', 'goodbye', 'grandfather', 'grandmother', 'grandparent', 'grass', 'great', 'green', 'grey',
  'group', 'grow', 'guitar', 'guy', 'hair', 'half', 'hand', 'happen', 'happy', 'hard', 'hat', 'hate', 'have',
  'he', 'head', 'hear', 'heart', 'heavy', 'hello', 'help', 'her', 'here', 'hers', 'high', 'hill', 'him', 'his',
  'history', 'hobby', 'holiday', 'home', 'homework', 'hope', 'horse', 'hospital', 'hot', 'hotel', 'hour', 'house',
  'how', 'however', 'hundred', 'hungry', 'husband', 'i', 'ice', 'idea', 'if', 'ill', 'important', 'improve', 'in',
  'include', 'information', 'insect', 'inside', 'instead', 'instructions', 'instrument', 'interested', 'interesting',
  'internet', 'into', 'invitation', 'invite', 'island', 'it', 'its', 'jacket', 'january', 'jeans', 'job', 'join',
  'journey', 'juice', 'july', 'jump', 'june', 'just', 'keep', 'key', 'kid', 'kilometer', 'kind', 'king', 'kitchen',
  'knife', 'know', 'lake', 'lamp', 'language', 'large', 'last', 'late', 'later', 'laugh', 'learn', 'leave', 'left',
  'leg', 'lesson', 'let', 'letter', 'library', 'lie', 'life', 'light', 'like', 'line', 'lion', 'list', 'listen',
  'little', 'live', 'living', 'long', 'look', 'lose', 'lot', 'love', 'lunch', 'machine', 'magazine', 'main', 'make',
  'man', 'many', 'map', 'march', 'market', 'married', 'match', 'may', 'maybe', 'me', 'meal', 'mean', 'meaning',
  'meat', 'meet', 'meeting', 'member', 'menu', 'message', 'meter', 'midnight', 'mile', 'milk', 'million', 'minute',
  'miss', 'mistake', 'modern', 'moment', 'monday', 'money', 'month', 'more', 'morning', 'most', 'mother', 'mountain',
  'mouse', 'mouth', 'move', 'movie', 'much', 'museum', 'music', 'musician', 'must', 'my', 'name', 'national',
  'natural', 'nature', 'near', 'nearly', 'neck', 'need', 'neighbor', 'never', 'new', 'news', 'newspaper', 'next',
  'nice', 'night', 'nine', 'nineteen', 'ninety', 'no', 'nobody', 'noise', 'noon', 'north', 'nose', 'not', 'note',
  'nothing', 'november', 'now', 'number', 'nurse', 'object', 'o\'clock', 'october', 'of', 'off', 'office', 'officer',
  'often', 'oh', 'oil', 'ok', 'old', 'on', 'once', 'one', 'online', 'only', 'open', 'opinion', 'or', 'orange',
  'order', 'other', 'our', 'ours', 'out', 'outside', 'over', 'own', 'page', 'pain', 'paint', 'painter', 'painting',
  'pair', 'paper', 'parent', 'park', 'part', 'partner', 'party', 'pass', 'past', 'pay', 'pen', 'pencil', 'people',
  'pepper', 'perfect', 'period', 'person', 'personal', 'pet', 'phone', 'photo', 'photograph', 'photographer', 'phrase',
  'piano', 'picture', 'piece', 'pig', 'pink', 'place', 'plan', 'plane', 'plant', 'plate', 'play', 'player', 'pleasant',
  'please', 'pleased', 'pocket', 'point', 'police', 'polite', 'poor', 'popular', 'population', 'possible', 'post',
  'poster', 'potato', 'pound', 'practice', 'prefer', 'prepare', 'present', 'pretty', 'price', 'problem', 'program',
  'project', 'put', 'quarter', 'queen', 'question', 'quick', 'quickly', 'quiet', 'radio', 'rain', 'read', 'ready',
  'real', 'really', 'reason', 'receive', 'red', 'relax', 'remember', 'repeat', 'report', 'restaurant', 'return',
  'rice', 'rich', 'ride', 'right', 'ring', 'river', 'road', 'room', 'round', 'run', 'sad', 'safe', 'salad', 'salt',
  'same', 'sandwich', 'saturday', 'say', 'school', 'science', 'scientist', 'sea', 'second', 'section', 'see', 'send',
  'sentence', 'september', 'seven', 'seventeen', 'seventy', 'share', 'she', 'sheep', 'shirt', 'shoe', 'shop', 'short',
  'should', 'show', 'shower', 'sick', 'side', 'simple', 'sing', 'singer', 'sister', 'sit', 'site', 'six', 'sixteen',
  'sixty', 'size', 'skill', 'skirt', 'sleep', 'slow', 'small', 'smart', 'smoke', 'snow', 'so', 'sock', 'sofa',
  'some', 'somebody', 'someone', 'something', 'sometimes', 'somewhere', 'son', 'song', 'soon', 'sorry', 'sound',
  'soup', 'south', 'space', 'speak', 'special', 'spell', 'spend', 'sport', 'spring', 'stand', 'star', 'start',
  'station', 'stay', 'steak', 'still', 'stop', 'store', 'story', 'street', 'strong', 'student', 'study', 'style',
  'subject', 'success', 'successful', 'sugar', 'summer', 'sun', 'sunday', 'supermarket', 'sure', 'surprise',
  'sweet', 'swim', 'table', 'take', 'talk', 'tall', 'tea', 'teach', 'teacher', 'team', 'teenager', 'telephone',
  'television', 'tell', 'ten', 'tennis', 'terrible', 'test', 'text', 'than', 'thank', 'thanks', 'that', 'the',
  'theater', 'their', 'theirs', 'them', 'then', 'there', 'these', 'they', 'thick', 'thin', 'thing', 'think',
  'third', 'thirsty', 'thirteen', 'thirty', 'this', 'those', 'though', 'thought', 'thousand', 'three', 'through',
  'thursday', 'ticket', 'tidy', 'time', 'tired', 'to', 'today', 'together', 'toilet', 'tomorrow', 'tonight', 'too',
  'tooth', 'top', 'total', 'tour', 'tourist', 'town', 'traffic', 'train', 'travel', 'tree', 'trip', 'trousers',
  'true', 'try', 'tuesday', 'turn', 'twelve', 'twenty', 'twice', 'two', 'umbrella', 'uncle', 'under', 'understand',
  'university', 'until', 'up', 'us', 'use', 'useful', 'usually', 'vacation', 'vegetable', 'very', 'video', 'village',
  'visit', 'visitor', 'wait', 'waiter', 'waitress', 'wake', 'walk', 'wall', 'want', 'warm', 'wash', 'watch', 'water',
  'way', 'we', 'wear', 'weather', 'website', 'wednesday', 'week', 'weekend', 'welcome', 'well', 'west', 'what',
  'when', 'where', 'which', 'white', 'who', 'why', 'wife', 'will', 'win', 'wind', 'window', 'wine', 'winter',
  'with', 'without', 'woman', 'wonderful', 'wood', 'word', 'work', 'worker', 'world', 'worry', 'would', 'write',
  'writer', 'wrong', 'year', 'yellow', 'yes', 'yesterday', 'you', 'young', 'your', 'yours', 'zoo',
]);

const ADVANCED_C1_C2_KEYWORDS = new Set([
  'ubiquitous', 'serendipity', 'paradigm', 'articulate', 'leverage', 'mitigate', 'ephemeral', 'lucrative',
  'resilient', 'quintessence', 'idiosyncratic', 'obfuscate', 'pragmatic', 'juxtaposition', 'concomitant',
  'ubiquity', 'pernicious', 'esoteric', 'anachronistic', 'cacophony', 'enervate', 'epiphany', 'fastidious',
  'garrulous', 'harangue', 'iconoclast', 'laconic', 'maverick', 'nefarious', 'ostentatious', 'panacea',
  'quixotic', 'recalcitrant', 'sycophant', 'taciturn', 'vicarious', 'zealot', 'benchmark', 'infrastructure',
  'scalability', 'concurrency', 'optimization', 'architecture', 'orchestration', 'asynchronous', 'heuristic',
  'probabilistic', 'deterministic', 'cryptographic', 'virtualization', 'microservices', 'telemetry',
]);

/**
 * Estimates the CEFR level of an English word or phrase using:
 * 1. Curated Oxford / Cambridge anchor lists
 * 2. Datamuse corpus word frequency metrics (parts-per-million)
 * 3. Morphological & Lexical complexity heuristics (multi-word, technical affixes, syllable count)
 */
export async function estimateWordCefr(
  rawWord: string,
  partOfSpeech?: string,
  definitionEn?: string
): Promise<{ cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; confidence: 'high' | 'medium' | 'estimated'; source: string; reasoning: string }> {
  const word = rawWord.trim().toLowerCase().replace(/[()]/g, '').trim();
  if (!word) {
    return { cefr: 'B1', confidence: 'estimated', source: 'default', reasoning: 'Từ trống, mặc định B1' };
  }

  // 1. Direct Anchor Check (Instant High Confidence)
  if (A1_ANCHORS.has(word)) {
    return {
      cefr: 'A1',
      confidence: 'high',
      source: 'oxford_3000_anchor',
      reasoning: 'Nằm trong danh mục từ vựng thiết yếu sơ cấp A1 theo chuẩn Oxford/Cambridge.',
    };
  }

  if (ADVANCED_C1_C2_KEYWORDS.has(word)) {
    return {
      cefr: 'C1',
      confidence: 'high',
      source: 'advanced_lexicon',
      reasoning: 'Thuật ngữ học thuật / chuyên sâu cấp độ C1.',
    };
  }

  // Multi-word technical phrase detection (e.g., "central processing unit", "random access memory")
  const tokens = word.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) {
    return {
      cefr: 'B2',
      confidence: 'medium',
      source: 'compound_phrase_heuristic',
      reasoning: 'Cụm từ ghép chuyên ngành phức hợp (3 từ trở lên), phân loại B2.',
    };
  }

  // 2. Query Datamuse frequency API for quantitative corpus prevalence
  let freqScore: number | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const lookupWord = tokens[0] || word;
    const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(lookupWord)}&qe=sp&md=dfrp`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data.find((d: any) => d.word?.toLowerCase() === lookupWord) || data[0];
        const freqTag = item?.tags?.find((t: string) => t.startsWith('f:'));
        if (freqTag) {
          const val = parseFloat(freqTag.replace('f:', ''));
          if (!isNaN(val)) freqScore = val;
        }
      }
    }
  } catch {
    // Frequency query timed out or offline, proceed to morphological heuristic
  }

  // 3. Map Frequency Score to CEFR
  if (freqScore !== null) {
    if (freqScore >= 75) {
      return {
        cefr: 'A2',
        confidence: 'high',
        source: 'corpus_frequency',
        reasoning: `Tần suất xuất hiện rất cao trong kho ngữ liệu (${freqScore.toFixed(1)}/triệu từ), cấp độ A2.`,
      };
    }
    if (freqScore >= 20) {
      return {
        cefr: 'B1',
        confidence: 'high',
        source: 'corpus_frequency',
        reasoning: `Tần suất phổ thông trung cấp (${freqScore.toFixed(1)}/triệu từ), cấp độ B1.`,
      };
    }
    if (freqScore >= 4) {
      return {
        cefr: 'B2',
        confidence: 'medium',
        source: 'corpus_frequency',
        reasoning: `Tần suất trung cao cấp (${freqScore.toFixed(1)}/triệu từ), cấp độ B2.`,
      };
    }
    if (freqScore >= 0.6) {
      return {
        cefr: 'C1',
        confidence: 'medium',
        source: 'corpus_frequency',
        reasoning: `Từ học thuật / nâng cao (${freqScore.toFixed(2)}/triệu từ), cấp độ C1.`,
      };
    }
    return {
      cefr: 'C2',
      confidence: 'medium',
      source: 'corpus_frequency',
      reasoning: `Từ rất hiếm hoặc chuyên sâu chuyên biệt (${freqScore.toFixed(2)}/triệu từ), cấp độ C2.`,
    };
  }

  // 4. Morphological & Length Heuristic Fallback
  const cleanWord = tokens.join('');
  const len = cleanWord.length;

  // Complex technical affixes
  if (
    cleanWord.endsWith('ization') ||
    cleanWord.endsWith('ological') ||
    cleanWord.endsWith('iferous') ||
    cleanWord.endsWith('aceous') ||
    cleanWord.startsWith('pseudo') ||
    cleanWord.startsWith('hetero')
  ) {
    return {
      cefr: 'C1',
      confidence: 'estimated',
      source: 'morphological_heuristic',
      reasoning: 'Cấu trúc tiếp đầu/hậu ngữ Hy Lạp - La Tinh nâng cao, phân loại C1.',
    };
  }

  if (len >= 11 || tokens.length >= 2) {
    return {
      cefr: 'B2',
      confidence: 'estimated',
      source: 'length_and_tokens_heuristic',
      reasoning: 'Độ dài từ / từ ghép đa âm tiết, phân loại chuẩn B2.',
    };
  }

  if (len >= 7) {
    return {
      cefr: 'B1',
      confidence: 'estimated',
      source: 'length_heuristic',
      reasoning: 'Độ dài từ trung bình, ước tính cấp độ B1.',
    };
  }

  return {
    cefr: 'A2',
    confidence: 'estimated',
    source: 'baseline_heuristic',
    reasoning: 'Từ đơn giản ngắn gọn, ước tính sơ trung cấp A2.',
  };
}
