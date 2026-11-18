import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema/**/*',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/bankos_db',
  },
});

