import { Inject, Injectable } from '@nestjs/common';
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Response } from 'express';
import { z } from 'zod';
import { Database } from '../common/db';
import { config } from '../common/config';
import { fail, uuid } from '../common/http';
@Injectable()
export class MediaService {
  private client?: S3Client;
  constructor(@Inject(Database) private db: Database) {
    if (config.R2_ENDPOINT && config.R2_ACCESS_KEY_ID && config.R2_SECRET_ACCESS_KEY && config.R2_BUCKET) this.client = new S3Client({ region: 'auto', endpoint: config.R2_ENDPOINT, credentials: { accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY } });
  }
  private storage() { if (!this.client) fail(503, 'STORAGE_NOT_CONFIGURED', 'Chưa cấu hình kho lưu trữ ảnh.'); return this.client; }
  async intent(userId: string, body: unknown) {
    const input = z.object({ purpose: z.enum(['flashcard', 'avatar']), mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), sizeBytes: z.number().int().min(1).max(5 * 1024 * 1024) }).strict().parse(body);
    const client = this.storage();
    return this.db.forUser(userId, async tx => {
      const count = await tx.mediaAsset.count({ where: { userId, deletedAt: null, OR: [{ status: 'ready' }, { expiresAt: { gt: new Date() } }] } });
      if (count >= 100) fail(429, 'MEDIA_QUOTA', 'Tối đa 100 ảnh cho mỗi tài khoản.');
      const asset = await tx.mediaAsset.create({ data: { userId, ...input, objectKey: `${userId}/pending/${crypto.randomUUID()}`, expiresAt: new Date(Date.now() + 5 * 60000) } });
      const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: config.R2_BUCKET, Key: asset.objectKey, ContentType: input.mime, ContentLength: input.sizeBytes }), { expiresIn: 300 });
      return { id: asset.id, uploadUrl, headers: { 'Content-Type': input.mime }, expiresAt: asset.expiresAt };
    });
  }
  async complete(userId: string, assetId: string) {
    const client = this.storage();
    return this.db.forUser(userId, async tx => {
      const asset = await tx.mediaAsset.findFirst({ where: { id: assetId, userId, deletedAt: null } });
      if (!asset) fail(404, 'NOT_FOUND', 'Không tìm thấy ảnh.');
      if (asset.status === 'ready') return { id: asset.id, status: asset.status };
      if (asset.expiresAt <= new Date()) fail(409, 'UPLOAD_EXPIRED', 'Phiên tải ảnh đã hết hạn.');
      let head;
      try { head = await client.send(new HeadObjectCommand({ Bucket: config.R2_BUCKET, Key: asset.objectKey })); }
      catch { fail(422, 'UPLOAD_MISSING', 'Chưa tìm thấy tệp đã tải.'); }
      if (!head.ETag) fail(422, 'MEDIA_MISMATCH', 'Kho lưu trữ không trả mã kiểm tra phiên bản tệp.');
      if (head.ContentLength !== asset.sizeBytes || head.ContentType !== asset.mime) fail(422, 'MEDIA_MISMATCH', 'Loại hoặc kích thước ảnh không khớp.');
      const object = await client.send(new GetObjectCommand({ Bucket: config.R2_BUCKET, Key: asset.objectKey, Range: 'bytes=0-31', IfMatch: head.ETag }));
      const bytes = Buffer.from(await object.Body!.transformToByteArray());
      const valid = asset.mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : asset.mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!valid) fail(422, 'INVALID_IMAGE', 'Nội dung tệp không đúng định dạng ảnh khai báo.');
      // Copy to a different immutable key: the old presigned PUT cannot overwrite a ready asset.
      const readyKey = `${userId}/ready/${asset.id}`;
      await client.send(new CopyObjectCommand({ Bucket: config.R2_BUCKET, Key: readyKey, CopySource: `${config.R2_BUCKET}/${asset.objectKey}`, CopySourceIfMatch: head.ETag }));
      await tx.mediaAsset.update({ where: { id: asset.id }, data: { objectKey: readyKey, status: 'ready' } });
      await tx.auditLog.create({ data: { action: 'media.cleanup', resourceId: asset.objectKey } });
      return { id: asset.id, status: 'ready' };
    });
  }
  async access(userId: string, assetId: string) {
    const client = this.storage();
    const asset = await this.db.mediaAsset.findFirst({ where: { id: assetId, userId, status: 'ready', deletedAt: null } });
    if (!asset) fail(404, 'NOT_FOUND', 'Không tìm thấy ảnh.');
    return { url: await getSignedUrl(client, new GetObjectCommand({ Bucket: config.R2_BUCKET, Key: asset.objectKey, ResponseContentDisposition: 'inline', ResponseContentType: asset.mime }), { expiresIn: 120 }), expiresIn: 120 };
  }
  async stream(asset: { id: string; objectKey: string; mime: string; sizeBytes: number }, res: Response, ifNoneMatch?: string) {
    const client = this.storage();
    let head;
    try {
      head = await client.send(new HeadObjectCommand({ Bucket: config.R2_BUCKET, Key: asset.objectKey }));
    } catch {
      fail(404, 'NOT_FOUND', 'Không tìm thấy tệp ảnh trong kho lưu trữ.');
    }
    const etag = head.ETag ?? `"${asset.id}"`;
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === asset.id || ifNoneMatch === `"${asset.id}"`)) {
      res.status(304).end();
      return;
    }
    const object = await client.send(new GetObjectCommand({ Bucket: config.R2_BUCKET, Key: asset.objectKey }));
    res.setHeader('Content-Type', asset.mime);
    if (head.ContentLength) res.setHeader('Content-Length', head.ContentLength);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    const body = object.Body;
    if (body && typeof (body as any).pipe === 'function') {
      (body as any).pipe(res);
    } else if (body && typeof (body as any).transformToByteArray === 'function') {
      const bytes = await (body as any).transformToByteArray();
      res.end(Buffer.from(bytes));
    } else {
      res.status(404).end();
    }
  }
  async streamAvatar(userId: string, res: Response, ifNoneMatch?: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { avatarAsset: true },
    });
    if (!user || !user.avatarAsset || user.avatarAsset.status !== 'ready' || user.avatarAsset.deletedAt) {
      fail(404, 'NOT_FOUND', 'Người dùng chưa có ảnh đại diện.');
    }
    return this.stream(user.avatarAsset, res, ifNoneMatch);
  }
  async streamAsset(userId: string, assetId: string, res: Response, ifNoneMatch?: string) {
    const asset = await this.db.mediaAsset.findFirst({ where: { id: assetId, userId, status: 'ready', deletedAt: null } });
    if (!asset) fail(404, 'NOT_FOUND', 'Không tìm thấy ảnh.');
    return this.stream(asset, res, ifNoneMatch);
  }
  async attach(userId: string, assetId: string, body: unknown) {
    const { vocabId } = z.object({ vocabId: uuid }).strict().parse(body);
    return this.db.forUser(userId, async tx => {
      if (!await tx.mediaAsset.findFirst({ where: { id: assetId, userId, status: 'ready', deletedAt: null } }) || !await tx.vocabItem.findFirst({ where: { id: vocabId, userId, deletedAt: null } })) fail(404, 'NOT_FOUND', 'Không tìm thấy ảnh hoặc từ.');
      return tx.vocabMedia.upsert({ where: { vocabItemId_mediaId: { vocabItemId: vocabId, mediaId: assetId } }, create: { vocabItemId: vocabId, mediaId: assetId }, update: {} });
    });
  }
  async detach(userId: string, assetId: string, vocabId: string) {
    return this.db.forUser(userId, async tx => {
      await tx.vocabMedia.deleteMany({ where: { vocabItemId: vocabId, mediaId: assetId } });
      return { ok: true };
    });
  }
  async uploadDirect(userId: string, assetId: string, dataUrl: string) {
    const client = this.storage();
    const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) fail(422, 'INVALID_DATA_URL', 'Định dạng ảnh base64 không hợp lệ.');
    const mime = match[1] === 'image/webp' ? 'image/webp' : match[1] === 'image/png' ? 'image/png' : 'image/jpeg';
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) fail(422, 'FILE_TOO_LARGE', 'Ảnh vượt quá kích thước 5MB.');

    return this.db.forUser(userId, async tx => {
      const asset = await tx.mediaAsset.findFirst({ where: { id: assetId, userId, deletedAt: null } });
      if (!asset) fail(404, 'NOT_FOUND', 'Không tìm thấy phiên tải ảnh.');
      if (asset.expiresAt <= new Date()) fail(409, 'UPLOAD_EXPIRED', 'Phiên tải ảnh đã hết hạn.');

      const readyKey = `${userId}/ready/${asset.id}`;
      await client.send(new PutObjectCommand({
        Bucket: config.R2_BUCKET,
        Key: readyKey,
        Body: buffer,
        ContentType: mime,
      }));

      await tx.mediaAsset.update({
        where: { id: asset.id },
        data: { objectKey: readyKey, status: 'ready', mime, sizeBytes: buffer.length }
      });

      return { id: asset.id, status: 'ready' };
    });
  }
  async cleanup() {
    if (!this.client) return;
    const expired = await this.db.mediaAsset.findMany({ where: { status: 'pending', expiresAt: { lt: new Date(Date.now() - 3600000) } }, take: 100 });
    for (const asset of expired) { await this.client.send(new DeleteObjectCommand({ Bucket: config.R2_BUCKET, Key: asset.objectKey })); await this.db.mediaAsset.delete({ where: { id: asset.id } }); }
    const events = await this.db.auditLog.findMany({ where: { action: 'media.cleanup' }, take: 100 });
    for (const event of events) {
      if (event.resourceId) await this.client.send(new DeleteObjectCommand({ Bucket: config.R2_BUCKET, Key: event.resourceId }));
      await this.db.auditLog.delete({ where: { id: event.id } });
    }
  }
}
