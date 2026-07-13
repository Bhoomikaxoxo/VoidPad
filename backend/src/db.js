import { PrismaClient } from '@prisma/client';

// Lazy singleton to avoid crashing the module if DATABASE_URL is not yet set
let _prisma;

function getPrisma() {
  if (!_prisma) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
        'Please add it in Vercel Project Settings → Environment Variables.'
      );
    }
    _prisma = new PrismaClient();
  }
  return _prisma;
}

// Proxy so existing code calling `prisma.vault.findUnique(...)` etc. still works
const prisma = new Proxy(
  {},
  {
    get(_, prop) {
      return getPrisma()[prop];
    },
  }
);

export default prisma;
