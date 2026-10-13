import { useEffect } from 'react';

export interface ShortcutHandlers {
  onF1?: () => void;
  onF2?: () => void;
  onF3?: () => void;
  onF4?: () => void;
  onF6?: () => void;
  onF7?: () => void;
  onF8?: () => void;
  onF9?: () => void;
  onDelete?: () => void;
  onEscape?: () => void;
  onEnter?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Wenn der Benutzer gerade in einem Textfeld tippt, fangen wir Enter und Escape ab,
      // lassen aber normale Buchstabentasten durch.
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          handlers.onF1?.();
          break;
        case 'F2':
          e.preventDefault();
          handlers.onF2?.();
          break;
        case 'F3':
          e.preventDefault();
          handlers.onF3?.();
          break;
        case 'F4':
          e.preventDefault();
          handlers.onF4?.();
          break;
        case 'F6':
          e.preventDefault();
          handlers.onF6?.();
          break;
        case 'F7':
          e.preventDefault();
          handlers.onF7?.();
          break;
        case 'F8':
          e.preventDefault();
          handlers.onF8?.();
          break;
        case 'F9':
          e.preventDefault();
          handlers.onF9?.();
          break;
        case 'Delete':
          if (!isInput) {
            e.preventDefault();
            handlers.onDelete?.();
          }
          break;
        case 'Escape':
          e.preventDefault();
          handlers.onEscape?.();
          break;
        case 'Enter':
          if (!isInput && handlers.onEnter) {
            e.preventDefault();
            handlers.onEnter();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
}
