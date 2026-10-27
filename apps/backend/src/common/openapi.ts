import { OpenAPIObject } from '@nestjs/swagger';
import { z } from 'zod';
import { credentials, settingsSchema } from '../identity/identity.service';
import { vocabSchema, deckSchema } from '../vocabulary/vocabulary.service';
import { reviewSchema } from '../study/study.service';
import { lookupSchema } from '../integrations/dictionary/contracts';
import { saveDictionarySchema } from '../integrations/dictionary.service';
import { blueprintSchema } from '../tests/tests.service';
export function enrichOpenApi(document: OpenAPIObject) {
  const bodies: Record<string, z.ZodType> = {
    'post /auth/register': credentials.extend({ displayName: z.string().min(1).max(100) }),
    'post /auth/login': credentials,
    'post /auth/password/forgot': credentials.pick({ email: true }),
    'post /auth/password/reset': z.object({ token: z.string(), password: credentials.shape.password }),
    'patch /me': settingsSchema, 'patch /me/settings': settingsSchema,
    'delete /me': z.object({ password: z.string(), confirmation: z.literal('DELETE') }),
    'post /vocabulary': vocabSchema,
    'patch /vocabulary/{id}': vocabSchema.partial().omit({ templates: true, sourceKind: true }),
    'post /decks': deckSchema, 'patch /decks/{id}': deckSchema.partial(),
    'post /tests/preview': blueprintSchema, 'post /tests': blueprintSchema,
    'post /cards/{id}/reviews': reviewSchema,
    'post /study/sessions': z.object({ mode: z.enum(['flashcard', 'typed', 'mcq', 'listening']).default('flashcard') }),
    'post /study/sessions/{id}/reveal': z.object({ cardId: z.string().uuid() }),
    'put /test-attempts/{id}/answers/{questionId}': z.object({ answer: z.string().max(5000), clientSequence: z.number().int().min(1).optional() }),
    'post /test-attempts/{id}/submit': z.object({ answers: z.record(z.string().uuid(), z.string()).optional() }),
    'post /dictionary/lookup': lookupSchema,
    'post /dictionary/vocabulary': saveDictionarySchema,
    'post /exports': z.object({ format: z.enum(['csv', 'xlsx', 'json']) }),
  };
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = item?.[method]; if (!operation) continue;
      const suffix = path.replace(/^\/api\/v1/, '');
      operation.security = suffix.startsWith('/auth/') || suffix.startsWith('/health/') ? [] : [{ cookie: [] }];
      if (!['get'].includes(method) && !suffix.startsWith('/auth/')) operation.parameters = [...operation.parameters ?? [], { name: 'X-CSRF-Token', in: 'header', required: true, schema: { type: 'string' } }];
      if (suffix.includes('/reviews') && method === 'post' && !suffix.endsWith('/undo') || suffix === '/imports' && method === 'post') operation.parameters = [...operation.parameters ?? [], { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 8, maxLength: 128 } }];
      const body = bodies[`${method} ${suffix}`];
      if (body) operation.requestBody = { required: true, content: { 'application/json': { schema: z.toJSONSchema(body, { io: 'input', unrepresentable: 'any' }) as any } } };
      operation.responses['422'] = { description: 'VALIDATION_ERROR / domain validation error, with error.code, error.message, error.details and error.requestId' };
      operation.responses['409'] = { description: 'Stale resource, finalized attempt or idempotency conflict' };
    }
  }
  return document;
}
