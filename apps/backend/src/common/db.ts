import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class Database extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
  // Serialize writes for one owner, including absent-row/idempotency checks.
  async forUser<T>(
    userId: string,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number }
  ): Promise<T> {
    return this.$transaction(
      async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
        return action(tx);
      },
      { timeout: options?.timeout ?? 30000 }
    );
  }
}
export type Tx = Prisma.TransactionClient;
export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
@Global()
@Module({ providers: [Database], exports: [Database] })
export class DatabaseModule {}
