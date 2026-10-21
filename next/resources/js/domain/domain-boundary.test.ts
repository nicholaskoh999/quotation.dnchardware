import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* The domain engine must stay framework-free (handoff §1): no React, no
   Inertia, no DOM globals. This walks every source file under domain/ and
   fails on a forbidden import, so the boundary is enforced, not hoped for. */
const ROOT = __dirname;
const FORBIDDEN = [/from ['"]react/, /from ['"]@inertiajs/, /from ['"]react-dom/, /\bdocument\./, /\bwindow\./, /from ['"]@\/components/];

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
    });
}

describe('domain boundary', () => {
    it('contains no framework, DOM or component imports', () => {
        const offenders = walk(ROOT).flatMap((file) => {
            const src = readFileSync(file, 'utf8');
            return FORBIDDEN.filter((re) => re.test(src)).map((re) => `${file}: ${re}`);
        });
        expect(offenders).toEqual([]);
    });
});
