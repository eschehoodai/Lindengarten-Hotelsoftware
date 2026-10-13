import React from 'react';
import { Check, Plus, Copy, Edit, Trash2, Power, HelpCircle, Save, X } from 'lucide-react';

interface ActionBarProps {
  onSelect?: () => void;
  onNew?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  onHelp?: () => void;
  isEditing?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canSelect?: boolean;
  canCopy?: boolean;
  selectLabel?: string;
  editLabel?: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onSelect,
  onNew,
  onCopy,
  onEdit,
  onDelete,
  onClose,
  onHelp,
  isEditing = false,
  canEdit = true,
  canDelete = true,
  canSelect = true,
  canCopy = true,
  selectLabel = '[F6] Wählen',
  editLabel = '[F9] Ändern',
}) => {
  return (
    <footer className="bg-slate-300 border-t border-slate-400 px-3 py-1.5 flex items-center justify-between shrink-0 shadow-inner select-none">
      <div className="flex items-center gap-1.5">
        {/* F6: Wählen */}
        <button
          onClick={onSelect}
          disabled={!canSelect || isEditing}
          className={`flex items-center gap-1.5 border border-slate-400 rounded px-3 py-1.2 text-xs font-semibold shadow-xs active:translate-y-px transition-all ${
            canSelect && !isEditing
              ? 'bg-white hover:bg-slate-100 text-slate-800 cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300'
          }`}
          title="Auswählen (F6)"
        >
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>{selectLabel}</span>
        </button>

        {/* F7: Neu / Einfügen */}
        <button
          onClick={onNew}
          disabled={isEditing}
          className={`flex items-center gap-1.5 border border-slate-400 rounded px-3 py-1.2 text-xs font-semibold shadow-xs active:translate-y-px transition-all ${
            !isEditing
              ? 'bg-white hover:bg-slate-100 text-slate-800 cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300'
          }`}
          title="Neu anlegen (F7)"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-600" />
          <span>[F7] Neu / Einfügen</span>
        </button>

        {/* F8: Kopieren */}
        {onCopy && (
          <button
            onClick={onCopy}
            disabled={isEditing}
            className={`flex items-center gap-1.5 border border-slate-400 rounded px-3 py-1.2 text-xs font-semibold shadow-xs active:translate-y-px transition-all ${
              !isEditing
                ? 'bg-white hover:bg-slate-100 text-slate-800 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300'
            }`}
            title="Datensatz duplizieren (F8)"
          >
            <Copy className="w-3.5 h-3.5 text-blue-600" />
            <span>[F8] Kopieren</span>
          </button>
        )}

        {/* F9: Ändern ODER Speichern */}
        <button
          onClick={onEdit}
          disabled={!canEdit}
          className={`flex items-center gap-1.5 border rounded px-3 py-1.2 text-xs font-semibold shadow-xs active:translate-y-px transition-all ${
            isEditing
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 cursor-pointer animate-pulse'
              : canEdit
              ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-400 cursor-pointer'
              : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
          }`}
          title={isEditing ? 'Speichern (F9)' : 'Datensatz bearbeiten (F9)'}
        >
          {isEditing ? (
            <>
              <Save className="w-3.5 h-3.5 text-white" />
              <span>[F9] Speichern</span>
            </>
          ) : (
            <>
              <Edit className="w-3.5 h-3.5 text-purple-600" />
              <span>{editLabel}</span>
            </>
          )}
        </button>

        {/* Entf: Löschen */}
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={!canDelete || isEditing}
            className={`flex items-center gap-1.5 border border-slate-400 rounded px-3 py-1.2 text-xs font-semibold shadow-xs active:translate-y-px transition-all ${
              canDelete && !isEditing
                ? 'bg-white hover:bg-slate-100 text-slate-800 cursor-pointer'
                : 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed'
            }`}
            title="Löschen / Stornieren (Entf)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>[Entf] Löschen</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Esc: Abbrechen oder Beenden */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white border border-slate-800 rounded px-3 py-1.2 text-xs font-semibold shadow-xs active:translate-y-px transition-all cursor-pointer"
          title={isEditing ? 'Abbrechen (Esc)' : 'Schließen / Beenden (Esc)'}
        >
          {isEditing ? (
            <>
              <X className="w-3.5 h-3.5 text-rose-400" />
              <span>[Esc] Abbrechen</span>
            </>
          ) : (
            <>
              <Power className="w-3.5 h-3.5 text-amber-400" />
              <span>[Esc] Beenden</span>
            </>
          )}
        </button>

        {/* Hilfe */}
        {onHelp && (
          <button
            onClick={onHelp}
            className="flex items-center justify-center bg-white hover:bg-slate-100 border border-slate-400 rounded p-1.5 text-xs text-slate-600 shadow-xs cursor-pointer"
            title="Hilfe anzeigen"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </footer>
  );
};
