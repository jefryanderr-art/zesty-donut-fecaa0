import { execFileSync } from 'node:child_process';

// Netlify: exit 0 skips a build; exit 1 builds. Unknown history always builds.
const base = process.env.CACHED_COMMIT_REF;
const head = process.env.COMMIT_REF;
if (!base || !head || !/^[a-f0-9]{7,64}$/i.test(base) || !/^[a-f0-9]{7,64}$/i.test(head)) process.exit(1);
try {
  const paths = execFileSync('git', ['diff', '--name-only', '-z', base, head, '--'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
  const documentationOnly = path => /^(README|LEEME|AGENTS)\.md$/i.test(path) || path.startsWith('docs/') || path === '.netlify/results.md';
  process.exit(paths.every(documentationOnly) ? 0 : 1);
} catch {
  process.exit(1);
}
