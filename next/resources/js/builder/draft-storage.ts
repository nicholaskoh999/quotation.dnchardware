import type { DraftQuotation } from './model';

/* Local draft autosave (handoff §7). A local draft is NOT a saved quotation:
   it never gets a Q-number, lives only in this browser, and belongs to the
   signed-in named user (the key is namespaced by username). Every storage call
   is wrapped — private mode, a full quota or blocked storage simply means no
   recovery, never a broken Builder. */

export const DRAFT_VERSION = 1;
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
        const raw = s.getItem(draftKey(username, slot));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StoredDraft>;
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
    } catch {
        /* nothing to clear */
    }
}
