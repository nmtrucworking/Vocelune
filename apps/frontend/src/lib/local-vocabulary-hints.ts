import type { CEFRLevel, PartOfSpeech } from '@/types';

// Local suggestions are unverified editorial hints, not a licensed Oxford list.
export const COMMON_WORD_KNOWLEDGE: Record<string, { vi: string; cefr: CEFRLevel; pos?: PartOfSpeech; defEn?: string; egEn?: string; ipa?: string }> = {
  abandon: { vi: 'Từ bỏ, bỏ rơi, dừng giữa chừng', cefr: 'B2', pos: 'verb', ipa: '/əˈbændən/', defEn: 'To leave a place, thing, or person forever.', egEn: 'They had to abandon the sinking ship.' },
  resilient: { vi: 'Kiên cường, có khả năng phục hồi nhanh chóng', cefr: 'C1', pos: 'adjective', ipa: '/rɪˈzɪljənt/', defEn: 'Able to quickly become strong or healthy again after difficulty.', egEn: 'Local businesses have proven remarkably resilient.' },
  comprehensive: { vi: 'Toàn diện, bao quát mọi mặt', cefr: 'B2', pos: 'adjective', ipa: '/ˌkɑːmprɪˈhensɪv/', defEn: 'Complete and including everything that is necessary.', egEn: 'The team conducted a comprehensive review of the project.' },
  mitigate: { vi: 'Làm giảm nhẹ, giảm thiểu rủi ro', cefr: 'C1', pos: 'verb', ipa: '/ˈmɪtɪɡeɪt/', defEn: 'To make something less harmful or severe.', egEn: 'We must act swiftly to mitigate climate change risks.' },
  feasible: { vi: 'Khả thi, có thể thực hiện được', cefr: 'B2', pos: 'adjective', ipa: '/ˈfiːzəbəl/', defEn: 'Able to be made, done, or achieved successfully.', egEn: 'The solar transition is economically feasible.' },
  lucrative: { vi: 'Sinh lợi cao, mang lại nhiều tiền của', cefr: 'C1', pos: 'adjective', ipa: '/ˈluːkrətɪv/', defEn: 'Producing a lot of money; profitable.', egEn: 'The partnership opened up a lucrative new market.' },
  perseverance: { vi: 'Sự kiên trì, bền chí, quyết tâm', cefr: 'B2', pos: 'noun', ipa: '/ˌpɜːrsəˈvɪrəns/', defEn: 'Continued effort to achieve something despite difficulties.', egEn: 'Language mastery requires daily perseverance.' },
  ubiquitous: { vi: 'Có mặt ở khắp mọi nơi, phổ biến rộng rãi', cefr: 'C1', pos: 'adjective', ipa: '/juːˈbɪkwɪtəs/', defEn: 'Seeming to be everywhere at the same time.', egEn: 'Smartphones have become ubiquitous in modern society.' },
  paradigm: { vi: 'Mô hình, chuẩn mực, hệ hình tư duy', cefr: 'C1', pos: 'noun', ipa: '/ˈpærədaɪm/', defEn: 'A model or typical pattern of ideas and beliefs.', egEn: 'AI represents a paradigm shift in education.' },
  articulate: { vi: 'Ăn nói lưu loát, hoạt ngôn, mạch lạc', cefr: 'B2', pos: 'adjective', ipa: '/ɑːrˈtɪkjələt/', defEn: 'Able to express thoughts clearly and effectively.', egEn: 'She is an articulate and persuasive presenter.' },
  leverage: { vi: 'Tận dụng, phát huy tối đa đòn bẩy', cefr: 'C1', pos: 'verb', ipa: '/ˈlevərɪdʒ/', defEn: 'To use something to achieve greater advantage.', egEn: 'The team leveraged their early community to expand.' },
  pragmatic: { vi: 'Thực tế, thực dụng theo nghĩa tích cực', cefr: 'B2', pos: 'adjective', ipa: '/præɡˈmætɪk/', defEn: 'Solving problems in a sensible and practical way.', egEn: 'We need a pragmatic approach to the budget.' },
  ephemeral: { vi: 'Phù du, chóng tàn, ngắn ngủi', cefr: 'C1', pos: 'adjective', ipa: '/ɪˈfemərəl/', defEn: 'Lasting for only a short time; transitory.', egEn: 'Fame in modern media is often ephemeral.' },
  serendipity: { vi: 'Sự tình cờ may mắn, cái duyên tốt lành', cefr: 'C1', pos: 'noun', ipa: '/ˌserənˈdɪpəti/', defEn: 'Pleasant coincidence; finding good things without seeking.', egEn: 'Finding this quiet cafe was pure serendipity.' },
  diligent: { vi: 'Cần cù, siêng năng, chu đáo tỉ mỉ', cefr: 'B2', pos: 'adjective', ipa: '/ˈdɪlɪdʒənt/', defEn: 'Done in a careful and detailed way; hardworking.', egEn: 'He is a diligent student who reviews every day.' },
};

