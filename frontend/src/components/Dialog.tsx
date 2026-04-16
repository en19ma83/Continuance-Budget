import { useEffect, useRef } from 'react';
import { LucideAlertTriangle, LucideX } from 'lucide-react';

type DialogBase = {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger';
    onCancel: () => void;
};

type ConfirmDialogProps = DialogBase & {
    type: 'confirm';
    onConfirm: () => void;
};

type PromptDialogProps = DialogBase & {
    type: 'prompt';
    inputLabel?: string;
    defaultValue?: string;
    inputType?: string;
    onConfirm: (value: string) => void;
    value: string;
    onChange: (v: string) => void;
};

export type DialogProps = ConfirmDialogProps | PromptDialogProps;

export function Dialog(props: DialogProps) {
    const { title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default', onCancel } = props;
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (props.type === 'prompt') inputRef.current?.select();
    }, [props.type]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel]);

    const handleConfirm = () => {
        if (props.type === 'confirm') props.onConfirm();
        else if (props.value.trim()) props.onConfirm(props.value);
    };

    const isDanger = variant === 'danger';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Card */}
            <div className="relative z-10 w-full max-w-md bg-[#1e1e1e] dark:bg-[#1e1e1e] bg-white border border-[#3c3c3c] dark:border-[#3c3c3c] border-gray-200 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-150">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {isDanger && <LucideAlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
                        <h3 className="text-base font-bold text-gray-900 dark:text-[#cccccc]">{title}</h3>
                    </div>
                    <button onClick={onCancel} className="p-1 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200">
                        <LucideX className="w-4 h-4" />
                    </button>
                </div>

                {message && (
                    <p className="text-sm text-slate-400 mb-4">{message}</p>
                )}

                {props.type === 'prompt' && (
                    <div className="mb-5">
                        {props.inputLabel && (
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
                                {props.inputLabel}
                            </label>
                        )}
                        <input
                            ref={inputRef}
                            type={props.inputType ?? 'text'}
                            value={props.value}
                            onChange={e => props.onChange(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                            className="w-full bg-[#2d2d30] dark:bg-[#2d2d30] bg-gray-100 border border-[#555] dark:border-[#555] border-gray-300 rounded-lg px-4 py-2.5 text-sm text-[#cccccc] dark:text-[#cccccc] text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 bg-gray-100 hover:bg-gray-200 text-slate-400 hover:text-slate-200 dark:hover:text-slate-200 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={props.type === 'prompt' && !props.value.trim()}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            isDanger
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
