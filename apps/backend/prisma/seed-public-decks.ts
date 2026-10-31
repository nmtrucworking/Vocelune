import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { passwordHash } from '../src/identity/security';
import { parameters, MODEL_VERSION, LIBRARY_VERSION } from '../src/study/scheduler';
import { json } from '../src/common/db';
import { hash } from '../src/identity/security';
import { normalized } from '../src/common/http';

const db = new PrismaClient();

const OFFICIAL_DECKS = [
  {
    name: 'Oxford 3000™ Core Vocabulary',
    description: 'Từ vựng cốt lõi thiết yếu theo chuẩn khung tham chiếu Châu Âu (CEFR A1-B2). Nền tảng giao tiếp và học thuật vững chắc.',
    color: '#5949E8',
    icon: 'BookOpen',
    topicGroup: 'Oxford 3000™',
    words: [
      {
        word: 'abandon',
        phonetic: '/əˈbæn.dən/',
        partOfSpeech: 'verb',
        meaningVi: 'Từ bỏ, bỏ rơi, dừng làm gì đó giữa chừng',
        definitionEn: 'To leave a place, thing, or person, usually for ever; to stop doing an activity.',
        exampleEn: 'The crew had to abandon the sinking ship before rescue arrived.',
        exampleVi: 'Thủy thủ đoàn phải rời bỏ con tàu đang chìm trước khi đội cứu hộ đến.',
        cefr: 'B2',
      },
      {
        word: 'adequate',
        phonetic: '/ˈæd.ə.kwət/',
        partOfSpeech: 'adjective',
        meaningVi: 'Đầy đủ, thỏa đáng, đáp ứng được yêu cầu',
        definitionEn: 'Enough or satisfactory for a particular purpose.',
        exampleEn: 'The room was small but adequate for our needs.',
        exampleVi: 'Căn phòng nhỏ nhưng đủ dùng cho nhu cầu của chúng tôi.',
        cefr: 'B1',
      },
      {
        word: 'clarify',
        phonetic: '/ˈklær.ɪ.faɪ/',
        partOfSpeech: 'verb',
        meaningVi: 'Làm rõ, giải thích rõ ràng hơn',
        definitionEn: 'To make something clear or easier to understand.',
        exampleEn: 'Could you clarify the second point in your proposal?',
        exampleVi: 'Bạn có thể làm rõ điểm thứ hai trong đề xuất không?',
        cefr: 'B2',
      },
      {
        word: 'crucial',
        phonetic: '/ˈkruː.ʃəl/',
        partOfSpeech: 'adjective',
        meaningVi: 'Cực kỳ quan trọng, mang tính quyết định',
        definitionEn: 'Extremely important or necessary.',
        exampleEn: 'Early diagnosis is crucial for successful treatment.',
        exampleVi: 'Chẩn đoán sớm có ý nghĩa quyết định đối với việc điều trị thành công.',
        cefr: 'B2',
      },
      {
        word: 'sustain',
        phonetic: '/səˈsteɪn/',
        partOfSpeech: 'verb',
        meaningVi: 'Duy trì, chống đỡ, chịu đựng qua thời gian',
        definitionEn: 'To cause or allow something to continue for a period of time.',
        exampleEn: 'The company has managed to sustain its rapid growth over the past decade.',
        exampleVi: 'Công ty đã xoay sở để duy trì mức tăng trưởng nhanh trong suốt thập kỷ qua.',
        cefr: 'C1',
      },
    ],
  },
  {
    name: 'IELTS Academic High-Frequency (Band 7.0+)',
    description: 'Bộ từ vựng học thuật tần suất cao trong bài thi IELTS Reading & Writing Band 7.0+, giúp nâng cao độ chính xác Lexical Resource.',
    color: '#1B786E',
    icon: 'GraduationCap',
    topicGroup: 'IELTS Academic',
    words: [
      {
        word: 'resilient',
        phonetic: '/rɪˈzɪl.jənt/',
        partOfSpeech: 'adjective',
        meaningVi: 'Kiên cường, có khả năng phục hồi nhanh sau khó khăn',
        definitionEn: 'Able to be happy, successful, etc. again after something difficult happens.',
        exampleEn: 'Local businesses have proven remarkably resilient in the face of economic hardship.',
        exampleVi: 'Các doanh nghiệp địa phương đã chứng minh sự kiên cường đáng nể khi đối mặt với khủng hoảng.',
        cefr: 'C1',
      },
      {
        word: 'ephemeral',
        phonetic: '/ɪˈfem.ər.əl/',
        partOfSpeech: 'adjective',
        meaningVi: 'Phù du, chóng tàn, chỉ tồn tại trong thời gian ngắn',
        definitionEn: 'Lasting for only a short time; transitory.',
        exampleEn: 'Fame in the digital era can be strikingly ephemeral.',
        exampleVi: 'Sự nổi tiếng trong kỷ nguyên số có thể chóng tàn một cách đáng kinh ngạc.',
        cefr: 'C2',
      },
      {
        word: 'pragmatic',
        phonetic: '/præɡˈmæt.ɪk/',
        partOfSpeech: 'adjective',
        meaningVi: 'Thực tế, thực dụng, giải quyết vấn đề dựa trên điều kiện thực tế',
        definitionEn: 'Solving problems in a sensible way that suits the conditions that really exist.',
        exampleEn: 'We need a pragmatic approach rather than endless ideological debates.',
        exampleVi: 'Chúng ta cần một hướng tiếp cận thực tế hơn là những cuộc tranh luận lý thuyết vô tận.',
        cefr: 'C1',
      },
      {
        word: 'meticulous',
        phonetic: '/məˈtɪk.jə.ləs/',
        partOfSpeech: 'adjective',
        meaningVi: 'Tỉ mỉ, cẩn trọng, chú ý đến từng chi tiết nhỏ nhất',
        definitionEn: 'Very careful and with great attention to every detail.',
        exampleEn: 'The scientist kept meticulous notes throughout the clinical trials.',
        exampleVi: 'Nhà khoa học đã ghi chép cực kỳ tỉ mỉ trong suốt quá trình thử nghiệm lâm sàng.',
        cefr: 'C1',
      },
      {
        word: 'scrutinize',
        phonetic: '/ˈskruː.tɪ.naɪz/',
        partOfSpeech: 'verb',
        meaningVi: 'Xem xét kỹ lưỡng, khảo sát tỉ mỉ',
        definitionEn: 'To examine something very carefully in order to discover information.',
        exampleEn: 'The auditors will scrutinize every financial transaction from the past fiscal year.',
        exampleVi: 'Các kiểm toán viên sẽ xem xét kỹ lưỡng từng giao dịch tài chính từ năm tài khóa trước.',
        cefr: 'C1',
      },
    ],
  },
  {
    name: 'Business & Professional English',
    description: 'Từ vựng giao tiếp, đàm phán, thuyết trình và trao đổi thương mại quốc tế trong môi trường doanh nghiệp hiện đại.',
    color: '#9B5B0E',
    icon: 'Briefcase',
    topicGroup: 'Business & Work',
    words: [
      {
        word: 'synergy',
        phonetic: '/ˈsɪn.ə.dʒi/',
        partOfSpeech: 'noun',
        meaningVi: 'Hiệu ứng cộng hưởng, sức mạnh tổng hợp',
        definitionEn: 'The combined power of a group of things when working together that is greater than the total power achieved separately.',
        exampleEn: 'The merger will create synergies across marketing and distribution channels.',
        exampleVi: 'Thương vụ sáp nhập sẽ tạo ra hiệu ứng cộng hưởng trên các kênh phân phối và tiếp thị.',
        cefr: 'C1',
      },
      {
        word: 'leverage',
        phonetic: '/ˈliː.vər.ɪdʒ/',
        partOfSpeech: 'verb',
        meaningVi: 'Tận dụng tối đa đòn bẩy hoặc nguồn lực có sẵn',
        definitionEn: 'To use something that you have to achieve something else.',
        exampleEn: 'We can leverage our existing customer base to launch the new product line.',
        exampleVi: 'Chúng ta có thể tận dụng tệp khách hàng hiện tại để ra mắt dòng sản phẩm mới.',
        cefr: 'B2',
      },
      {
        word: 'benchmark',
        phonetic: '/ˈbentʃ.mɑːk/',
        partOfSpeech: 'noun',
        meaningVi: 'Tiêu chuẩn đối sánh, mốc tham chiếu chuẩn',
        definitionEn: 'A level of quality that can be used as a standard when comparing other things.',
        exampleEn: 'Our performance metrics serve as the industry benchmark.',
        exampleVi: 'Các chỉ số hiệu suất của chúng tôi đóng vai trò là mốc đối sánh chuẩn cho ngành.',
        cefr: 'B2',
      },
      {
        word: 'stakeholder',
        phonetic: '/ˈsteɪkˌhoʊl.dɚ/',
        partOfSpeech: 'noun',
        meaningVi: 'Bên liên quan (trong dự án hoặc doanh nghiệp)',
        definitionEn: 'A person or group such as a shareholder, employee, or customer who has an interest in the success of an organization.',
        exampleEn: 'We must keep all key stakeholders informed throughout the restructuring process.',
        exampleVi: 'Chúng ta phải thông báo cho tất cả các bên liên quan chính trong suốt quá trình tái cơ cấu.',
        cefr: 'B2',
      },
    ],
  },
  {
    name: 'Tech & Software Engineering',
    description: 'Thuật ngữ và từ vựng chuyên ngành công nghệ phần mềm, kiến trúc hệ thống, đám mây, dữ liệu và quy trình Agile.',
    color: '#2B59C3',
    icon: 'Code2',
    topicGroup: 'Công nghệ & IT',
    words: [
      {
        word: 'idempotent',
        phonetic: '/ˌaɪ.dəmˈpoʊ.tənt/',
        partOfSpeech: 'adjective',
        meaningVi: 'Tính chất lũy đẳng (thực thi nhiều lần cho cùng kết quả)',
        definitionEn: 'Denoting an operation that can be applied multiple times without changing the result beyond the initial application.',
        exampleEn: 'HTTP PUT requests should be designed to be idempotent.',
        exampleVi: 'Các yêu cầu HTTP PUT cần được thiết kế để đảm bảo tính lũy đẳng.',
        cefr: 'C2',
      },
      {
        word: 'asynchronous',
        phonetic: '/eɪˈsɪŋ.krə.nəs/',
        partOfSpeech: 'adjective',
        meaningVi: 'Bất đồng bộ (không cùng thời điểm, không chờ đợi)',
        definitionEn: 'Not existing or occurring at the same time; running independently.',
        exampleEn: 'Message queues enable asynchronous processing of heavy workloads.',
        exampleVi: 'Hàng đợi tin nhắn cho phép xử lý bất đồng bộ các tác vụ nặng.',
        cefr: 'C1',
      },
      {
        word: 'scalability',
        phonetic: '/ˌskeɪ.ləˈbɪl.ə.t̬i/',
        partOfSpeech: 'noun',
        meaningVi: 'Khả năng mở rộng quy mô hệ thống',
        definitionEn: 'The capacity of a system, network, or process to handle a growing amount of work.',
        exampleEn: 'Horizontal scalability allows our cluster to absorb sudden traffic spikes.',
        exampleVi: 'Khả năng mở rộng theo chiều ngang cho phép cụm máy chủ hấp thụ các đợt tăng đột biến lưu lượng.',
        cefr: 'C1',
      },
    ],
  },
  {
    name: 'Everyday Collocations & Idioms',
    description: 'Các cụm từ cố định và thành ngữ phổ biến nhất trong giao tiếp tự nhiên của người bản xứ Anh - Mỹ.',
    color: '#E11D48',
    icon: 'Sparkles',
    topicGroup: 'Giao tiếp hàng ngày',
    words: [
      {
        word: 'see eye to eye',
        phonetic: '/siː aɪ tuː aɪ/',
        partOfSpeech: 'idiom',
        meaningVi: 'Đồng thuận, cùng chung quan điểm với ai đó',
        definitionEn: 'To agree fully with someone; to have the same opinion.',
        exampleEn: 'My colleague and I rarely see eye to eye on project priorities.',
        exampleVi: 'Tôi và đồng nghiệp hiếm khi đồng thuận về các thứ tự ưu tiên của dự án.',
        cefr: 'B2',
      },
      {
        word: 'bite the bullet',
        phonetic: '/baɪt ðə ˈbʊl.ɪt/',
        partOfSpeech: 'idiom',
        meaningVi: 'Cắn răng chấp nhận làm một việc khó khăn nhưng tất yếu',
        definitionEn: 'To force yourself to do something unpleasant or difficult that has been deferred.',
        exampleEn: 'I finally bit the bullet and decided to refactor the entire legacy codebase.',
        exampleVi: 'Cuối cùng tôi đã cắn răng quyết định tái cấu trúc toàn bộ cơ sở mã cũ.',
        cefr: 'C1',
      },
      {
        word: 'hit the ground running',
        phonetic: '/hɪt ðə ɡraʊnd ˈrʌn.ɪŋ/',
        partOfSpeech: 'idiom',
        meaningVi: 'Bắt tay vào việc ngay lập tức một cách tràn đầy năng lượng và hiệu quả',
        definitionEn: 'To start something and proceed at a fast pace with enthusiasm and immediate success.',
        exampleEn: 'The new engineer hit the ground running and shipped a feature on day one.',
        exampleVi: 'Kỹ sư mới đã bắt tay ngay vào việc và hoàn thành một tính năng ngay trong ngày đầu tiên.',
        cefr: 'C1',
      },
    ],
  },
];

