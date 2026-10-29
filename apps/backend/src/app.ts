import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json as jsonBody } from 'express';
import { randomUUID } from 'node:crypto';
import { enrichOpenApi } from './common/openapi';
import { AppModule } from './app.module';
import { config, getAllowedOrigins, isOriginAllowed } from './common/config';
import { ErrorFilter } from './common/http';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: config.NODE_ENV === 'test' ? false : ['error', 'warn', 'log'] });
  app.use(helmet());
  app.use(jsonBody({ limit: '10mb' }));
  app.use(cookieParser());
  app.use((req: any, res: any, next: () => void) => {
    const started = Date.now();
    req.requestId = randomUUID();
    if (config.NODE_ENV !== 'test') res.on('finish', () => process.stdout.write(JSON.stringify({ event: 'http.request', requestId: req.requestId, method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode, durationMs: Date.now() - started }) + '\n'));
    res.setHeader('X-Request-ID', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => callback(null, isOriginAllowed(origin)),
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  const server = app.getHttpAdapter().getInstance();
  server.get('/', (_req: any, res: any) => res.status(200).json({ status: 'ok', service: 'vocelune-api' }));
  server.head('/', (_req: any, res: any) => res.status(200).end());
  server.get('/health', (_req: any, res: any) => res.status(200).json({ status: 'ok' }));
  server.head('/health', (_req: any, res: any) => res.status(200).end());
  const swaggerConfig = new DocumentBuilder().setTitle('Vocelune API').setVersion('1.0.0')
    .setDescription('Cookie sessions; mutations require X-CSRF-Token. Reviews and imports require Idempotency-Key. Domain request schemas and examples: docs/backend.md. Scheduler: ts-fsrs 5.4.2 / FSRS-6.')
    .addCookieAuth(config.NODE_ENV === 'production' ? '__Host-vocelune_session' : 'vocelune_session').build();
  const document = enrichOpenApi(SwaggerModule.createDocument(app, swaggerConfig));
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/openapi.json' });
  await app.init();
  return app;
}
