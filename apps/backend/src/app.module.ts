import { Controller, Get, Inject, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './common/rate-limit';
import { Database, DatabaseModule } from './common/db';
import { IdentityController } from './identity/identity.controller';
import { IdentityService } from './identity/identity.service';
import { Public, SessionGuard } from './identity/security';
import { VocabularyController } from './vocabulary/vocabulary.controller';
import { VocabularyService } from './vocabulary/vocabulary.service';
import { StudyController } from './study/study.controller';
import { StudyService } from './study/study.service';
import { TestsController } from './tests/tests.controller';
import { TestsService } from './tests/tests.service';
import { TransferController } from './transfer/transfer.controller';
import { TransferService } from './transfer/transfer.service';
import { IntegrationsController } from './integrations/integrations.controller';
import { DictionaryTransport } from './integrations/dictionary/transport';
import { DictionaryService } from './integrations/dictionary.service';
import { MediaService } from './integrations/media.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';

@Module({ controllers: [VocabularyController], providers: [VocabularyService], exports: [VocabularyService] })
export class VocabularyModule {}
@Module({ imports: [VocabularyModule], controllers: [IntegrationsController], providers: [DictionaryService, DictionaryTransport, MediaService], exports: [MediaService] })
export class IntegrationsModule {}
@Module({ imports: [IntegrationsModule], controllers: [IdentityController], providers: [IdentityService], exports: [IdentityService] })
export class IdentityModule {}
@Module({ controllers: [StudyController], providers: [StudyService], exports: [StudyService] })
export class StudyModule {}
@Module({ imports: [StudyModule], controllers: [TestsController], providers: [TestsService], exports: [TestsService] })
export class TestsModule {}
@Module({ imports: [VocabularyModule, TestsModule], controllers: [TransferController], providers: [TransferService], exports: [TransferService] })
export class TransferModule {}
@Module({ imports: [StudyModule, TestsModule], controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
@Controller('health')
class HealthController {
  constructor(@Inject(Database) private db: Database) {}
  @Public() @Get('live') live() { return { status: 'ok' }; }
  @Public() @Get('ready') async ready() { await this.db.$queryRaw`SELECT 1`; return { status: 'ok', database: 'ready' }; }
}
@Module({ imports: [DatabaseModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 240 }]), IdentityModule, VocabularyModule, StudyModule, TestsModule, TransferModule, IntegrationsModule, AnalyticsModule],
  controllers: [HealthController], providers: [{ provide: APP_GUARD, useClass: SessionGuard }, { provide: APP_GUARD, useClass: UserThrottlerGuard }] })
export class AppModule {}
