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
    promise: <T,>(p: Promise<T>, msgs: { loading: string; success: string; error: string }) => toast.promise(p, msgs),
};
