import { toast } from 'sonner';

/* One vocabulary for visible feedback, so "no meaningful action may be silent"
   (handoff §3) is one call wherever an action completes. Ordinary typing, tab
   changes and sorting deliberately have no helper here. */
export const notify = {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast(message),
    undoable: (message: string, onUndo: () => void) =>
        toast(message, { action: { label: 'Undo', onClick: onUndo }, duration: 8000 }),
    /** "Item #7 added to quotation" + spec · Qty · total. One id, so rapid adds replace instead of stacking. */
    added: (title: string, detail: string) => toast.success(title, { description: detail, duration: 3000, id: 'builder-item-added' }),
    promise: <T,>(p: Promise<T>, msgs: { loading: string; success: string; error: string }) => toast.promise(p, msgs),
};
