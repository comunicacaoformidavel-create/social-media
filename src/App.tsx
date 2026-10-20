import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  Flag,
  Flower2,
  Instagram,
  LayoutDashboard,
  LayoutGrid,
  List,
  ListChecks,
  Loader2,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Workflow,
  X,
} from "lucide-react";
import type { CheckItem, Client, Page, State, Status, Task } from "./types";
import { pageNames, statuses } from "./types";
import { api, dateKey, formatDate, loadState, offsetDate, today } from "./lib";
import {
  ClientEditor,
  Modal,
  NoteEditor,
  TaskEditor,
} from "./components/Editors";
import { IntegrationsPage, ReportsPage } from "./components/InsightsPages";

const navItems: { page: Page; icon: typeof LayoutDashboard }[] = [
  { page: "overview", icon: LayoutDashboard },
  { page: "tasks", icon: LayoutGrid },
  { page: "calendar", icon: CalendarDays },
  { page: "checklist", icon: ListChecks },
  { page: "clients", icon: Users },
  { page: "notes", icon: BookOpen },
  { page: "reports", icon: TrendingUp },
  { page: "integrations", icon: Workflow },
];
type Editor =
  | { kind: "task"; task: Task | null; date?: string; status?: Status }
  | { kind: "client"; client: Client | null }
  | { kind: "note"; note: State["notes"][number] | null }
  | null;
type DeleteItem = {
  collection: "tasks" | "clients" | "notes" | "checklist";
  id: string;
  title: string;
} | null;

