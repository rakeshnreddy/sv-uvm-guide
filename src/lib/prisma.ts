import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export function getPrisma(): PrismaClient {
  if (!globalThis.prisma) {
    globalThis.prisma = new PrismaClient();
  }

  return globalThis.prisma;
}

// Keep the existing import surface while delaying client construction until a
// query is actually made. Next.js may evaluate this module during static builds.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    return Reflect.get(client, property, client);
  },
});
