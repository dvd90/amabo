// ponytail: dispatcher — DATABASE_URL present = API, absent = web
import { execFileSync, spawn } from 'child_process';

const hasDb = !!process.env.DATABASE_URL;
const svc = process.env.RAILWAY_SERVICE_NAME ?? '(unknown)';

// If this looks like the API service but DATABASE_URL is missing, fail loudly
if (!hasDb && !svc.toLowerCase().includes('web')) {
  console.error(`[start] DATABASE_URL is not set on service "${svc}".`);
  console.error('[start] In Railway: add a Postgres plugin, then set DATABASE_URL=${{ Postgres.DATABASE_URL }} on this service.');
  process.exit(1);
}

if (hasDb) {
  execFileSync('pnpm', ['--filter', '@amabo/api', 'db:migrate'], { stdio: 'inherit' });
}

const [cmd, ...args] = hasDb
  ? ['node', 'apps/api/dist/index.js']
  : ['pnpm', '--filter', '@amabo/web', 'start'];

spawn(cmd, args, { stdio: 'inherit' }).on('exit', code => process.exit(code ?? 0));
