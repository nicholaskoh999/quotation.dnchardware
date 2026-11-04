/* ── R2.4 — every page stylesheet is balanced ───────────────────────────────
   The R2.3 integration merge left companies.php one "}" short: everything
   after the R2.3 Session D phone block silently became part of a phone-only
   @media rule. A merge can do that again without any visible error, so every
   <style> block in both pages is checked for balanced braces (comments,
   quoted strings and data URLs removed first).                         */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

module.exports = async (browser, A) => {
  A.suite('78 R2.4: stylesheets balanced');
  for (const f of ['index.php', 'companies.php']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const blocks = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
    A.ok(blocks.length >= 1, `${f}: ${blocks.length} stylesheet(s)`);
    blocks.forEach((m, i) => {
      const css = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("[^"]*"\)/g, 'url()').replace(/'[^'\n]*'/g, "''").replace(/"[^"\n]*"/g, '""');
      let depth = 0, min = 0;
      for (const ch of css) { if (ch === '{') depth++; else if (ch === '}') { depth--; min = Math.min(min, depth); } }
      A.eq([depth, min], [0, 0], `${f} <style> #${i + 1}: braces balanced, never closing more than opened`);
    });
  }
};
