import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { emptyMetrics, today } from "../lib";
import { statuses } from "../types";
import type { Client, Metrics, Note, Status, Task } from "../types";
import "./editors.css";

type Save = (data: Record<string, unknown>) => Promise<void>;

const clientColors = [
  { value: "#d9a175", name: "Terracota" },
  { value: "#7f9c83", name: "Verde" },
  { value: "#8b9fae", name: "Azul" },
  { value: "#b59bc4", name: "Lilás" },
  { value: "#d599ad", name: "Rosa" },
  { value: "#c3ad6e", name: "Dourado" },
];
const coverColors = [
  { value: "peach", color: "#edd8c6", name: "Pêssego" },
  { value: "sage", color: "#d9e2cf", name: "Sálvia" },
  { value: "pink", color: "#efd6dc", name: "Rosa" },
  { value: "blue", color: "#d7e3e8", name: "Azul" },
  { value: "sand", color: "#e8dfc7", name: "Areia" },
];
const noteColors = [
  { value: "yellow", color: "#f6edcc", name: "Amarelo" },
  { value: "pink", color: "#f1dce2", name: "Rosa" },
  { value: "green", color: "#e1e9d8", name: "Verde" },
  { value: "blue", color: "#dfebef", name: "Azul" },
];

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const getFocusable = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter(
        (element) => !element.hidden && element.getClientRects().length > 0,
      );
    const focusFrame = requestAnimationFrame(() => {
      const initial = dialog.current?.querySelector<HTMLElement>(
        "[data-initial-focus]",
      );
      (initial || getFocusable()[0] || dialog.current)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.current?.focus();
        return;
      }
      if (
        !dialog.current?.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-panel${wide ? " modal-panel-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={subtitle ? `${id}-subtitle` : undefined}
        ref={dialog}
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <p className="modal-eyebrow">COMPASSO SOCIAL</p>
            <h2 id={`${id}-title`}>{title}</h2>
            {subtitle && (
              <p id={`${id}-subtitle`} className="modal-subtitle">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Fechar janela"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function useSave(onSave: Save) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function save(data: Record<string, unknown>) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave(data);
    } catch (err) {
      if (mounted.current)
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível salvar. Tente novamente.",
        );
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return { saving, error, save };
}

function FormError({ error }: { error: string }) {
  return error ? (
    <div role="alert" className="form-error">
      <AlertCircle size={17} />
      <span>{error}</span>
    </div>
  ) : null;
}

function FormFooter({
  saving,
  onClose,
  label,
  disabled = false,
}: {
  saving: boolean;
  onClose: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <footer className="modal-footer">
      <span className="form-required-hint">* Campos obrigatórios</span>
      <div className="modal-footer-actions">
        <button
          type="button"
          className="button secondary"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="button primary"
          disabled={saving || disabled}
        >
          {saving ? (
            <Loader2 size={16} className="form-spinner" />
          ) : (
            <Check size={16} />
          )}
          {saving ? "Salvando…" : label}
        </button>
      </div>
    </footer>
  );
}

function ColorPicker({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; color?: string; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-colors">
      {options.map((option) => (
        <label
          key={option.value}
          className="form-color-option"
          title={option.name}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span
            className="form-color-swatch"
            style={{ backgroundColor: option.color || option.value }}
          >
            {value === option.value && <Check size={17} />}
          </span>
          <span className="form-visually-hidden">{option.name}</span>
        </label>
      ))}
    </div>
  );
}

type TaskDraft = Omit<Task, "id" | "createdAt" | "tags">;

export function TaskEditor({
  task,
  clients,
  onClose,
  onSave,
  initialDate,
  initialStatus,
}: {
  task: Task | null;
  clients: Client[];
  onClose: () => void;
  onSave: Save;
  initialDate?: string;
  initialStatus?: Status;
}) {
  const id = useId();
  const { saving, error, save } = useSave(onSave);
  const [form, setForm] = useState<TaskDraft>(() => ({
    title: task?.title || "",
    clientId: task?.clientId || clients[0]?.id || "",
    status: task?.status || initialStatus || "idea",
    format: task?.format || "Post",
    channel: task?.channel || "Instagram",
    date: task?.date || initialDate || today(),
    time: task?.time || "09:00",
    priority: task?.priority || "medium",
    assignee: task?.assignee || "Você",
    description: task?.description || "",
    metrics: task?.metrics || emptyMetrics(),
    cover: task?.cover || "peach",
  }));
  const [tags, setTags] = useState(task?.tags.join(", ") || "");
  function update<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!clients.length) return;
    void save({
      ...form,
      title: form.title.trim(),
      assignee: form.assignee.trim(),
      description: form.description.trim(),
      tags: [
        ...new Set(
          tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
    });
  }
  const formats = ["Post", "Carrossel", "Reels", "Story"];
  const channels = ["Instagram", "Facebook", "TikTok", "LinkedIn"];
  const close = () => {
    if (!saving) onClose();
  };
  return (
    <Modal
      title={task ? "Editar demanda" : "Nova demanda"}
      subtitle="Da primeira ideia ao conteúdo publicado, tudo no seu ritmo."
      onClose={close}
      wide
    >
      <form onSubmit={submit} className="modal-form" aria-busy={saving}>
        <div className="modal-body">
          <FormError error={error} />
          {!clients.length && (
            <div className="form-warning" role="status">
              <AlertCircle size={17} />
              <span>Cadastre um cliente antes de criar uma demanda.</span>
            </div>
          )}
          <div className="form-grid">
            <div className="form-field form-full">
              <label htmlFor={`${id}-title`}>
                Título da demanda <span>*</span>
              </label>
              <input
                id={`${id}-title`}
                data-initial-focus
                required
                maxLength={180}
                placeholder="Ex.: Carrossel — ideias para uma rotina mais leve"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-client`}>
                Cliente <span>*</span>
              </label>
              <select
                id={`${id}-client`}
                value={form.clientId}
                required
                onChange={(e) => update("clientId", e.target.value)}
              >
                {!clients.length && (
                  <option value="">Nenhum cliente cadastrado</option>
                )}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-status`}>Etapa</label>
              <select
                id={`${id}-status`}
                value={form.status}
                onChange={(e) => update("status", e.target.value as Status)}
              >
                {Object.entries(statuses).map(([value, status]) => (
                  <option key={value} value={value}>
                    {status.short}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-format`}>Formato</label>
              <select
                id={`${id}-format`}
                value={form.format}
                onChange={(e) => update("format", e.target.value)}
              >
                {formats.map((format) => (
                  <option key={format}>{format}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-channel`}>Canal</label>
              <select
                id={`${id}-channel`}
                value={form.channel}
                onChange={(e) => update("channel", e.target.value)}
              >
                {channels.map((channel) => (
                  <option key={channel}>{channel}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-date`}>
                Data planejada <span>*</span>
              </label>
              <input
                id={`${id}-date`}
                type="date"
                required
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-time`}>
                Horário <span>*</span>
              </label>
              <input
                id={`${id}-time`}
                type="time"
                required
                value={form.time}
                onChange={(e) => update("time", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-priority`}>Prioridade</label>
              <select
                id={`${id}-priority`}
                value={form.priority}
                onChange={(e) =>
                  update("priority", e.target.value as Task["priority"])
                }
              >
                <option value="low">Baixa · sem pressa</option>
                <option value="medium">Média · no ritmo</option>
                <option value="high">Alta · atenção especial</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-assignee`}>Responsável</label>
              <input
                id={`${id}-assignee`}
                placeholder="Nome do responsável"
                maxLength={80}
                value={form.assignee}
                onChange={(e) => update("assignee", e.target.value)}
              />
            </div>
            <div className="form-field form-full">
              <label htmlFor={`${id}-tags`}>Etiquetas</label>
              <input
                id={`${id}-tags`}
                placeholder="Campanha, educativo, lançamento"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                aria-describedby={`${id}-tags-hint`}
              />
              <p className="form-hint" id={`${id}-tags-hint`}>
                Separe as etiquetas com vírgulas para encontrar tudo depois.
              </p>
            </div>
            <div className="form-field form-full">
              <label htmlFor={`${id}-description`}>
                Briefing e observações
              </label>
              <textarea
                id={`${id}-description`}
                rows={4}
                maxLength={12000}
                placeholder="Objetivo, referências, legenda, links e o que mais a criação precisa saber…"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
            <fieldset className="form-fieldset form-full">
              <legend>Cor da capa</legend>
              <ColorPicker
                name={`${id}-cover`}
                value={form.cover}
                options={coverColors}
                onChange={(value) => update("cover", value)}
              />
            </fieldset>
          </div>
          {form.status === "published" && (
            <section className="form-metrics" aria-labelledby={`${id}-metrics`}>
              <h3 id={`${id}-metrics`}>Resultados da publicação</h3>
              <p>
                Registre os números para acompanhar a evolução nos relatórios.
              </p>
              <div className="form-metrics-grid">
                {(
                  [
                    ["reach", "Alcance"],
                    ["impressions", "Impressões"],
                    ["likes", "Curtidas"],
                    ["comments", "Comentários"],
                    ["saves", "Salvamentos"],
                  ] as [keyof Metrics, string][]
                ).map(([key, label]) => (
                  <div className="form-field" key={key}>
                    <label htmlFor={`${id}-${key}`}>{label}</label>
                    <input
                      id={`${id}-${key}`}
                      type="number"
                      min={0}
                      max={Number.MAX_SAFE_INTEGER}
                      step={1}
                      inputMode="numeric"
                      value={form.metrics[key]}
                      onChange={(e) =>
                        update("metrics", {
                          ...form.metrics,
                          [key]:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <FormFooter
          saving={saving}
          onClose={close}
          label={task ? "Salvar alterações" : "Criar demanda"}
          disabled={!clients.length}
        />
      </form>
    </Modal>
  );
}

export function ClientEditor({
  client,
  onClose,
  onSave,
}: {
  client: Client | null;
  onClose: () => void;
  onSave: Save;
}) {
  const id = useId();
  const { saving, error, save } = useSave(onSave);
  const [form, setForm] = useState(() => ({
    name: client?.name || "",
    segment: client?.segment || "",
    contact: client?.contact || "",
    email: client?.email || "",
    color: client?.color || clientColors[0].value,
  }));
  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  const colors = clientColors.some((option) => option.value === form.color)
    ? clientColors
    : [...clientColors, { value: form.color, name: "Cor atual" }];
  function submit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toLocaleUpperCase("pt-BR");
    void save({
      ...form,
      name,
      segment: form.segment.trim(),
      contact: form.contact.trim(),
      email: form.email.trim(),
      initials,
    });
  }
  const close = () => {
    if (!saving) onClose();
  };
  return (
    <Modal
      title={client ? "Editar cliente" : "Novo cliente"}
      subtitle="Cada marca tem uma história. Vamos organizar a próxima."
      onClose={close}
    >
      <form onSubmit={submit} className="modal-form" aria-busy={saving}>
        <div className="modal-body">
          <FormError error={error} />
          <div className="form-grid">
            <div className="form-field form-full">
              <label htmlFor={`${id}-name`}>
                Nome da marca <span>*</span>
              </label>
              <input
                id={`${id}-name`}
                data-initial-focus
                required
                maxLength={100}
                placeholder="Como seu cliente se chama?"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div className="form-field form-full">
              <label htmlFor={`${id}-segment`}>Segmento</label>
              <input
                id={`${id}-segment`}
                maxLength={100}
                placeholder="Ex.: Gastronomia, moda, saúde…"
                value={form.segment}
                onChange={(e) => update("segment", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-contact`}>Pessoa de contato</label>
              <input
                id={`${id}-contact`}
                maxLength={120}
                placeholder="Nome ou telefone"
                value={form.contact}
                onChange={(e) => update("contact", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor={`${id}-email`}>E-mail</label>
              <input
                id={`${id}-email`}
                type="email"
                maxLength={180}
                placeholder="contato@marca.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <fieldset className="form-fieldset form-full">
              <legend>Cor de identificação</legend>
              <ColorPicker
                name={`${id}-color`}
                value={form.color}
                options={colors}
                onChange={(value) => update("color", value)}
              />
              <p className="form-hint">
                A cor acompanha a marca nas demandas e no calendário.
              </p>
            </fieldset>
          </div>
        </div>
        <FormFooter
          saving={saving}
          onClose={close}
          label={client ? "Salvar alterações" : "Adicionar cliente"}
        />
      </form>
    </Modal>
  );
}

export function NoteEditor({
  note,
  clients,
  onClose,
  onSave,
}: {
  note: Note | null;
  clients: Client[];
  onClose: () => void;
  onSave: Save;
}) {
  const id = useId();
  const { saving, error, save } = useSave(onSave);
  const [form, setForm] = useState(() => ({
    title: note?.title || "",
    content: note?.content || "",
    color: note?.color || "yellow",
    clientId: note?.clientId || "",
  }));
  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void save({
      ...form,
      title: form.title.trim(),
      content: form.content.trim(),
    });
  }
  const close = () => {
    if (!saving) onClose();
  };
  return (
    <Modal
      title={note ? "Editar anotação" : "Nova anotação"}
      subtitle="Dê um lugar para as ideias que não podem escapar."
      onClose={close}
    >
      <form onSubmit={submit} className="modal-form" aria-busy={saving}>
        <div className="modal-body">
          <FormError error={error} />
          <div className="form-grid">
            <div className="form-field form-full">
              <label htmlFor={`${id}-title`}>
                Título <span>*</span>
              </label>
              <input
                id={`${id}-title`}
                data-initial-focus
                required
                maxLength={160}
                placeholder="Uma ideia, uma referência, um lembrete…"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </div>
            <div className="form-field form-full">
              <label htmlFor={`${id}-content`}>
                Anotação <span>*</span>
              </label>
              <textarea
                id={`${id}-content`}
                required
                rows={7}
                maxLength={20000}
                placeholder="Escreva livremente. Ideias boas começam assim."
                value={form.content}
                onChange={(e) => update("content", e.target.value)}
              />
            </div>
            <div className="form-field form-full">
              <label htmlFor={`${id}-client`}>Cliente relacionado</label>
              <select
                id={`${id}-client`}
                value={form.clientId}
                onChange={(e) => update("clientId", e.target.value)}
              >
                <option value="">Geral · todas as ideias são bem-vindas</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="form-fieldset form-full">
              <legend>Cor da anotação</legend>
              <ColorPicker
                name={`${id}-color`}
                value={form.color}
                options={noteColors}
                onChange={(value) => update("color", value)}
              />
            </fieldset>
          </div>
        </div>
        <FormFooter
          saving={saving}
          onClose={close}
          label={note ? "Salvar alterações" : "Guardar anotação"}
        />
      </form>
    </Modal>
  );
}
