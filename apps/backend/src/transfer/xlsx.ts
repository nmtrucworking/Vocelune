import { fail } from '../common/http';
// Validate the ZIP central directory before ExcelJS decompresses anything.
export async function inspectXlsx(buffer: Buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) fail(422, 'INVALID_XLSX', 'Không phải XLSX hợp lệ.');
  const entries = buffer.readUInt16LE(end + 10), centralOffset = buffer.readUInt32LE(end + 16);
  if (entries > 200 || !entries) fail(422, 'XLSX_LIMIT', 'XLSX có quá nhiều mục nhúng.');
  let offset = centralOffset, total = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) fail(422, 'INVALID_XLSX', 'Cấu trúc ZIP không hợp lệ.');
    const compressed = buffer.readUInt32LE(offset + 20), size = buffer.readUInt32LE(offset + 24);
    total += size;
    if (total > 30 * 1024 * 1024 || size > 15 * 1024 * 1024 || size > Math.max(compressed, 1) * 200) fail(422, 'XLSX_LIMIT', 'XLSX vượt giới hạn giải nén.');
    const nameLength = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (/vbaProject|externalLinks|embeddings|\.\.\//i.test(name)) fail(422, 'XLSX_EMBEDDED_CONTENT', 'Không hỗ trợ macro hoặc liên kết ngoài.');
    offset += 46 + nameLength + extra + comment;
  }
}
