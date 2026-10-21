// Writes RELEASE.json into the application root at build time, so the server
// can report its release / SHA / build time without git or a shell.
//   node scripts/release-stamp.mjs [version]
// The SHA comes from GIT_SHA if set (CI / Office build), else `git rev-parse`.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
let sha = process.env.GIT_SHA || '';
if (!sha) {
    try {
        sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
        sha = '';
    }
}
let dirty = false;
try {
    dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== '';
} catch {}
const stamp = {
    version: process.argv[2] || process.env.APP_RELEASE || pkg.version || '0.1.0',
    sha: /^[0-9a-f]{40}$/.test(sha) ? sha : null,
    dirty,
    builtAt: new Date().toISOString(),
};
writeFileSync(new URL('../RELEASE.json', import.meta.url), JSON.stringify(stamp, null, 2) + '\n');
console.log('RELEASE.json', stamp);
