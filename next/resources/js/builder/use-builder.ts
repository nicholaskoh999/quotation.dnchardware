import { router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { clearDraft, loadDraft, saveDraft, type StoredDraft } from './draft-storage';
import { duplicateItem, emptyQuotation, isMeaningful, type CustomerDraft, type DraftItem, type DraftQuotation } from './model';
import { readQuotation } from './quotation';

/* Builder state + local draft lifecycle (handoff §7, Session E §15/§16).

   - Autosave: meaningful edits are written to this browser (per named user)
     shortly after they happen; the status says so ("Saved on this device"),
     never "Saved" — a local draft is not a quotation.
   - Recovery is explicit: a draft found on load is OFFERED (Continue / Discard);
     until the person chooses, autosave is paused so the recovered draft can
     never be overwritten by a fresh, empty page.
   - Leave protection: while there are meaningful unsaved entries, an in-app
     navigation asks first and a browser close / refresh gets the browser's
     own warning. Nothing meaningful ⇒ no warning. */

type Action =
    | { type: 'replace'; quotation: DraftQuotation }
    | { type: 'customer'; patch: Partial<CustomerDraft> }
    | { type: 'header'; patch: Partial<Pick<DraftQuotation, 'quoteDate' | 'validUntil' | 'remarks'>> }
    | { type: 'addItems'; items: DraftItem[] }
    | { type: 'updateItem'; item: DraftItem }
    | { type: 'insertItem'; item: DraftItem; index: number }
    | { type: 'removeItem'; uid: string }
    | { type: 'moveItem'; uid: string; dir: -1 | 1 };

export function builderReducer(state: DraftQuotation, action: Action): DraftQuotation {
    switch (action.type) {
        case 'replace':
            return action.quotation;
        case 'customer':
            return { ...state, customer: { ...state.customer, ...action.patch } };
        case 'header':
            return { ...state, ...action.patch };
        case 'addItems':
            return { ...state, items: [...state.items, ...action.items] };
        case 'updateItem':
            return { ...state, items: state.items.map((i) => (i.uid === action.item.uid ? action.item : i)) };
        case 'insertItem': {
            const items = [...state.items];
            items.splice(Math.max(0, Math.min(action.index, items.length)), 0, action.item);
            return { ...state, items };
        }
        case 'removeItem':
            return { ...state, items: state.items.filter((i) => i.uid !== action.uid) };
        case 'moveItem': {
            const from = state.items.findIndex((i) => i.uid === action.uid);
            const to = from + action.dir;
            if (from < 0 || to < 0 || to >= state.items.length) return state;
            const items = [...state.items];
            const [moved] = items.splice(from, 1);
            items.splice(to, 0, moved!);
            return { ...state, items };
        }
    }
}

export type DraftStatus =
    | { state: 'empty' }
    | { state: 'pending' }
    | { state: 'saved'; savedAt: string }
    | { state: 'unavailable' }
    /** A recovered draft is on offer: nothing new is kept until the person chooses. */
    | { state: 'paused' };

export const LEAVE_MESSAGE = 'This quotation is not saved yet. Your draft stays on this device, but leave this page anyway?';

export interface UseBuilderOptions {
    username: string;
    todayIso: string;
    /** Autosave delay (ms). */
    autosaveDelay?: number;
}

export function useBuilder({ username, todayIso, autosaveDelay = 600 }: UseBuilderOptions) {
    const [quotation, dispatch] = useReducer(builderReducer, todayIso, emptyQuotation);
    // A stored draft is read synchronously on the first render, so nothing —
    // not even the empty first autosave pass — can touch it before the person
    // has chosen Continue or Discard.
    const [recovered, setRecovered] = useState<StoredDraft | null>(() => {
        const stored = loadDraft(username);
        return stored && isMeaningful(stored.quotation) ? stored : null;
    });
    const [draftStatus, setDraftStatus] = useState<DraftStatus>({ state: 'empty' });
    const firstRun = useRef(true);
    const skipNextSave = useRef(false);

    const meaningful = isMeaningful(quotation);

    // Autosave (paused while a recovered draft is still on offer).
    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        if (recovered) {
            setDraftStatus(meaningful ? { state: 'paused' } : { state: 'empty' });
            return;
        }
        if (skipNextSave.current) {
            skipNextSave.current = false;
            return;
        }
        if (!meaningful) {
            clearDraft(username);
            setDraftStatus({ state: 'empty' });
            return;
        }
        setDraftStatus({ state: 'pending' });
        const t = window.setTimeout(() => {
            const savedAt = saveDraft(username, quotation);
            setDraftStatus(savedAt ? { state: 'saved', savedAt } : { state: 'unavailable' });
        }, autosaveDelay);
        return () => window.clearTimeout(t);
    }, [quotation, meaningful, recovered, username, autosaveDelay]);

    // Leave protection.
    const guardRef = useRef(false);
    guardRef.current = meaningful;
    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!guardRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        const off = router.on('before', (event) => {
            if (!guardRef.current) return;
            const visit = event.detail.visit;
            // Only navigations away (GET visits to another URL).
            if (visit.method !== 'get') return;
            if (!window.confirm(LEAVE_MESSAGE)) return false;
            return;
        });
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            off();
        };
    }, []);

    const reading = useMemo(() => readQuotation(quotation), [quotation]);

    const continueDraft = useCallback(() => {
        if (!recovered) return;
        skipNextSave.current = true; // the same content is already stored
        dispatch({ type: 'replace', quotation: recovered.quotation });
        setDraftStatus({ state: 'saved', savedAt: recovered.savedAt });
        setRecovered(null);
    }, [recovered]);

    /** Throws the stored draft away (the caller confirms first). */
    const discardRecovered = useCallback(() => {
        clearDraft(username);
        setRecovered(null);
    }, [username]);

    /** Clears the working quotation and its local draft (the caller confirms first). */
    const discardCurrent = useCallback(() => {
        clearDraft(username);
        skipNextSave.current = true;
        dispatch({ type: 'replace', quotation: emptyQuotation(todayIso) });
        setDraftStatus({ state: 'empty' });
    }, [username, todayIso]);

    const actions = useMemo(
        () => ({
            setCustomer: (patch: Partial<CustomerDraft>) => dispatch({ type: 'customer', patch }),
            setHeader: (patch: Partial<Pick<DraftQuotation, 'quoteDate' | 'validUntil' | 'remarks'>>) => dispatch({ type: 'header', patch }),
            addItems: (items: DraftItem[]) => dispatch({ type: 'addItems', items }),
            updateItem: (item: DraftItem) => dispatch({ type: 'updateItem', item }),
            insertItem: (item: DraftItem, index: number) => dispatch({ type: 'insertItem', item, index }),
            removeItem: (uid: string) => dispatch({ type: 'removeItem', uid }),
            moveItem: (uid: string, dir: -1 | 1) => dispatch({ type: 'moveItem', uid, dir }),
            duplicate: (item: DraftItem, index: number) => {
                const copy = duplicateItem(item);
                dispatch({ type: 'insertItem', item: copy, index: index + 1 });
                return copy;
            },
        }),
        [],
    );

    return { quotation, reading, actions, draftStatus, recovered, continueDraft, discardRecovered, discardCurrent, meaningful };
}