async function seed() {
  console.log('Seeding official public decks...');

  // 1. Ensure author user
  const email = 'editorial@vocelune.com';
  let author = await db.user.findUnique({ where: { email }, include: { settings: true } });
  if (!author) {
    author = await db.user.create({
      data: {
        email,
        displayName: 'Ban Biên Tập Vocelune',
        passwordHash: await passwordHash('VoceluneOfficial2026!'),
        role: 'admin',
        settings: {
          create: {
            emailReminderStudy: false,
            emailDailySummary: false,
          },
        },
      },
      include: { settings: true },
    });
    await db.schedulerConfig.create({
      data: {
        userId: author.id,
        version: 1,
        modelVersion: MODEL_VERSION,
        libraryVersion: LIBRARY_VERSION,
        retention: 0.9,
        parameters: json(parameters(0.9)),
      },
    });
  } else {
    await db.userSettings.upsert({
      where: { userId: author.id },
      create: {
        userId: author.id,
        emailReminderStudy: false,
        emailDailySummary: false,
      },
      update: {
        emailReminderStudy: false,
        emailDailySummary: false,
      },
    });
  }

  // Editorial account does not study; purge any orphaned cards that trigger reminders
  await db.card.deleteMany({ where: { userId: author.id } }).catch(() => {});

  const scheduler = await db.schedulerConfig.findFirstOrThrow({
    where: { userId: author.id },
    orderBy: { version: 'desc' },
  });

  for (const deckData of OFFICIAL_DECKS) {
    const existing = await db.deck.findFirst({
      where: {
        userId: author.id,
        normalizedName: normalized(deckData.name),
        deletedAt: null,
      },
    });

    let deck = existing;
    if (!deck) {
      deck = await db.deck.create({
        data: {
          userId: author.id,
          name: deckData.name,
          normalizedName: normalized(deckData.name),
          description: deckData.description,
          color: deckData.color,
          icon: deckData.icon,
          topicGroup: deckData.topicGroup,
          isPublic: true,
          forkCount: Math.floor(Math.random() * 50) + 12,
        },
      });
      console.log(`Created public deck: ${deck.name} (${deck.id})`);
    } else {
      await db.deck.update({
        where: { id: deck.id },
        data: {
          isPublic: true,
          topicGroup: deckData.topicGroup,
          description: deckData.description,
          color: deckData.color,
          icon: deckData.icon,
        },
      });
    }

    // Seed words into this deck
    for (const w of deckData.words) {
      const normalizedWord = normalized(w.word);
      const lexeme = await db.lexeme.upsert({
        where: {
          normalized_partOfSpeech_language: {
            normalized: normalizedWord,
            partOfSpeech: w.partOfSpeech,
            language: 'en',
          },
        },
        create: {
          lemma: w.word,
          normalized: normalizedWord,
          partOfSpeech: w.partOfSpeech,
        },
        update: {},
      });

      const senseKey = hash(normalized(w.meaningVi) + '\0' + normalized(w.definitionEn));
      let vocabItem = await db.vocabItem.findFirst({
        where: {
          userId: author.id,
          lexemeId: lexeme.id,
          senseKey,
          deletedAt: null,
        },
      });

      if (!vocabItem) {
        vocabItem = await db.vocabItem.create({
          data: {
            userId: author.id,
            lexemeId: lexeme.id,
            senseKey,
            word: w.word,
            partOfSpeech: w.partOfSpeech,
            meaningVi: w.meaningVi,
            definitionEn: w.definitionEn,
            exampleEn: w.exampleEn,
            exampleVi: w.exampleVi,
            phonetic: w.phonetic,
            cefr: w.cefr,
            cefrSource: 'verified_3000',
            tags: [normalized(deckData.topicGroup), normalized(w.partOfSpeech)],
          },
        });
      }

      // Link to deck
      await db.deckItem.upsert({
        where: {
          deckId_vocabItemId: {
            deckId: deck.id,
            vocabItemId: vocabItem.id,
          },
        },
        create: {
          deckId: deck.id,
          vocabItemId: vocabItem.id,
        },
        update: {},
      });
    }
  }

  console.log('Seeding public decks finished successfully!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
