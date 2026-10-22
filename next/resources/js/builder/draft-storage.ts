import type { DraftQuotation } from './model';

/* Local draft autosave (handoff §7). A local draft is NOT a saved quotation:
   it never gets a Q-number, lives only in this browser, and belongs to the
   signed-in named user (the key is namespaced by username). Every storage call
   is wrapped — private mode, a full quota or blocked storage simply means no
   recovery, never a broken Builder. */

export const DRAFT_VERSION = 2;
const PREFIX = 'dnc-quo:builder-draft';

export interface StoredDraft {
    v: typeof DRAFT_VERSION;
    savedAt: string;
    /** Who owned the draft (named user). */
    username: string;
    quotation: DraftQuotation;
}

/** One key per named user and per draft slot ('new' = an unsaved new quotation). */
export function draftKey(username: string, slot = 'new'): string {
    return `${PREFIX}:v${DRAFT_VERSION}:${encodeURIComponent(username || 'anonymous')}:${slot}`;
}

function storage(): Storage | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
}

/**
 * v1 drafts (Session E before Owner Smoke #2 Loop #1) priced with a single
 * `mode` + `manualUnitPrice`, and called Batch Add rows 'quick'. They are
 * carried forward, never dropped: manual → override, no_round → noRound,
 * 'quick' → 'batch'.
 */
export function migrateV1(q: DraftQuotation): DraftQuotation {
    return {
        ...q,
        items: q.items.map((raw) => {
            const it = raw as unknown as Record<string, unknown> & { pricing: Record<string, unknown> };
            const pr = it.pricing ?? {};
            const mode = String(pr.mode ?? 'calculated');
            const pricing = {
                costRate: (pr.costRate as string | null) ?? null,
                addCost: (pr.addCost as string | null) ?? null,
                markup: (pr.markup as string | null) ?? null,
                noRound: mode === 'no_round',
                override: mode === 'manual' ? String(pr.manualUnitPrice ?? '') : null,
            };
            return { ...(it as object), entryMode: it.entryMode === 'quick' ? 'batch' : it.entryMode, pricing } as unknown as DraftQuotation['items'][number];
        }),
    };
}

function looksLikeQuotation(v: unknown): v is DraftQuotation {
    if (!v || typeof v !== 'object') return false;
    const q = v as Record<string, unknown>;
    return (
        typeof q.quoteDate === 'string' &&
        typeof q.validUntil === 'string' &&
        typeof q.remarks === 'string' &&
        Array.isArray(q.items) &&
        !!q.customer &&
        typeof q.customer === 'object'
    );
}

export function loadDraft(username: string, slot = 'new'): StoredDraft | null {
    const s = storage();
    if (!s) return null;
    try {
        // a v1 draft lives under the v1 key until it is carried forward
        const raw = s.getItem(draftKey(username, slot)) ?? s.getItem(draftKey(username, slot).replace(`:v${DRAFT_VERSION}:`, ':v1:'));
        if (!raw) return null;
        let parsed = JSON.parse(raw) as Omit<Partial<StoredDraft>, 'v'> & { v?: number };
        if (parsed.v === 1 && looksLikeQuotation(parsed.quotation)) parsed = { ...parsed, v: DRAFT_VERSION, quotation: migrateV1(parsed.quotation) };
        if (parsed.v !== DRAFT_VERSION || parsed.username !== username || !looksLikeQuotation(parsed.quotation) || typeof parsed.savedAt !== 'string') {
            return null;
        }
        return parsed as StoredDraft;
    } catch {
        return null;
    }
}

/** Returns the saved timestamp, or null when the browser refused. */
export function saveDraft(username: string, quotation: DraftQuotation, slot = 'new', now: Date = new Date()): string | null {
    const s = storage();
    if (!s) return null;
    const savedAt = now.toISOString();
    try {
        const payload: StoredDraft = { v: DRAFT_VERSION, savedAt, username, quotation };
        s.setItem(draftKey(username, slot), JSON.stringify(payload));
        return savedAt;
    } catch {
        return null;
    }
}

export function clearDraft(username: string, slot = 'new'): void {
    const s = storage();
    if (!s) return;
    try {
        s.removeItem(draftKey(username, slot));
        s.removeItem(draftKey(username, slot).replace(`:v${DRAFT_VERSION}:`, ':v1:'));
    } catch {
        /* nothing to clear */
    }
}