function ClientBadge({
  client,
  compact = false,
}: {
  client?: Client;
  compact?: boolean;
}) {
  return (
    <span className={`client-badge ${compact ? "compact" : ""}`}>
      <span
        className="client-dot"
        style={{ background: client?.color || "#c6c8bd" }}
      />
      {client?.name || "Sem cliente"}
    </span>
  );
}
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span />
      {statuses[status].short}
    </span>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Flower2 size={27} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Channel({ name, size = 14 }: { name: string; size?: number }) {
  return name === "Instagram" ? (
    <Instagram size={size} />
  ) : name === "LinkedIn" ? (
    <span className="channel-letter">in</span>
  ) : name === "TikTok" ? (
    <span className="channel-letter">♪</span>
  ) : (
    <span className="channel-letter">f</span>
  );
}

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("overview");
  const [clientId, setClientId] = useState("all");
  const [editor, setEditor] = useState<Editor>(null);
  const [deletion, setDeletion] = useState<DeleteItem>(null);
  const [deleting, setDeleting] = useState(false);
  const [settings, setSettings] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const searchInput = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    const data = await loadState();
    setState(data);
    setError("");
  }, []);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInput.current?.focus();
      }
      if (e.key === "Escape") {
        setNotifications(false);
        setSearchFocused(false);
        setMobileNav(false);
      }
    };
    window.addEventListener("keydown", handle);
    return () => {
      window.removeEventListener("keydown", handle);
      clearTimeout(toastTimer.current);
    };
  }, []);
  const navigate = (next: Page) => {
    setPage(next);
    setMobileNav(false);
    setSearchFocused(false);
    setNotifications(false);
    window.scrollTo(0, 0);
  };
  const mutate = async (
    path: string,
    method: string,
    body?: unknown,
    message?: string,
  ) => {
    await api(path, method, body);
    await refresh();
    if (message) notify(message);
  };
  const patchTask = async (task: Task, status: Status) => {
    try {
      await mutate(
        `/tasks/${task.id}`,
        "PATCH",
        { status },
        `Demanda movida para ${statuses[status].label.toLowerCase()}.`,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const saveEditor = async (body: Record<string, unknown>) => {
    if (!editor) return;
    const collection =
      editor.kind === "task"
        ? "tasks"
        : editor.kind === "client"
          ? "clients"
          : "notes";
    const existing =
      editor.kind === "task"
        ? editor.task
        : editor.kind === "client"
          ? editor.client
          : editor.note;
    await mutate(
      `/${collection}${existing ? `/${existing.id}` : ""}`,
      existing ? "PATCH" : "POST",
      body,
      existing ? "Alterações salvas." : "Tudo certo! Item criado.",
    );
    setEditor(null);
  };
  const deleteConfirmed = async () => {
    if (!deletion) return;
    setDeleting(true);
    try {
      await mutate(
        `/${deletion.collection}/${deletion.id}`,
        "DELETE",
        undefined,
        "Item excluído.",
      );
      setDeletion(null);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };
  const newTask = (date?: string, status?: Status) =>
    setEditor({ kind: "task", task: null, date, status });
  const editTask = (task: Task) => {
    setEditor({ kind: "task", task });
    setSearchFocused(false);
    setQuery("");
  };
  const toggleCheck = async (item: CheckItem) => {
    try {
      await mutate(`/checklist/${item.id}`, "PATCH", { done: !item.done });
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const addCheck = async (title: string, date: string) => {
    await mutate(
      "/checklist",
      "POST",
      { title, date, done: false },
      "Adicionado ao seu checklist.",
    );
  };

  if (!state)
    return (
      <div className="app-loading">
        <img src="/favicon.svg" alt="Compasso" width="54" height="54" />
        <h1>
          compasso<span>social</span>
        </h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="button primary"
              onClick={() => refresh().catch((e) => setError(e.message))}
            >
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <Loader2 className="spin" size={22} />
            <p>Preparando seu espaço criativo…</p>
          </>
        )}
      </div>
    );

  const filteredTasks = state.tasks.filter(
    (t) => clientId === "all" || t.clientId === clientId,
  );
  const searchText = query.trim().toLocaleLowerCase("pt-BR");
  const taskResults = searchText
    ? state.tasks
        .filter((t) =>
          `${t.title} ${t.description} ${t.tags.join(" ")}`
            .toLocaleLowerCase("pt-BR")
            .includes(searchText),
        )
        .slice(0, 5)
    : [];
  const noteResults = searchText
    ? state.notes
        .filter((n) =>
          `${n.title} ${n.content}`
            .toLocaleLowerCase("pt-BR")
            .includes(searchText),
        )
        .slice(0, 3)
    : [];
  const clientResults = searchText
    ? state.clients
        .filter((c) => c.name.toLocaleLowerCase("pt-BR").includes(searchText))
        .slice(0, 3)
    : [];
  const actions = {
    state,
    tasks: filteredTasks,
    onEdit: editTask,
    onNew: newTask,
    onNavigate: navigate,
    onPatch: patchTask,
  };
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="Compasso Social, início"
        >
          <span className="brand-symbol">
            <Flower2 size={32} strokeWidth={1.8} />
          </span>
          <span>
            compasso<small>S O C I A L</small>
          </span>
        </button>
        <button className="workspace-switch" onClick={() => setSettings(true)}>
          <span className="workspace-icon">
            E<span>✦</span>
          </span>
          <span>
            Estúdio criativo<small>Seu espaço de trabalho</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Navegação principal">
          {navItems.map(({ page: item, icon: Icon }, index) => (
            <button
              key={item}
              onClick={() => navigate(item)}
              className={`nav-item ${page === item ? "active" : ""} ${index === 6 ? "nav-divider" : ""}`}
              aria-current={page === item ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{pageNames[item]}</span>
              {item === "tasks" && (
                <span className="nav-count">
                  {state.tasks.filter((t) => t.status === "review").length}
                </span>
              )}
              {item === "integrations" && <span className="nav-new">novo</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="little-star">✳</span>
            <p>
              Boas ideias merecem
              <br />
              <strong>espaço para acontecer.</strong>
            </p>
            <span className="note-squiggle">~</span>
          </div>
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={18} />
            <span>Meu espaço</span>
          </button>
          <div className="local-status">
            <span />
            Dados salvos neste ambiente
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir navegação"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{pageNames[page]}</strong>
          </div>
          <div className="header-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                ref={searchInput}
                aria-label="Buscar demandas, clientes e notas"
                placeholder="Buscar no seu espaço…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
              />
              <kbd>⌘ K</kbd>
              {searchFocused && searchText && (
                <>
                  <button
                    className="search-backdrop"
                    aria-label="Fechar busca"
                    onClick={() => setSearchFocused(false)}
                  />
                  <div className="search-results">
                    <span className="eyebrow">RESULTADOS DA BUSCA</span>
                    {taskResults.map((t) => (
                      <button key={t.id} onClick={() => editTask(t)}>
                        <LayoutGrid size={16} />
                        <span>
                          {t.title}
                          <small>
                            Demanda ·{" "}
                            {
                              state.clients.find((c) => c.id === t.clientId)
                                ?.name
                            }
                          </small>
                        </span>
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                    {noteResults.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setEditor({ kind: "note", note: n });
                          setSearchFocused(false);
                          setQuery("");
                        }}
                      >
                        <BookOpen size={16} />
                        <span>
                          {n.title}
                          <small>Anotação</small>
                        </span>
                      </button>
                    ))}
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setClientId(c.id);
                          navigate("tasks");
                          setQuery("");
                        }}
                      >
                        <Users size={16} />
                        <span>
                          {c.name}
                          <small>Cliente · ver demandas</small>
                        </span>
                      </button>
                    ))}
                    {!taskResults.length &&
                      !noteResults.length &&
                      !clientResults.length && (
                        <p>Nenhum resultado para “{query}”.</p>
                      )}
                  </div>
                </>
              )}
            </div>
            <span className="header-divider" />
            <div className="notification-wrap">
              <button
                className={`icon-button ${notifications ? "selected" : ""}`}
                aria-label="Ver atividades recentes"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
                <span className="notification-dot" />
              </button>
              {notifications && (
                <>
                  <button
                    className="search-backdrop"
                    aria-label="Fechar atividades"
                    onClick={() => setNotifications(false)}
                  />
                  <div className="notification-panel">
                    <h3>O que aconteceu por aqui</h3>
                    {state.activities.slice(0, 6).map((a) => (
                      <div key={a.id}>
                        <span className="activity-icon">
                          <Check size={13} />
                        </span>
                        <p>
                          {a.message}
                          <small>
                            {new Date(a.createdAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </p>
                      </div>
                    ))}
                    {!state.activities.length && (
                      <p className="muted">
                        As próximas atividades aparecerão aqui.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              className="profile-avatar"
              onClick={() => setSettings(true)}
              aria-label="Abrir meu espaço"
            >
              VC
            </button>
          </div>
        </header>
        <main className={`main-content page-${page}`}>
          {page === "overview" && (
            <>
              <div className="page-heading overview-heading">
                <div>
                  <div className="greeting">
                    <span />
                    UM NOVO DIA, NOVAS IDEIAS
                  </div>
                  <h1>
                    Seu conteúdo, no ritmo certo
                    <span className="heading-dot">.</span>
                  </h1>
                  <p>Um pouco de organização. Muito espaço para criar.</p>
                </div>
                <div className="heading-actions">
                  <button
                    className="button secondary date-button"
                    onClick={() => navigate("calendar")}
                  >
                    <CalendarDays size={16} />
                    {formatDate(today(), { day: "numeric", month: "long" })}
                  </button>
                  <button className="button primary" onClick={() => newTask()}>
                    <Plus size={17} />
                    Nova demanda
                  </button>
                </div>
              </div>
              <Dashboard
                {...actions}
                checklist={state.checklist}
                onToggleCheck={toggleCheck}
                onAddCheck={addCheck}
                onEditNote={(n) => setEditor({ kind: "note", note: n })}
                clientId={clientId}
                onClientChange={setClientId}
              />
            </>
          )}
          {page === "tasks" && (
            <TasksPage
              {...actions}
              clientId={clientId}
              onClientChange={setClientId}
              onDelete={(task) =>
                setDeletion({
                  collection: "tasks",
                  id: task.id,
                  title: task.title,
                })
              }
            />
          )}
          {page === "calendar" && (
            <CalendarPage
              {...actions}
              clientId={clientId}
              onClientChange={setClientId}
            />
          )}
          {page === "checklist" && (
            <ChecklistPage
              items={state.checklist}
              onToggle={toggleCheck}
              onAdd={addCheck}
              onDelete={(item) =>
                setDeletion({
                  collection: "checklist",
                  id: item.id,
                  title: item.title,
                })
              }
            />
          )}
          {page === "clients" && (
            <ClientsPage
              state={state}
              onNew={() => setEditor({ kind: "client", client: null })}
              onEdit={(client) => setEditor({ kind: "client", client })}
              onDelete={(client) =>
                setDeletion({
                  collection: "clients",
                  id: client.id,
                  title: client.name,
                })
              }
              onView={(id) => {
                setClientId(id);
                navigate("tasks");
              }}
            />
          )}
          {page === "notes" && (
            <NotesPage
              state={state}
              onNew={() => setEditor({ kind: "note", note: null })}
              onEdit={(note) => setEditor({ kind: "note", note })}
              onDelete={(note) =>
                setDeletion({
                  collection: "notes",
                  id: note.id,
                  title: note.title,
                })
              }
            />
          )}
          {page === "reports" && (
            <ReportsPage state={state} onRefresh={refresh} notify={notify} />
          )}
          {page === "integrations" && (
            <IntegrationsPage
              state={state}
              onRefresh={refresh}
              notify={notify}
            />
          )}
          <footer className="page-footer">
            <span>
              <Flower2 size={13} /> Feito para dar espaço às suas ideias.
            </span>
            <span>
              {state.meta.demo
                ? "Workspace iniciado com dados fictícios"
                : "Compasso Social"}{" "}
              <span className="footer-dot">·</span> v1.0
            </span>
          </footer>
        </main>
      </div>
      {editor?.kind === "task" && (
        <TaskEditor
          task={editor.task}
          initialDate={editor.date}
          initialStatus={editor.status}
          clients={state.clients}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}
      {editor?.kind === "client" && (
        <ClientEditor
          client={editor.client}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}
      {editor?.kind === "note" && (
        <NoteEditor
          note={editor.note}
          clients={state.clients}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      )}
      {deletion && (
        <Modal
          title="Excluir este item?"
          subtitle="Esta ação remove o item deste espaço de trabalho."
          onClose={() => !deleting && setDeletion(null)}
        >
          <div className="delete-confirm">
            <div className="delete-item">
              <Trash2 size={22} />
              <strong>{deletion.title}</strong>
            </div>
            {deletion.collection === "clients" && (
              <p>
                Clientes com demandas ou anotações vinculadas precisam ter esses
                vínculos removidos primeiro.
              </p>
            )}
            <div className="modal-buttons">
              <button
                className="button secondary"
                disabled={deleting}
                onClick={() => setDeletion(null)}
              >
                Cancelar
              </button>
              <button
                className="button danger"
                disabled={deleting}
                onClick={deleteConfirmed}
              >
                {deleting ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Excluir item
              </button>
            </div>
          </div>
        </Modal>
      )}
      {settings && (
        <Modal
          title="Seu espaço criativo"
          subtitle="Um lugar para deixar sua rotina de social media mais leve."
          onClose={() => setSettings(false)}
        >
          <div className="workspace-settings">
            <div className="settings-brand">
              <img src="/favicon.svg" width="54" height="54" alt="" />
              <div>
                <h3>Estúdio criativo</h3>
                <p>Compasso Social · Workspace local</p>
              </div>
            </div>
            <div className="settings-info">
              <h4>
                <CheckCircle2 size={17} /> Seus dados ficam salvos
              </h4>
              <p>
                Demandas, checklists, clientes e anotações são armazenados no
                banco deste ambiente. As alterações permanecem ao atualizar a
                página.
              </p>
            </div>
            <div className="settings-info">
              <h4>
                <Sparkles size={17} /> Um ponto de partida
              </h4>
              <p>
                Este espaço começou com exemplos fictícios. Você pode editá-los,
                excluí-los e adicionar seus próprios clientes e conteúdos.
              </p>
            </div>
            <div className="settings-info">
              <h4>
                <CalendarDays size={17} /> Planejamento editorial
              </h4>
              <p>
                As datas organizam sua agenda. O app não publica nas redes
                sociais nem sincroniza automaticamente com ferramentas externas.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setSettings(false);
                navigate("integrations");
              }}
            >
              <ArrowDownToLine size={16} />
              Importação e backup
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button aria-label="Fechar aviso" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

type SharedProps = {
  state: State;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onNew: (date?: string, status?: Status) => void;
  onNavigate: (page: Page) => void;
  onPatch: (task: Task, status: Status) => void;
};
function ClientFilter({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="select-filter">
      <Users size={15} />
      <select
        aria-label="Filtrar por cliente"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">Todos os clientes</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown size={13} />
    </label>
  );
}

function Dashboard({
  state,
  tasks,
  onEdit,
  onNew,
  onNavigate,
  checklist,
  onToggleCheck,
  onAddCheck,
  onEditNote,
  clientId,
  onClientChange,
}: SharedProps & {
  checklist: CheckItem[];
  onToggleCheck: (item: CheckItem) => Promise<void>;
  onAddCheck: (title: string, date: string) => Promise<void>;
  onEditNote: (note: State["notes"][number]) => void;
  clientId: string;
  onClientChange: (id: string) => void;
}) {
  const [selectedDay, setSelectedDay] = useState(today());
  const [week, setWeek] = useState(() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    return offsetDate(today(), -day);
  });
  const currentMonth = today().slice(0, 7);
  const monthPublished = tasks.filter(
    (t) => t.status === "published" && t.date.startsWith(currentMonth),
  );
  const review = tasks.filter((t) => t.status === "review");
  const scheduled = tasks.filter((t) => t.status === "scheduled");
  const active = tasks.filter((t) => t.status !== "published");
  const todaysChecks = checklist.filter((c) => c.date === today());
  const complete = todaysChecks.filter((c) => c.done).length;
  const totalDone = tasks.filter((t) => t.status === "published").length;
  const progress = tasks.length
    ? Math.round((totalDone / tasks.length) * 100)
    : 0;
  const priorities = [...active]
    .sort(
      (a, b) =>
        Number(b.status === "review") - Number(a.status === "review") ||
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time),
    )
    .slice(0, 4);
  const events = tasks
    .filter((t) => t.date === selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));
  const days = Array.from({ length: 7 }, (_, i) => offsetDate(week, i));
  const stats = [
    {
      name: "Postagens no mês",
      count: monthPublished.length,
      icon: FileText,
      cls: "green",
      foot: "Conteúdos que ganharam o mundo",
      footIcon: TrendingUp,
    },
    {
      name: "Em aprovação",
      count: review.length,
      icon: MessageCircle,
      cls: "purple",
      foot: "Só falta aquele sinal verde",
      footIcon: Clock3,
    },
    {
      name: "Agendadas",
      count: scheduled.length,
      icon: CalendarDays,
      cls: "peach",
      foot: "Planejadas no calendário",
      footIcon: CalendarDays,
    },
    {
      name: "Ritmo de produção",
      count: `${progress}%`,
      icon: CheckCheck,
      cls: "blue",
      foot: `${totalDone} de ${tasks.length} demandas concluídas`,
      footIcon: CheckCircle2,
    },
  ];
  return (
    <>
      <div className="overview-filters">
        <span>
          <span className="live-dot" />
          Seu workspace em um olhar
        </span>
        <ClientFilter
          clients={state.clients}
          value={clientId}
          onChange={onClientChange}
        />
      </div>
      <div className="stat-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.name}>
            <div className="stat-top">
              <span>{s.name}</span>
              <span className={`stat-icon ${s.cls}`}>
                <s.icon size={18} />
              </span>
            </div>
            <div className="stat-number">
              {s.count}
              <span className={`stat-spark ${s.cls}`} aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      height: `${16 + tasks.filter((t) => t.status === (s.cls === "purple" ? "review" : s.cls === "peach" ? "scheduled" : "published") && new Date(t.date + "T12:00:00").getDay() === i % 7).length * 11}px`,
                    }}
                  />
                ))}
              </span>
            </div>
            <div className="stat-foot">
              <s.footIcon size={12} />
              {s.foot}
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="panel week-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Sua semana, em um olhar{" "}
                  <span className="heading-emoji">✺</span>
                </h2>
                <p>As próximas ideias a ganhar vida.</p>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("calendar")}
              >
                Abrir calendário
                <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="week-heading">
              <span>
                {formatDate(week, { day: "numeric", month: "long" })} —{" "}
                {formatDate(offsetDate(week, 6), {
                  day: "numeric",
                  month: "long",
                })}
              </span>
              <div>
                <button
                  className="icon-button tiny"
                  aria-label="Semana anterior"
                  onClick={() => {
                    setWeek(offsetDate(week, -7));
                    setSelectedDay(offsetDate(week, -7));
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="icon-button tiny"
                  aria-label="Próxima semana"
                  onClick={() => {
                    setWeek(offsetDate(week, 7));
                    setSelectedDay(offsetDate(week, 7));
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="week-strip">
              {days.map((day) => (
                <button
                  key={day}
                  className={`week-day ${day === selectedDay ? "active" : ""} ${day === today() ? "today" : ""}`}
                  onClick={() => setSelectedDay(day)}
                  aria-label={formatDate(day, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  aria-pressed={day === selectedDay}
                >
                  <span>
                    {formatDate(day, { weekday: "short" }).replace(".", "")}
                  </span>
                  <strong>{new Date(day + "T12:00:00").getDate()}</strong>
                  <span className="day-dots">
                    {tasks
                      .filter((t) => t.date === day)
                      .slice(0, 3)
                      .map((t) => (
                        <i
                          key={t.id}
                          style={{
                            background:
                              state.clients.find((c) => c.id === t.clientId)
                                ?.color || "#a2ad92",
                          }}
                        />
                      ))}
                    {!tasks.some((t) => t.date === day) && (
                      <i className="empty-dot" />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="day-schedule">
              <div className="schedule-label">
                <span>
                  {selectedDay === today()
                    ? "NA AGENDA DE HOJE"
                    : formatDate(selectedDay, {
                        day: "numeric",
                        month: "long",
                      }).toLocaleUpperCase("pt-BR")}
                </span>
                <span>
                  {events.length}{" "}
                  {events.length === 1 ? "conteúdo" : "conteúdos"}
                </span>
              </div>
              {events.length ? (
                events.slice(0, 3).map((task) => (
                  <button
                    className="schedule-item"
                    key={task.id}
                    onClick={() => onEdit(task)}
                  >
                    <span className="schedule-time">{task.time}</span>
                    <span
                      className="schedule-line"
                      style={{
                        background: state.clients.find(
                          (c) => c.id === task.clientId,
                        )?.color,
                      }}
                    />
                    <span className="schedule-info">
                      <strong>{task.title}</strong>
                      <span>
                        <ClientBadge
                          client={state.clients.find(
                            (c) => c.id === task.clientId,
                          )}
                          compact
                        />
                        <span>·</span>
                        {task.format}
                      </span>
                    </span>
                    <StatusBadge status={task.status} />
                    <ChevronRight size={16} />
                  </button>
                ))
              ) : (
                <div className="day-empty">
                  <span>Um respiro na sua agenda.</span>
                  <button
                    className="text-button"
                    onClick={() => onNew(selectedDay)}
                  >
                    Planejar conteúdo
                    <Plus size={14} />
                  </button>
                </div>
              )}
              {events.length > 3 && (
                <button
                  className="text-button extra-events"
                  onClick={() => onNavigate("calendar")}
                >
                  Ver mais {events.length - 3} conteúdos
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </section>
          <section className="panel focus-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  Demandas em foco
                  <span className="count-bubble">{active.length}</span>
                </h2>
                <p>Um próximo passo para cada boa ideia.</p>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("tasks")}
              >
                Ver todas
                <ArrowRight size={14} />
              </button>
            </div>
            {priorities.length ? (
              <div className="focus-list">
                {priorities.map((t) => (
                  <button
                    key={t.id}
                    className="focus-item"
                    onClick={() => onEdit(t)}
                  >
                    <span className={`format-icon cover-${t.cover}`}>
                      <Channel name={t.channel} size={18} />
                    </span>
                    <span className="focus-description">
                      <strong>{t.title}</strong>
                      <span>
                        <ClientBadge
                          client={state.clients.find(
                            (c) => c.id === t.clientId,
                          )}
                          compact
                        />{" "}
                        <span className="task-format">· {t.format}</span>
                      </span>
                    </span>
                    <StatusBadge status={t.status} />
                    <span
                      className={`focus-date ${t.date < today() ? "overdue" : ""}`}
                    >
                      <Clock3 size={12} />
                      {formatDate(t.date)}
                    </span>
                    <span className="assignee-avatar" title={t.assignee}>
                      {t.assignee
                        .split(" ")
                        .map((s) => s[0])
                        .slice(0, 2)
                        .join("") || "VC"}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="Tudo em dia por aqui"
                description="Sua próxima ideia pode começar agora."
                action={
                  <button
                    className="button secondary small"
                    onClick={() => onNew()}
                  >
                    Nova demanda
                  </button>
                }
              />
            )}
          </section>
          <section className="ideas-section">
            <div className="section-heading">
              <h2>
                Não deixe a inspiração escapar <Sparkles size={16} />
              </h2>
              <button
                className="text-button"
                onClick={() => onNavigate("notes")}
              >
                Suas anotações
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="note-preview-grid">
              {state.notes.slice(0, 2).map((note) => (
                <button
                  key={note.id}
                  className={`note-preview note-${note.color}`}
                  onClick={() => onEditNote(note)}
                >
                  <span className="note-preview-top">
                    <span>
                      <BookOpen size={14} />
                      IDEIAS & INSIGHTS
                    </span>
                    <ArrowUpRight size={16} />
                  </span>
                  <h3>{note.title}</h3>
                  <p>{note.content}</p>
                </button>
              ))}
              {!state.notes.length && (
                <button
                  className="note-preview note-yellow"
                  onClick={() => onNavigate("notes")}
                >
                  <Sparkles size={20} />
                  <h3>Um lugar para suas ideias</h3>
                  <p>
                    Guarde referências, rascunhos e aquela ideia que acabou de
                    aparecer.
                  </p>
                </button>
              )}
            </div>
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="panel daily-checklist">
            <div className="panel-heading">
              <div>
                <h2>
                  Seu checklist de hoje <span className="small-sun">☀</span>
                </h2>
                <p>Pequenos passos, grandes resultados.</p>
              </div>
            </div>
            <div className="checklist-progress">
              <span>
                <strong>{complete}</strong> de {todaysChecks.length} concluídos
              </span>
              <span>
                {todaysChecks.length
                  ? Math.round((complete / todaysChecks.length) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: `${todaysChecks.length ? (complete / todaysChecks.length) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="dashboard-checks">
              {todaysChecks.slice(0, 6).map((item) => (
                <CheckRow key={item.id} item={item} onToggle={onToggleCheck} />
              ))}
              {!todaysChecks.length && (
                <p className="muted">O dia começa com uma lista em branco.</p>
              )}
            </div>
            <QuickCheck onAdd={(title) => onAddCheck(title, today())} />
            <button
              className="checklist-link"
              onClick={() => onNavigate("checklist")}
            >
              Ver meu checklist completo
              <ArrowRight size={14} />
            </button>
          </section>
          <div className="creative-card">
            <div className="creative-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit orbit-three" />
              <Flower2 size={51} strokeWidth={1.1} />
              <span>✦</span>
            </div>
            <span className="creative-eyebrow">
              NO SEU TEMPO. NO SEU RITMO.
            </span>
            <h3>
              Menos abas abertas.
              <br />
              Mais ideias no ar.
            </h3>
            <p>
              Da primeira ideia ao último post,
              <br />
              seu processo cabe aqui.
            </p>
            <button onClick={() => onNavigate("tasks")}>
              Vamos organizar?
              <ArrowUpRight size={16} />
            </button>
          </div>
          <section className="activity-section">
            <h2>
              Últimos movimentos
              <span className="live-dot" />
            </h2>
            {state.activities.slice(0, 3).map((a, i) => (
              <div className="activity-item" key={a.id}>
                <span className={`activity-mark activity-${i}`}>
                  <Check size={12} />
                </span>
                <p>
                  {a.message}
                  <small>
                    {new Date(a.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </p>
              </div>
            ))}
            {!state.activities.length && (
              <p className="muted">Seu próximo movimento começa aqui.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function CheckRow({
  item,
  onToggle,
  onDelete,
}: {
  item: CheckItem;
  onToggle: (item: CheckItem) => Promise<void>;
  onDelete?: (item: CheckItem) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={`check-row ${item.done ? "done" : ""}`}>
      <button
        role="checkbox"
        aria-checked={item.done}
        aria-label={item.title}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onToggle(item);
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="checkbox-square">
          {busy ? (
            <Loader2 size={12} className="spin" />
          ) : item.done ? (
            <Check size={12} strokeWidth={2.5} />
          ) : null}
        </span>
        <span>{item.title}</span>
      </button>
      {onDelete && (
        <button
          className="icon-button tiny check-delete"
          aria-label={`Excluir ${item.title}`}
          onClick={() => onDelete(item)}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
function QuickCheck({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await onAdd(title.trim());
      setTitle("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <form className="quick-check" onSubmit={add}>
        <Plus size={15} />
        <input
          aria-label="Adicionar item ao checklist"
          placeholder="Adicionar uma tarefa…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <button aria-label="Adicionar tarefa" disabled={!title.trim() || busy}>
          {busy ? (
            <Loader2 className="spin" size={15} />
          ) : (
            <ArrowUpRight size={15} />
          )}
        </button>
      </form>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function TasksPage({
  state,
  tasks,
  onEdit,
  onNew,
  onPatch,
  clientId,
  onClientChange,
  onDelete,
}: SharedProps & {
  clientId: string;
  onClientChange: (id: string) => void;
  onDelete: (task: Task) => void;
}) {
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const visible = tasks.filter(
    (t) =>
      `${t.title} ${t.description} ${t.tags.join(" ")} ${state.clients.find((c) => c.id === t.clientId)?.name || ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")) &&
      (status === "all" || t.status === status) &&
      (priority === "all" || t.priority === priority),
  );
  const [dragging, setDragging] = useState<string | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <span />
            DA IDEIA À PUBLICAÇÃO
          </div>
          <h1>
            Cada demanda, em seu lugar<span className="heading-dot">.</span>
          </h1>
          <p>Crie, acompanhe e faça seu conteúdo acontecer.</p>
        </div>
        <button className="button primary" onClick={() => onNew()}>
          <Plus size={17} />
          Nova demanda
        </button>
      </div>
      <div className="page-toolbar">
        <div className="toolbar-left">
          <ClientFilter
            clients={state.clients}
            value={clientId}
            onChange={onClientChange}
          />
          <label className="select-filter">
            <SlidersHorizontal size={15} />
            <select
              aria-label="Filtrar por status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Todos os status</option>
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </label>
          <label className="select-filter priority-filter">
            <Flag size={14} />
            <select
              aria-label="Filtrar por prioridade"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="all">Prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </label>
        </div>
        <div className="toolbar-right">
          <label className="local-search">
            <Search size={15} />
            <input
              aria-label="Buscar demanda"
              placeholder="Buscar demanda…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="view-toggle">
            <button
              aria-label="Visualização em quadro"
              aria-pressed={view === "board"}
              className={view === "board" ? "active" : ""}
              onClick={() => setView("board")}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              aria-label="Visualização em lista"
              aria-pressed={view === "list"}
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="board-caption">
        <span>{visible.length} demandas no seu fluxo</span>
        <span>
          {view === "board"
            ? "Arraste os cartões ou use o seletor de status."
            : "Clique em uma demanda para editar seus detalhes."}
        </span>
      </div>
      {view === "board" ? (
        <div className="kanban-board">
          {(Object.keys(statuses) as Status[])
            .filter((k) => status === "all" || status === k)
            .map((key) => (
              <section
                key={key}
                className={`kanban-column ${dragging ? "can-drop" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  const t = tasks.find((t) => t.id === id);
                  if (t && t.status !== key) onPatch(t, key);
                  setDragging(null);
                }}
              >
                <div className="kanban-heading">
                  <h2>
                    <span style={{ background: statuses[key].color }} />
                    {statuses[key].label}
                    <em>{visible.filter((t) => t.status === key).length}</em>
                  </h2>
                  <button
                    className="icon-button tiny"
                    aria-label={`Nova demanda em ${statuses[key].label}`}
                    onClick={() => onNew(undefined, key)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="kanban-cards">
                  {visible
                    .filter((t) => t.status === key)
                    .map((t) => (
                      <article
                        key={t.id}
                        className={`task-card ${dragging === t.id ? "dragging" : ""}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", t.id);
                          setDragging(t.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                      >
                        <div className="task-card-top">
                          <ClientBadge
                            client={state.clients.find(
                              (c) => c.id === t.clientId,
                            )}
                            compact
                          />
                          <button
                            className="icon-button tiny"
                            aria-label={`Editar ${t.title}`}
                            onClick={() => onEdit(t)}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>
                        <button
                          className="task-title-button"
                          onClick={() => onEdit(t)}
                        >
                          {t.title}
                        </button>
                        <div className="task-tags">
                          <span className={`format-tag cover-${t.cover}`}>
                            <Channel name={t.channel} size={11} />
                            {t.format}
                          </span>
                          {t.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="task-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="task-card-footer">
                          <span
                            className={
                              t.date < today() && t.status !== "published"
                                ? "overdue"
                                : ""
                            }
                          >
                            <CalendarDays size={12} />
                            {formatDate(t.date)}
                          </span>
                          <span
                            className={`priority-dot priority-${t.priority}`}
                            title={`Prioridade ${t.priority === "high" ? "alta" : t.priority === "medium" ? "média" : "baixa"}`}
                          />
                          <span className="assignee-avatar" title={t.assignee}>
                            {t.assignee.slice(0, 2).toLocaleUpperCase("pt-BR")}
                          </span>
                        </div>
                        <label className="card-status-label">
                          <span className="sr-only">Status de {t.title}</span>
                          <select
                            value={t.status}
                            onChange={(e) =>
                              onPatch(t, e.target.value as Status)
                            }
                          >
                            {Object.entries(statuses).map(([key, v]) => (
                              <option key={key} value={key}>
                                {v.short}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={11} />
                        </label>
                      </article>
                    ))}
                  {!visible.some((t) => t.status === key) && (
                    <div className="empty-column">
                      <Circle size={22} strokeWidth={1} />
                      <span>Espaço para novas ideias</span>
                    </div>
                  )}
                  <button
                    className="add-card"
                    onClick={() => onNew(undefined, key)}
                  >
                    <Plus size={14} />
                    Nova demanda
                  </button>
                </div>
              </section>
            ))}
        </div>
      ) : (
        <div className="panel task-table-wrap">
          <table className="task-table">
            <thead>
              <tr>
                <th>Demanda</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Data</th>
                <th>Responsável</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button className="table-title" onClick={() => onEdit(t)}>
                      {t.title}
                      <small>
                        <Channel name={t.channel} />
                        {t.channel} · {t.format}
                      </small>
                    </button>
                  </td>
                  <td>
                    <ClientBadge
                      client={state.clients.find((c) => c.id === t.clientId)}
                      compact
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Status de ${t.title}`}
                      className={`table-status status-${t.status}`}
                      value={t.status}
                      onChange={(e) => onPatch(t, e.target.value as Status)}
                    >
                      {Object.entries(statuses).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.short}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="nowrap">{formatDate(t.date)}</td>
                  <td>{t.assignee || "—"}</td>
                  <td>
                    <button
                      className="icon-button tiny"
                      aria-label={`Excluir ${t.title}`}
                      onClick={() => onDelete(t)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <Empty
              title="Nenhuma demanda por aqui"
              description="Tente mudar os filtros ou crie uma nova ideia."
            />
          )}
        </div>
      )}
    </>
  );
}

function CalendarPage({
  state,
  tasks,
  onEdit,
  onNew,
  clientId,
  onClientChange,
}: SharedProps & { clientId: string; onClientChange: (id: string) => void }) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [channel, setChannel] = useState("all");
  const firstOffset = (month.getDay() + 6) % 7;
  const start = new Date(
    month.getFullYear(),
    month.getMonth(),
    1 - firstOffset,
  );
  const days = Array.from(
    { length: 42 },
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
  const visible = tasks.filter(
    (t) => channel === "all" || t.channel === channel,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <span />
            UM PLANO PARA SUAS IDEIAS
          </div>
          <h1>
            Seu calendário editorial<span className="heading-dot">.</span>
          </h1>
          <p>
            Uma visão de tudo o que está por vir. As datas são de planejamento.
          </p>
        </div>
        <button className="button primary" onClick={() => onNew()}>
          <Plus size={17} />
          Planejar conteúdo
        </button>
      </div>
      <div className="page-toolbar">
        <div className="calendar-controls">
          <h2>
            {month.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button
            className="icon-button tiny"
            aria-label="Mês anterior"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button tiny"
            aria-label="Próximo mês"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="button secondary small"
            onClick={() =>
              setMonth(
                new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              )
            }
          >
            Hoje
          </button>
        </div>
        <div className="toolbar-right">
          <ClientFilter
            clients={state.clients}
            value={clientId}
            onChange={onClientChange}
          />
          <label className="select-filter">
            <Instagram size={15} />
            <select
              aria-label="Filtrar por rede social"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="all">Todas as redes</option>
              {["Instagram", "LinkedIn", "TikTok", "Facebook"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={12} />
          </label>
        </div>
      </div>
      <div className="calendar-scroll">
        <div className="calendar-grid">
          <div className="calendar-weekdays">
            {[
              "Segunda",
              "Terça",
              "Quarta",
              "Quinta",
              "Sexta",
              "Sábado",
              "Domingo",
            ].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((day) => {
              const key = dateKey(day);
              const list = visible
                .filter((t) => t.date === key)
                .sort((a, b) => a.time.localeCompare(b.time));
              return (
                <div
                  key={key}
                  className={`calendar-cell ${day.getMonth() !== month.getMonth() ? "outside" : ""} ${key === today() ? "current" : ""}`}
                >
                  <div className="calendar-cell-top">
                    <span className="calendar-day-number">{day.getDate()}</span>
                    <button
                      className="icon-button tiny"
                      aria-label={`Adicionar conteúdo em ${formatDate(key)}`}
                      onClick={() => onNew(key)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="calendar-events">
                    {list.map((task) => (
                      <button
                        key={task.id}
                        className={`calendar-event cover-${task.cover}`}
                        onClick={() => onEdit(task)}
                      >
                        <span className="calendar-event-meta">
                          <Channel name={task.channel} size={11} />
                          <span>{task.time}</span>
                          <span
                            className="event-status-dot"
                            style={{ background: statuses[task.status].color }}
                          />
                        </span>
                        <strong>{task.title}</strong>
                        <span>
                          {
                            state.clients.find((c) => c.id === task.clientId)
                              ?.name
                          }
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="calendar-legend">
        {state.clients.map((c) => (
          <ClientBadge client={c} key={c.id} compact />
        ))}
        <span className="muted">
          <Circle size={11} />
          Agenda local · não publica automaticamente
        </span>
      </div>
    </>
  );
}

function ChecklistPage({
  items,
  onToggle,
  onAdd,
  onDelete,
}: {
  items: CheckItem[];
  onToggle: (item: CheckItem) => Promise<void>;
  onAdd: (title: string, date: string) => Promise<void>;
  onDelete: (item: CheckItem) => void;
}) {
  const [date, setDate] = useState(today());
  const [filter, setFilter] = useState("all");
  const todayItems = items.filter((c) => c.date === date);
  const done = todayItems.filter((c) => c.done).length;
  const percent = todayItems.length
    ? Math.round((done / todayItems.length) * 100)
    : 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <span />
            UM PASSO DE CADA VEZ
          </div>
          <h1>
            Uma rotina mais leve<span className="heading-dot">.</span>
          </h1>
          <p>Organize o essencial, celebre cada tarefa concluída.</p>
        </div>
        <div className="checklist-date">
          <button
            className="icon-button"
            aria-label="Dia anterior"
            onClick={() => setDate(offsetDate(date, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <label>
            <CalendarDays size={16} />
            <input
              aria-label="Data do checklist"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <button
            className="icon-button"
            aria-label="Próximo dia"
            onClick={() => setDate(offsetDate(date, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="checklist-page-grid">
        <section className="panel checklist-main-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {date === today()
                  ? "Seu checklist de hoje"
                  : formatDate(date, { day: "numeric", month: "long" })}
              </h2>
              <p>
                {formatDate(date, { weekday: "long" })} · {todayItems.length}{" "}
                tarefas
              </p>
            </div>
            <button className="text-button" onClick={() => setDate(today())}>
              Voltar para hoje
            </button>
          </div>
          <div className="check-tabs">
            {[
              ["all", "Todas"],
              ["pending", "Pendentes"],
              ["done", "Concluídas"],
            ].map(([k, v]) => (
              <button
                key={k}
                className={filter === k ? "active" : ""}
                onClick={() => setFilter(k)}
              >
                {v}
                <span>
                  {k === "all"
                    ? todayItems.length
                    : k === "done"
                      ? done
                      : todayItems.length - done}
                </span>
              </button>
            ))}
          </div>
          <div className="full-check-list">
            {todayItems
              .filter(
                (c) =>
                  filter === "all" || (filter === "done" ? c.done : !c.done),
              )
              .map((item) => (
                <CheckRow
                  key={item.id}
                  item={item}
                  onToggle={onToggle}
                  onDelete={onDelete}
                />
              ))}
            {!todayItems.filter(
              (c) => filter === "all" || (filter === "done" ? c.done : !c.done),
            ).length && (
              <Empty
                title={
                  filter === "done"
                    ? "Um passo de cada vez"
                    : filter === "pending" && done
                      ? "Tudo feito. Respire!"
                      : "Como você quer começar?"
                }
                description={
                  filter === "done"
                    ? "Suas tarefas concluídas vão aparecer aqui."
                    : "Adicione suas tarefas e deixe o dia fluir."
                }
              />
            )}
          </div>
          <QuickCheck onAdd={(title) => onAdd(title, date)} />
        </section>
        <aside className="checklist-summary">
          <div className="panel progress-panel">
            <span className="eyebrow">SEU PROGRESSO DO DIA</span>
            <div className="progress-ring">
              <svg
                viewBox="0 0 140 140"
                role="img"
                aria-label={`${percent}% das tarefas concluídas`}
              >
                <circle
                  cx="70"
                  cy="70"
                  r="58"
                  fill="none"
                  stroke="#eef0e7"
                  strokeWidth="9"
                />
                <circle
                  cx="70"
                  cy="70"
                  r="58"
                  fill="none"
                  stroke="#839b65"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${(percent / 100) * 364.4} 364.4`}
                  transform="rotate(-90 70 70)"
                />
              </svg>
              <div>
                <strong>
                  {percent}
                  <span>%</span>
                </strong>
                <small>concluído</small>
              </div>
            </div>
            <h3>
              {percent === 100 ? "Você fez acontecer! ✨" : "Cada passo conta."}
            </h3>
            <p>
              {done} de {todayItems.length} tarefas concluídas.
              <br />
              {percent === 100
                ? "Seu dia merece essa pequena celebração."
                : "O importante é encontrar o seu ritmo."}
            </p>
          </div>
          <div className="tip-card">
            <Flower2 size={25} strokeWidth={1.3} />
            <h3>Um lembrete gentil</h3>
            <p>
              Você não precisa fazer tudo hoje. Priorize o que importa e deixe
              espaço para criar.
            </p>
            <span>— seu compasso criativo</span>
          </div>
        </aside>
      </div>
    </>
  );
}

function ClientsPage({
  state,
  onNew,
  onEdit,
  onDelete,
  onView,
}: {
  state: State;
  onNew: () => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onView: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const clients = state.clients.filter((c) =>
    `${c.name} ${c.segment}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <span />
            MARCAS COM HISTÓRIAS PARA CONTAR
          </div>
          <h1>
            Conexões que criam<span className="heading-dot">.</span>
          </h1>
          <p>Cada cliente com seu universo, todos no mesmo compasso.</p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={17} />
          Novo cliente
        </button>
      </div>
      <div className="page-toolbar">
        <span className="muted">
          {state.clients.length} marcas no seu espaço
        </span>
        <label className="local-search">
          <Search size={15} />
          <input
            aria-label="Buscar cliente"
            placeholder="Buscar cliente ou segmento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="clients-grid">
        {clients.map((client) => {
          const tasks = state.tasks.filter((t) => t.clientId === client.id);
          return (
            <article
              key={client.id}
              className="panel client-card"
              style={{ "--client-color": client.color } as React.CSSProperties}
            >
              <div className="client-card-top">
                <span
                  className="client-avatar"
                  style={{ background: client.color }}
                >
                  {client.initials}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Editar ${client.name}`}
                  onClick={() => onEdit(client)}
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
              <h2>{client.name}</h2>
              <span className="segment-chip">
                {client.segment || "Marca criativa"}
              </span>
              <div className="client-contact">
                {client.contact && (
                  <span>
                    <Users size={13} />
                    {client.contact}
                  </span>
                )}
                {client.email && (
                  <a href={`mailto:${client.email}`}>{client.email}</a>
                )}
                {!client.contact && !client.email && (
                  <span className="muted">Um universo de possibilidades.</span>
                )}
              </div>
              <div className="client-numbers">
                <div>
                  <strong>{tasks.length}</strong>
                  <span>Demandas</span>
                </div>
                <div>
                  <strong>
                    {tasks.filter((t) => t.status === "review").length}
                  </strong>
                  <span>Em aprovação</span>
                </div>
                <div>
                  <strong>
                    {tasks.filter((t) => t.status === "published").length}
                  </strong>
                  <span>Publicadas</span>
                </div>
              </div>
              <div className="client-card-bottom">
                <button
                  className="text-button"
                  onClick={() => onView(client.id)}
                >
                  Ver demandas
                  <ArrowRight size={15} />
                </button>
                <button
                  className="icon-button tiny"
                  aria-label={`Excluir cliente ${client.name}`}
                  onClick={() => onDelete(client)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          );
        })}
        <button className="new-client-card" onClick={onNew}>
          <span>
            <Plus size={25} />
          </span>
          <h3>Uma nova conexão</h3>
          <p>Adicione uma marca ao seu espaço.</p>
        </button>
      </div>
      {!clients.length && query && (
        <Empty
          title="Nenhuma marca encontrada"
          description="Experimente outro nome ou segmento."
        />
      )}
    </>
  );
}

function NotesPage({
  state,
  onNew,
  onEdit,
  onDelete,
}: {
  state: State;
  onNew: () => void;
  onEdit: (note: State["notes"][number]) => void;
  onDelete: (note: State["notes"][number]) => void;
}) {
  const [query, setQuery] = useState("");
  const [client, setClient] = useState("all");
  const [color, setColor] = useState("all");
  const notes = state.notes.filter(
    (n) =>
      `${n.title} ${n.content}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")) &&
      (client === "all" || n.clientId === client) &&
      (color === "all" || n.color === color),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="greeting">
            <span />O COMEÇO DE ALGUMA COISA BOA
          </div>
          <h1>
            Ideias merecem espaço<span className="heading-dot">.</span>
          </h1>
          <p>
            Rascunhos, referências e insights. Tudo o que pode virar conteúdo.
          </p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={17} />
          Nova anotação
        </button>
      </div>
      <div className="page-toolbar">
        <div className="toolbar-left">
          <ClientFilter
            clients={state.clients}
            value={client}
            onChange={setClient}
          />
          <div className="note-color-filters">
            <button
              className={color === "all" ? "active" : ""}
              aria-label="Todas as cores"
              onClick={() => setColor("all")}
            >
              <LayoutGrid size={14} />
            </button>
            {["yellow", "pink", "green", "blue"].map((c) => (
              <button
                key={c}
                className={`note-${c} ${color === c ? "active" : ""}`}
                onClick={() => setColor(c)}
                aria-label={`Filtrar notas ${c === "yellow" ? "amarelas" : c === "pink" ? "rosas" : c === "green" ? "verdes" : "azuis"}`}
              />
            ))}
          </div>
        </div>
        <label className="local-search">
          <Search size={15} />
          <input
            aria-label="Buscar anotação"
            placeholder="Buscar uma ideia…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="notes-grid">
        {notes.map((note) => (
          <article className={`note-card note-${note.color}`} key={note.id}>
            <div className="note-card-top">
              <BookOpen size={18} strokeWidth={1.5} />
              <div>
                <button
                  className="icon-button tiny"
                  aria-label={`Editar nota ${note.title}`}
                  onClick={() => onEdit(note)}
                >
                  <ArrowUpRight size={16} />
                </button>
                <button
                  className="icon-button tiny"
                  aria-label={`Excluir nota ${note.title}`}
                  onClick={() => onDelete(note)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <button
              className="note-content-button"
              onClick={() => onEdit(note)}
            >
              <h2>{note.title}</h2>
              <p>{note.content}</p>
            </button>
            <div className="note-card-bottom">
              {note.clientId ? (
                <ClientBadge
                  client={state.clients.find((c) => c.id === note.clientId)}
                  compact
                />
              ) : (
                <span>
                  <Sparkles size={12} />
                  Ideias livres
                </span>
              )}
              <span>
                {new Date(note.updatedAt).toLocaleDateString("pt-BR", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </article>
        ))}
        <button className="new-note-card" onClick={onNew}>
          <Plus size={28} strokeWidth={1.2} />
          <h3>E se…?</h3>
          <p>Sua próxima ideia começa aqui.</p>
        </button>
      </div>
      {!notes.length && (
        <Empty
          title="Um espaço esperando sua ideia"
          description="Adicione uma anotação ou ajuste os filtros."
        />
      )}
    </>
  );
}
