/* Number reading and formatting helpers shared by every module.

   These are ports of the legacy index.php helpers (evalExpr, parseFloat-based
   fn(), cleanNum, withMm). They are deliberately faithful: a rate typed as
   "2.8+0.5" is 3.3, "1,200" is twelve hundred, "2,80" is NOT 2 (it is
   unreadable, so 0), exactly as the legacy calculator reads it. */

/** Anything a form field or a saved record may hold. */
export type NumericInput = number | string | null | undefined;

/* ── A tiny arithmetic evaluator ────────────────────────────────────────────
   Legacy evaluates `[\d\s.+\-*\/]+` with `Function('"use strict";return(…)')`.
   The engine must not eval, so this is a recursive-descent parser for the same
   JavaScript subset: decimal literals, unary +/-, binary + - * / and **.
   Anything JavaScript would reject as a syntax error (a `--` / `++` token,
   adjacent literals, a legacy-octal literal such as 012 in strict mode, a
   dangling operator) returns null, and the caller then falls back to Number()
   exactly as the legacy catch block does. */
type Tok = { k: 'num'; v: number } | { k: 'op'; v: string };

function tokenize(src: string): Tok[] | null {
    const out: Tok[] = [];
    let i = 0;
    while (i < src.length) {
        const ch = src.charAt(i);
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if (/[\d.]/.test(ch)) {
            const m = /^(?:\d+\.?\d*|\.\d+)/.exec(src.slice(i));
            if (!m) return null;
            const lit = m[0];
            // Strict-mode JavaScript refuses a legacy octal / leading-zero decimal (012, 08).
            if (/^0\d/.test(lit)) return null;
            out.push({ k: 'num', v: Number(lit) });
            i += lit.length;
            continue;
        }
        const two = src.slice(i, i + 2);
        if (two === '**') {
            out.push({ k: 'op', v: '**' });
            i += 2;
            continue;
        }
        if (two === '++' || two === '--') return null; // increment / decrement: a syntax error here
        if ('+-*/'.includes(ch)) {
            out.push({ k: 'op', v: ch });
            i++;
            continue;
        }
        return null;
    }
    return out;
}

function evaluateArithmetic(src: string): number | null {
    const toks = tokenize(src);
    if (!toks || toks.length === 0) return null;
    let p = 0;
    const peek = (): Tok | undefined => toks[p];
    const isOp = (t: Tok | undefined, v: string): boolean => !!t && t.k === 'op' && t.v === v;

    // exponent := primary ('**' unary)?   (right associative; a unary operand on the LEFT is a syntax error)
    const primary = (): number | null => {
        const t = peek();
        if (!t || t.k !== 'num') return null;
        p++;
        return t.v;
    };
    // A signed operand: unary operators applied to a bare literal.
    const signed = (): number | null => {
        const t = peek();
        if (isOp(t, '-') || isOp(t, '+')) {
            p++;
            const v = signed();
            if (v === null) return null;
            return t && t.k === 'op' && t.v === '-' ? -v : +v;
        }
        return primary();
    };
    const unary = (): number | null => {
        const t = peek();
        if (isOp(t, '-') || isOp(t, '+')) {
            const v = signed();
            if (v === null) return null;
            if (isOp(peek(), '**')) return null; // -2**2 is a SyntaxError in JavaScript
            return v;
        }
        return exponent();
    };
    const exponent = (): number | null => {
        const base = primary();
        if (base === null) return null;
        if (isOp(peek(), '**')) {
            p++;
            const e = unary();
            if (e === null) return null;
            return base ** e;
        }
        return base;
    };
    const term = (): number | null => {
        let v = unary();
        if (v === null) return null;
        while (isOp(peek(), '*') || isOp(peek(), '/')) {
            const op = (toks[p] as Tok).v;
            p++;
            const r = unary();
            if (r === null) return null;
            v = op === '*' ? v * r : v / r;
        }
        return v;
    };
    const expr = (): number | null => {
        let v = term();
        if (v === null) return null;
        while (isOp(peek(), '+') || isOp(peek(), '-')) {
            const op = (toks[p] as Tok).v;
            p++;
            const r = term();
            if (r === null) return null;
            v = op === '+' ? v + r : v - r;
        }
        return v;
    };
    const v = expr();
    if (v === null || p !== toks.length) return null;
    return v;
}

/** Legacy `evalExpr`: a rate / price field, which may be a simple expression. */
export function evalExpr(raw: NumericInput): number {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return Number.isNaN(raw) ? 0 : raw;
    let t = String(raw).trim();
    if (!t) return 0;
    if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
    if (/^[\d\s.+\-*/]+$/.test(t)) {
        const r = evaluateArithmetic(t);
        if (r !== null) return Number.parseFloat(String(r)) || 0;
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
}

/** Legacy `fn()` / `parseFloat(x)||0`: a dimension, markup or plain number field. */
export function parseNum(raw: NumericInput): number {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return Number.isNaN(raw) ? 0 : raw;
    return Number.parseFloat(String(raw)) || 0;
}

/** True when the field holds nothing (blank / whitespace / null / undefined). */
export function isBlank(raw: unknown): boolean {
    return raw === null || raw === undefined || String(raw).trim() === '';
}

/** Legacy `cleanNum`: 1000 → "1000", 12.50 → "12.5", "abc" stays "abc". */
export function cleanNum(v: NumericInput): string {
    const n = Number.parseFloat(String(v));
    if (Number.isNaN(n)) return String(v ?? '');
    return Number.isInteger(n) ? String(n) : String(Number.parseFloat(n.toFixed(2)));
}

/** Legacy `withMm`: a non-blank value gains its unit. */
export function withMm(v: NumericInput): string {
    const s = String(v ?? '').trim();
    return s ? `${s}mm` : '';
}
