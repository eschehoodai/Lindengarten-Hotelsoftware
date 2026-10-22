import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

export interface ConfirmDialogDetail {
  label: string;
  value: React.ReactNode;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  details?: ConfirmDialogDetail[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  hint?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  details,
  confirmLabel = '[Enter] Löschen',
  cancelLabel = '[Esc] Abbrechen',
  danger = true,
  hint,
  onConfirm,
  onClose,
}) => {
  // Tastatursteuerung: Enter zum Bestätigen, Escape zum Abbrechen
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        // Falls der Fokus nicht gerade auf dem Abbrechen-Button liegt
        const activeEl = document.activeElement;
        if (activeEl && activeEl.getAttribute('data-action') === 'cancel') {
          return;
        }
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100"
    >
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 select-none">
        
        {/* Kopfzeile */}
        <div
          className={`px-4 py-3 flex items-center justify-between text-white ${
            danger ? 'bg-rose-700' : 'bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {danger ? (
              <Trash2 className="w-4 h-4 text-rose-200" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
            <span className="text-sm font-bold tracking-wide">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded hover:bg-black/10 transition-colors cursor-pointer"
            title="Abbrechen (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inhalt */}
        <div className="p-4 flex flex-col gap-3 text-xs text-slate-700 leading-relaxed">
          <div
            className={`p-3 rounded font-medium border ${
              danger
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            {message}
          </div>

          {/* Details (z.B. Datensatzdaten, Buchungsnummer, Betrag) */}
          {details && details.length > 0 && (
            <div className="border border-slate-200 rounded p-2.5 bg-slate-50 font-mono text-[11px] flex flex-col gap-1.5">
              {details.map((item, idx) => (
                <div key={idx} className="flex justify-between items-baseline gap-2">
                  <span className="text-slate-500 font-sans">{item.label}:</span>
                  <span className="font-bold text-slate-800 truncate text-right">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Hinweis */}
          {hint && (
            <div className="text-[11px] text-slate-500 leading-normal">
              {hint}
            </div>
          )}
        </div>

        {/* Footer-Buttons */}
        <div className="bg-slate-100 px-4 py-3 border-t border-slate-300 flex justify-end items-center gap-2">
          <button
            type="button"
            data-action="cancel"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-200 border border-slate-300 cursor-pointer transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-action="confirm"
            onClick={() => onConfirm()}
            className={`px-4 py-1.5 rounded text-xs font-bold text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors active:translate-y-px ${
              danger
                ? 'bg-rose-700 hover:bg-rose-800'
                : 'bg-[#376189] hover:bg-[#2c4f70]'
            }`}
          >
            {danger && <Trash2 className="w-3.5 h-3.5" />}
            <span>{confirmLabel}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
