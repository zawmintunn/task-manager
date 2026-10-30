export type Status = 'todo' | 'in-progress' | 'done';
export type Priority = 'low' | 'medium' | 'high';

/** Activity is append-only and stored in chronological order (oldest first). */
export type TaskActivity =
  | { id: string; type: 'created'; at: string }
  | { id: string; type: 'edited'; at: string }
  | { id: string; type: 'status_changed'; at: string; from: Status; to: Status }
  | { id: string; type: 'assignment_changed'; at: string; from: string | null; to: string | null };

export type Task = {
  id: string; title: string; description: string; status: Status; priority: Priority;
  dueDate: string; createdAt: string; updatedAt: string;
  /** Optional display name for the local-first owner; null means unassigned. */
  assignee?: string | null;
  /** Missing in pre-history records; normalized to [] when loaded/imported. */
  activity?: TaskActivity[];
};
export type TaskInput = Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate'> & { assignee?: string | null };
export type TaskBackup = { format: 'task-manager-backup'; version: 1; exportedAt: string; tasks: Task[] };
export type Filters = { query: string; status: Status | 'all'; priority: Priority | 'all'; sort: 'newest' | 'dueDate' | 'priority' };
export const STORAGE_KEY = 'task-manager.tasks.v1';
const statuses: Status[] = ['todo', 'in-progress', 'done'];
const priorities: Priority[] = ['low', 'medium', 'high'];

function isActivity(value: unknown): value is TaskActivity {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (typeof event.id !== 'string' || typeof event.at !== 'string') return false;
  if (event.type === 'created' || event.type === 'edited') return true;
  if (event.type === 'status_changed') return statuses.includes(event.from as Status) && statuses.includes(event.to as Status);
  if (event.type === 'assignment_changed') return (typeof event.from === 'string' || event.from === null) && (typeof event.to === 'string' || event.to === null);
  return false;
}

/** Accepts legacy v1 records and supplies the new optional fields. */
export function normalizeTask(value: unknown): Task | null {
  if (!isTask(value)) return null;
  const task = value as Task;
  const assignee = typeof task.assignee === 'string' ? task.assignee.trim() || null : null;
  const activity = Array.isArray(task.activity) && task.activity.every(isActivity) ? task.activity : [];
  return { ...task, assignee, activity };
}

export function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.title === 'string' && typeof t.description === 'string' && statuses.includes(t.status as Status) && priorities.includes(t.priority as Priority) && typeof t.dueDate === 'string' && typeof t.createdAt === 'string' && typeof t.updatedAt === 'string' && (t.assignee === undefined || t.assignee === null || typeof t.assignee === 'string') && (t.activity === undefined || Array.isArray(t.activity) && t.activity.every(isActivity));
}
export function loadTasks(storage?: Pick<Storage, 'getItem'>): Task[] {
  try { const raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY); if (!raw) return []; const parsed: unknown = JSON.parse(raw); return Array.isArray(parsed) ? parsed.map(normalizeTask).filter((task): task is Task => task !== null) : []; } catch { return []; }
}
export function saveTasks(tasks: Task[], storage?: Pick<Storage, 'setItem'>): void { storage ??= globalThis.localStorage; storage.setItem(STORAGE_KEY, JSON.stringify(tasks.map(task => ({ ...task, assignee: task.assignee?.trim() || null, activity: task.activity ?? [] })))); }
export function createBackup(tasks: Task[], exportedAt = new Date()): TaskBackup {
  return { format: 'task-manager-backup', version: 1, exportedAt: exportedAt.toISOString(), tasks: tasks.map(task => ({ ...task, assignee: task.assignee?.trim() || null, activity: task.activity ?? [] })) };
}
export function parseBackup(contents: string): Task[] {
  let parsed: unknown;
  try { parsed = JSON.parse(contents); } catch { throw new Error('This file is not valid JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('This is not a Task Manager backup.');
  const backup = parsed as Record<string, unknown>;
  if (backup.format !== 'task-manager-backup') throw new Error('This is not a Task Manager backup.');
  if (backup.version !== 1) throw new Error('This backup version is not supported.');
  if (typeof backup.exportedAt !== 'string' || !Array.isArray(backup.tasks) || !backup.tasks.every(isTask)) throw new Error('The backup contains invalid task data. No tasks were imported.');
  const ids = new Set<string>();
  for (const task of backup.tasks) { if (ids.has(task.id)) throw new Error('The backup contains duplicate task IDs. No tasks were imported.'); ids.add(task.id); }
  return backup.tasks.map(task => normalizeTask(task)!);
}
export function mergeTasks(existing: Task[], imported: Task[]): Task[] { const byId = new Map(existing.map(task => [task.id, task])); for (const task of imported) byId.set(task.id, task); return [...byId.values()]; }

function eventId(): string { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function createTask(input: TaskInput, now = new Date(), id: string = crypto.randomUUID()): Task {
  const timestamp = now.toISOString();
  return { ...input, title: input.title.trim(), description: input.description.trim(), assignee: input.assignee?.trim() || null, id, createdAt: timestamp, updatedAt: timestamp, activity: [{ id: eventId(), type: 'created', at: timestamp }] };
}
export function updateTask(task: Task, input: TaskInput, now = new Date()): Task {
  const timestamp = now.toISOString(); const assignee = input.assignee?.trim() || null; const previousAssignee = task.assignee?.trim() || null;
  let activity = task.activity ?? [];
  if (input.status !== task.status) activity = [...activity, { id: eventId(), type: 'status_changed', at: timestamp, from: task.status, to: input.status }];
  if (assignee !== previousAssignee) activity = [...activity, { id: eventId(), type: 'assignment_changed', at: timestamp, from: previousAssignee, to: assignee }];
  const otherFieldsChanged = input.title.trim() !== task.title || input.description.trim() !== task.description || input.priority !== task.priority || input.dueDate !== task.dueDate;
  if (otherFieldsChanged) activity = [...activity, { id: eventId(), type: 'edited', at: timestamp }];
  return { ...task, ...input, title: input.title.trim(), description: input.description.trim(), assignee, activity, updatedAt: timestamp };
}
export function toggleComplete(task: Task, now = new Date()): Task { const status = task.status === 'done' ? 'todo' : 'done'; const timestamp = now.toISOString(); return { ...task, status, updatedAt: timestamp, activity: [...(task.activity ?? []), { id: eventId(), type: 'status_changed', at: timestamp, from: task.status, to: status }] }; }
export function getCounts(tasks: Task[], today = new Date().toISOString().slice(0, 10)) { const completed = tasks.filter(t => t.status === 'done').length; return { total: tasks.length, pending: tasks.length - completed, completed, overdue: tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < today).length }; }
export function filterTasks(tasks: Task[], filters: Filters): Task[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter(t => (!query || `${t.title} ${t.description}`.toLocaleLowerCase().includes(query)) && (filters.status === 'all' || t.status === filters.status) && (filters.priority === 'all' || t.priority === filters.priority)).sort((a,b) => {
    if (filters.sort === 'newest') return b.createdAt.localeCompare(a.createdAt);
    if (filters.sort === 'dueDate') return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31') || b.createdAt.localeCompare(a.createdAt);
    const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 }; return rank[a.priority] - rank[b.priority] || b.createdAt.localeCompare(a.createdAt);
  });
}
