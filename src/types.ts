export type Status = "idea" | "progress" | "review" | "scheduled" | "published";
export type Page =
  | "overview"
  | "tasks"
  | "calendar"
  | "checklist"
  | "clients"
  | "notes"
  | "reports"
  | "integrations";
export type Metrics = {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saves: number;
};
export type Client = {
  id: string;
  name: string;
  color: string;
  initials: string;
  segment: string;
  contact?: string;
  email?: string;
};
export type Task = {
  id: string;
  title: string;
  clientId: string;
  status: Status;
  format: string;
  channel: string;
  date: string;
  time: string;
  priority: "high" | "medium" | "low";
  assignee: string;
  description: string;
  tags: string[];
  metrics: Metrics;
  cover: string;
  createdAt: string;
};
export type CheckItem = {
  id: string;
  title: string;
  done: boolean;
  date: string;
};
export type Note = {
  id: string;
  title: string;
  content: string;
  color: string;
  clientId: string;
  updatedAt: string;
};
export type Activity = { id: string; message: string; createdAt: string };
export type State = {
  clients: Client[];
  tasks: Task[];
  checklist: CheckItem[];
  notes: Note[];
  activities: Activity[];
  meta: { demo: boolean };
};
export const statuses: Record<
  Status,
  { label: string; short: string; color: string }
> = {
  idea: { label: "Ideias", short: "Ideia", color: "#a6a49c" },
  progress: { label: "Em produção", short: "Em produção", color: "#d7a16a" },
  review: { label: "Em aprovação", short: "Em aprovação", color: "#a39cc9" },
  scheduled: { label: "Agendadas", short: "Agendado", color: "#7d9eaa" },
  published: { label: "Publicadas", short: "Publicado", color: "#7e9e7a" },
};
export const pageNames: Record<Page, string> = {
  overview: "Visão geral",
  tasks: "Demandas",
  calendar: "Calendário",
  checklist: "Checklist diário",
  clients: "Clientes",
  notes: "Anotações",
  reports: "Relatórios",
  integrations: "Integrações",
};
