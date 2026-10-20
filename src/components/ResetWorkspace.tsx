import { useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { Modal } from "./Editors";
import type { State } from "../types";

export function ResetWorkspace({
  state,
  onClose,
  onReset,
}: {
  state: State;
  onClose: () => void;
  onReset: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canReset = confirmation.trim() === "LIMPAR" && !busy;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canReset) return;
    setBusy(true);
    setError("");
    try {
      await onReset();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Começar do zero"
      subtitle="Prepare um espaço em branco para os seus clientes e conteúdos."
      onClose={() => !busy && onClose()}
    >
      <form className="modal-form" onSubmit={submit} aria-busy={busy}>
        <div className="modal-body">
          <div className="reset-warning">
            <Trash2 size={22} />
            <div>
              <h3>Todos os registros deste app serão removidos</h3>
              <p>
                Inclui clientes, demandas, checklists, anotações, métricas e
                histórico de atividades. Uma cópia de segurança será criada
                antes da limpeza.
              </p>
            </div>
          </div>
          <div className="reset-counts">
            <span>
              <strong>{state.clients.length}</strong> clientes
            </span>
            <span>
              <strong>{state.tasks.length}</strong> demandas
            </span>
            <span>
              <strong>{state.checklist.length}</strong> tarefas
            </span>
            <span>
              <strong>{state.notes.length}</strong> anotações
            </span>
          </div>
          {error && (
            <p className="form-error" role="alert">
              <AlertCircle size={16} />
              {error}
            </p>
          )}
          <div className="form-field">
            <label htmlFor="reset-confirmation">
              Digite LIMPAR para confirmar
            </label>
            <input
              id="reset-confirmation"
              data-initial-focus
              autoComplete="off"
              spellCheck={false}
              placeholder="LIMPAR"
              value={confirmation}
              disabled={busy}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
        </div>
        <footer className="modal-footer">
          <span className="form-required-hint">
            A limpeza vale para este workspace.
          </span>
          <div className="modal-footer-actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="button danger"
              type="submit"
              disabled={!canReset}
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Trash2 size={16} />
              )}
              {busy ? "Limpando…" : "Limpar todos os dados"}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
