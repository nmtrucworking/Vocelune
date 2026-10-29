import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { Database, json } from '../common/db';
import { fail, uuid } from '../common/http';
import { hash } from '../identity/security';
import { config } from '../common/config';
import { VocabularyService, vocabSchema, VocabInput } from '../vocabulary/vocabulary.service';
import { vocabDto, cardDto, deckDto, reviewDto } from '../common/serializers';
import { TestsService } from '../tests/tests.service';
import { inspectXlsx } from './xlsx';
import { hasRestrictedContent, redactForSharing } from '../integrations/dictionary/license-policy';

type ImportRow = { rowNumber: number; data?: VocabInput; error?: unknown; duplicateId?: string; status: 'pending' | 'created' | 'updated' | 'skipped' | 'failed'; resultId?: string };
const aliases: Record<string, string> = { part_of_speech: 'partOfSpeech', meaning_vi: 'meaningVi', definition_en: 'definitionEn', example_en: 'exampleEn', example_vi: 'exampleVi', ipa: 'phonetic', cefr_level: 'cefr', note: 'notes', card_templates: 'templates' };
const allowed = new Set(Object.keys(vocabSchema.shape));
export const csvCell = (input: unknown) => {
  let text = String(input ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const columns = ['word', 'part_of_speech', 'meaning_vi', 'definition_en', 'example_en', 'example_vi', 'ipa', 'cefr_level', 'tags', 'note', 'card_templates', 'example_only'];
@Injectable()
export class TransferService {
  constructor(@Inject(Database) private db: Database, @Inject(VocabularyService) private vocabulary: VocabularyService, @Inject(TestsService) private tests: TestsService) {}
  async parseFile(file: { originalname: string; buffer: Buffer }, mapping: Record<string, string> = {}) {
    if (file.buffer.length > 10 * 1024 * 1024) fail(413, 'FILE_TOO_LARGE', 'Tệp tối đa 10 MB.');
    let rows: Record<string, unknown>[];
    if (/\.csv$/i.test(file.originalname)) {
      try { rows = parse(file.buffer, { columns: (headers: string[]) => { if (headers.length > 40 || new Set(headers).size !== headers.length) throw new Error('Invalid headers'); return headers; }, to: 5001, bom: true, skip_empty_lines: true, max_record_size: 100000, trim: true }); }
      catch { fail(422, 'INVALID_CSV', 'CSV không hợp lệ. Kiểm tra dấu ngoặc kép và header.'); }
    } else if (/\.xlsx$/i.test(file.originalname)) {
      await inspectXlsx(file.buffer);
      const book = new ExcelJS.Workbook();
      try { await book.xlsx.load(file.buffer as any); } catch { fail(422, 'INVALID_XLSX', 'Không đọc được XLSX.'); }
      const sheet = book.getWorksheet('Vocabulary') || book.worksheets[0];
      if (!sheet || sheet.rowCount > 5001 || sheet.columnCount > 40) fail(422, 'SHEET_LIMIT', 'Bảng tối đa 5.000 dòng và 40 cột.');
      const headers = sheet.getRow(1).values as unknown[];
      rows = [];
      for (let n = 2; n <= sheet.rowCount; n++) {
        const data: Record<string, unknown> = {};
        sheet.getRow(n).eachCell((cell, col) => {
          if (cell.type === ExcelJS.ValueType.Formula || (typeof cell.value === 'object' && cell.value !== null)) fail(422, 'FORMULA_NOT_ALLOWED', 'Không hỗ trợ công thức, hyperlink hoặc nội dung nhúng.');
          data[String(headers[col] ?? '')] = cell.value == null ? '' : String(cell.value);
        });
        if (Object.values(data).some(v => v !== '')) rows.push(data);
      }
    } else fail(422, 'INVALID_FILE_TYPE', 'Chỉ hỗ trợ CSV và XLSX.');
    if (!rows.length || rows.length > 5000) fail(422, 'ROW_LIMIT', 'Tệp phải có từ 1 đến 5.000 dòng dữ liệu.');
    return rows.map(row => {
      const result: Record<string, unknown> = {};
      for (const [rawKey, value] of Object.entries(row)) {
        const source = rawKey.trim();
        const target = mapping[source] || aliases[source] || source;
        if (source === 'example_only' && String(value).toLowerCase() === 'true') result.exampleOnly = true;
        if (allowed.has(target)) result[target] = value;
        if (source === 'source_note' && typeof value === 'string' && value.trim()) result.notes = `${String(result.notes ?? '')}\nNguồn nhập: ${value}`.trim();
      }
      if (typeof result.tags === 'string') result.tags = result.tags.split(';').map(t => t.trim()).filter(Boolean);
      if (typeof result.templates === 'string') result.templates = result.templates.split(';').map(t => t.trim()).filter(Boolean);
      // Uploaded strings cannot claim vendor ownership or verified CEFR.
      result.sourceKind = 'user'; result.cefrSource = result.cefr === 'unknown' ? 'unknown' : 'manual';
      return result;
    });
  }
  async preview(userId: string, key: string, body: unknown) {
    const input = z.object({ deckId: uuid, rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000), policy: z.enum(['skip', 'merge', 'create_new']).default('skip') }).strict().parse(body);
    await this.vocabulary.requireDeck(this.db, userId, input.deckId);
    const payloadHash = hash(JSON.stringify(input));
    return this.db.forUser(userId, async tx => {
      const previous = await tx.importJob.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } });
      if (previous) {
        if (previous.payloadHash !== payloadHash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa import đã được dùng cho dữ liệu khác.');
        return previous;
      }
      const rows: ImportRow[] = [];
      const seen = new Set<string>();
      for (const [i, raw] of input.rows.entries()) {
        if (raw.exampleOnly) { rows.push({ rowNumber: i + 2, status: 'skipped', error: 'example_only' }); continue; }
        // Strip the template marker, never unknown owner fields.
        const clean: Record<string, unknown> = { ...raw, deckId: input.deckId }; delete clean.exampleOnly;
        const validated = vocabSchema.safeParse(clean);
        if (!validated.success) { rows.push({ rowNumber: i + 2, status: 'failed', error: validated.error.flatten() }); continue; }
        const data = validated.data;
        if (data.templates.includes('definition_en') && !data.definitionEn) { rows.push({ rowNumber: i + 2, status: 'failed', error: 'missing_definition_en' }); continue; }
        let validDecks = true;
        for (const d of data.deckIds ?? []) {
          if (!await tx.deck.findFirst({ where: { id: d, userId, deletedAt: null } })) validDecks = false;
        }
        if (!validDecks) { rows.push({ rowNumber: i + 2, status: 'failed', error: 'invalid_deck' }); continue; }
        const senseKey = this.vocabulary.senseKey(data);
        const word = data.word.normalize('NFC').trim().toLowerCase();
        const existing = await tx.vocabItem.findFirst({ where: { userId, deletedAt: null, senseKey, lexeme: { normalized: word, partOfSpeech: data.partOfSpeech } } });
        const rowKey = `${word}\0${data.partOfSpeech}\0${senseKey}`;
        if (seen.has(rowKey) && input.policy !== 'create_new') { rows.push({ rowNumber: i + 2, data, status: 'skipped', error: 'duplicate_in_file' }); continue; }
        seen.add(rowKey);
        rows.push({ rowNumber: i + 2, data, duplicateId: existing?.id, status: existing && input.policy === 'skip' ? 'skipped' : 'pending' });
      }
      return tx.importJob.create({ data: { userId, idempotencyKey: key, payloadHash, deckId: input.deckId, policy: input.policy, rows: json(rows) } });
    });
  }
  async history(userId: string) {
    return this.db.importJob.findMany({ where: { userId }, select: { id: true, status: true, result: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 });
  }
  async errors(userId: string, jobId: string) {
    const job = await this.get(userId, jobId);
    const rows = (job.rows as unknown as ImportRow[]).filter(row => row.error || row.status === 'failed');
    return Buffer.from('\uFEFFrow_number,word,status,error\r\n' + rows.map(row => [row.rowNumber, row.data?.word ?? '', row.status, JSON.stringify(row.error)].map(csvCell).join(',')).join('\r\n'));
  }
  async get(userId: string, jobId: string) {
    const job = await this.db.importJob.findFirst({ where: { id: jobId, userId } });
    if (!job) fail(404, 'NOT_FOUND', 'Không tìm thấy lượt nhập.');
    return job;
  }
  async commit(userId: string, jobId: string) {
    await this.db.forUser(userId, async tx => {
      const job = await tx.importJob.findFirst({ where: { id: jobId, userId } });
      if (!job) fail(404, 'NOT_FOUND', 'Không tìm thấy lượt nhập.');
      if (job.status === 'preview' || job.status === 'failed') await tx.importJob.update({ where: { id: jobId }, data: { status: 'queued' } });
    });
    if (!config.REDIS_URL) await this.process(userId, jobId);
    return this.get(userId, jobId);
  }
  async process(userId: string, jobId: string) {
    let done = false;
    while (!done) {
      done = await this.db.forUser(userId, async tx => {
        const job = await tx.importJob.findFirst({ where: { id: jobId, userId } });
        if (!job || !['queued', 'processing'].includes(job.status)) return true;
        await this.vocabulary.requireDeck(tx, userId, job.deckId);
        const rows = job.rows as unknown as ImportRow[];
        const pending = rows.filter(r => r.status === 'pending').slice(0, 50);
        for (const row of pending) {
          const data = row.data!;
          // Recheck duplicates under the user lock; a preview is not a reservation.
          const existing = await tx.vocabItem.findFirst({ where: { userId, deletedAt: null, senseKey: this.vocabulary.senseKey(data), lexeme: { normalized: data.word.normalize('NFC').trim().toLowerCase(), partOfSpeech: data.partOfSpeech } } });
          if (existing && job.policy !== 'create_new') {
            row.resultId = existing.id;
            if (job.policy === 'skip') row.status = 'skipped';
            else {
              // An exact sense duplicate can update user annotations without merging unrelated senses.
              await tx.vocabItem.update({ where: { id: existing.id }, data: { exampleEn: data.exampleEn || existing.exampleEn, exampleVi: data.exampleVi || existing.exampleVi, notes: data.notes || existing.notes, tags: [...new Set([...existing.tags, ...data.tags])] } });
              await tx.deckItem.upsert({ where: { deckId_vocabItemId: { deckId: job.deckId, vocabItemId: existing.id } }, create: { deckId: job.deckId, vocabItemId: existing.id }, update: {} });
              row.status = 'updated';
            }
          } else {
            const item = await this.vocabulary.createInTx(tx, userId, data, job.policy === 'create_new');
            row.resultId = item.id; row.status = 'created';
          }
        }
        const finished = !rows.some(r => r.status === 'pending');
        const counts = { created: rows.filter(r => r.status === 'created').length, updated: rows.filter(r => r.status === 'updated').length, skipped: rows.filter(r => r.status === 'skipped').length, failed: rows.filter(r => r.status === 'failed').length };
        await tx.importJob.update({ where: { id: jobId }, data: { rows: json(rows), result: counts, status: finished ? 'completed' : 'processing', completedAt: finished ? new Date() : null } });
        return finished;
      });
    }
  }
  async template(format: string) {
    const samples = [['sample-orbit', 'noun', 'Ví dụ minh họa tự biên soạn', 'A synthetic sample for the import template.', '', '', '', 'unknown', 'sample', '', 'en_vi', 'true'], ['sample-recall', 'verb', 'Ví dụ thứ hai', '', '', '', '', 'unknown', 'sample', '', 'en_vi;vi_en', 'true'], ['sample-lunar', 'adjective', 'Ví dụ thứ ba', '', '', '', '', 'unknown', 'sample', '', 'en_vi', 'true']];
    if (format === 'csv') return { buffer: Buffer.from('\uFEFF' + [columns.join(','), ...samples.map(row => row.map(csvCell).join(','))].join('\r\n')), mime: 'text/csv; charset=utf-8', ext: 'csv' };
    if (format !== 'xlsx') fail(422, 'INVALID_FORMAT', 'Định dạng phải là csv hoặc xlsx.');
    const book = new ExcelJS.Workbook();
    book.addWorksheet('Instructions').addRows([['Vocelune import'], ['Maximum 5,000 rows, 10 MB. User-owned content only.'], ['Delete example rows or set example_only=false for your own content.'], ['Required: word, part_of_speech, meaning_vi. Tags and card_templates use semicolons.'], ['No formulas, macros, hyperlinks or embedded content. CEFR is manual/unknown.']]);
    const sheet = book.addWorksheet('Vocabulary'); sheet.addRows([columns, ...samples]); sheet.getRow(1).font = { bold: true }; sheet.columns.forEach(c => { c.width = 24; });
    book.addWorksheet('Enums').addRows([['part_of_speech', 'cefr_level', 'card_templates'], ['noun', 'A1', 'en_vi'], ['verb', 'A2', 'vi_en'], ['adjective', 'B1', 'audio_word'], ['adverb', 'B2', 'definition_en'], ['phrase', 'C1'], ['other', 'C2'], ['', 'unknown']]);
    return { buffer: Buffer.from(await book.xlsx.writeBuffer()), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
  }
  async export(userId: string, format: string) {
    const data = await this.db.$transaction(async tx => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, displayName: true, createdAt: true, settings: true } });
      const vocabulary = await tx.vocabItem.findMany({ where: { userId, deletedAt: null }, include: { decks: true, media: true } });
      const decks = await tx.deck.findMany({ where: { userId, deletedAt: null } });
      const cards = await tx.card.findMany({ where: { userId } });
      const reviews = await tx.reviewLog.findMany({ where: { userId } });
      const attempts = await tx.testAttempt.findMany({ where: { userId }, include: { questions: { orderBy: { ordinal: 'asc' } }, definition: true } });
      const licensed = await tx.vocabItem.findMany({ where: { userId, sourceKind: 'licensed' }, select: { id: true, provenance: true } });
      const restrictedIds = new Set(licensed.filter(item => hasRestrictedContent({ ...item, sourceKind: 'licensed' })).map(v => v.id));
      const { userId: _, ...settings } = user.settings!;
      return { schemaVersion: 1, exportedAt: new Date().toISOString(), user: { ...user, settings }, vocabulary: vocabulary.map(item => {
        return redactForSharing(vocabDto(item));
      }), decks: decks.map(deckDto), cards: cards.map(cardDto), reviewLogs: reviews.map(reviewDto), testAttempts: attempts.map(a => {
        const dto = this.tests.dto(a);
        return { ...dto, questions: dto.questions.map(q => restrictedIds.has(q.vocabId) ? { id: q.id, vocabId: q.vocabId, contentRedacted: true } : q) };
      }) };
    }, { isolationLevel: 'RepeatableRead' });
    if (format === 'json') return { buffer: Buffer.from(JSON.stringify(data, null, 2)), mime: 'application/json', ext: 'json' };
    const exportColumns = [...columns, 'source_note'];
    const rows = data.vocabulary.map(v => [v.word, v.partOfSpeech, v.meaningVi, v.definitionEn, v.exampleEn, v.exampleVi, v.phonetic, v.cefr, v.tags.join(';'), v.notes, 'en_vi', 'false', JSON.stringify(v.provenance ?? {})]);
    if (format === 'csv') return { buffer: Buffer.from('\uFEFF' + [exportColumns.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\r\n')), mime: 'text/csv; charset=utf-8', ext: 'csv' };
    if (format === 'xlsx') {
      const book = new ExcelJS.Workbook(); book.addWorksheet('Vocabulary').addRows([exportColumns, ...rows]);
      return { buffer: Buffer.from(await book.xlsx.writeBuffer()), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
    }
    fail(422, 'INVALID_FORMAT', 'Chỉ hỗ trợ csv, xlsx và json.');
  }
}
