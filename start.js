// ponytail: single dispatcher so Railpack can auto-detect a start command from root
// RAILWAY_SERVICE_NAME is injected at runtime — "web" → static serve, else → API
import { execFileSync, spawn } from 'child_process';

const isWeb = (process.env.RAILWAY_SERVICE_NAME ?? '').toLowerCase().includes('web');

if (!isWeb) {
  // Run migrations before starting the API (Railway preDeployCommand equivalent)
  execFileSync('pnpm', ['--filter', '@amabo/api', 'db:migrate'], { stdio: 'inherit' });
}

const [cmd, ...args] = isWeb
  ? ['pnpm', '--filter', '@amabo/web', 'start']
  : ['node', 'apps/api/dist/index.js'];

spawn(cmd, args, { stdio: 'inherit' }).on('exit', code => process.exit(code ?? 0));
