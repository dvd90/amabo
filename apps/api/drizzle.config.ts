import { defineConfig } from 'drizzle-kit';

// Migrations live in apps/api/drizzle; the Railway release step runs `drizzle-kit
// migrate` before the API starts (ARCHITECTURE.md §16).
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
