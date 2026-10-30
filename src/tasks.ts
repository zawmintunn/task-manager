export type Status = 'todo' | 'in-progress' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type Task = { id: string; title: string; description: string; status: Status; priority: Priority; dueDate: string; createdAt: string; updatedAt: string };
export type TaskInput = Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate'>;
export type Filters = { query: string; status: Status | 'all'; priority: Priority | 'all'; sort: 'newest' | 'dueDate' | 'priority' };
export const STORAGE_KEY = 'task-manager.tasks.v1';
const statuses: Status[] = ['todo', 'in-progress', 'done'];
const priorities: Priority[] = ['low', 'medium', 'high'];
export function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.title === 'string' && typeof t.description === 'string' && statuses.includes(t.status as Status) && priorities.includes(t.priority as Priority) && typeof t.dueDate === 'string' && typeof t.createdAt === 'string' && typeof t.updatedAt === 'string';
}
export function loadTasks(storage: Pick<Storage, 'getItem'> = localStorage): Task[] {
  try { const raw = storage.getItem(STORAGE_KEY); if (!raw) return []; const parsed: unknown = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter(isTask) : []; } catch { return []; }
}
export function saveTasks(tasks: Task[], storage: Pick<Storage, 'setItem'> = localStorage): void { storage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
export function createTask(input: TaskInput, now = new Date(), id: string = crypto.randomUUID()): Task {
  const timestamp = now.toISOString(); return { ...input, title: input.title.trim(), description: input.description.trim(), id, createdAt: timestamp, updatedAt: timestamp };
}
export function updateTask(task: Task, input: TaskInput, now = new Date()): Task { return { ...task, ...input, title: input.title.trim(), description: input.description.trim(), updatedAt: now.toISOString() }; }
export function toggleComplete(task: Task, now = new Date()): Task { return { ...task, status: task.status === 'done' ? 'todo' : 'done', updatedAt: now.toISOString() }; }
export function getCounts(tasks: Task[], today = new Date().toISOString().slice(0, 10)) {
  const completed = tasks.filter(t => t.status === 'done').length;
  return { total: tasks.length, pending: tasks.length - completed, completed, overdue: tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < today).length };
}
export function filterTasks(tasks: Task[], filters: Filters): Task[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter(t => (!query || `${t.title} ${t.description}`.toLocaleLowerCase().includes(query)) && (filters.status === 'all' || t.status === filters.status) && (filters.priority === 'all' || t.priority === filters.priority)).sort((a,b) => {
    if (filters.sort === 'newest') return b.createdAt.localeCompare(a.createdAt);
    if (filters.sort === 'dueDate') return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31') || b.createdAt.localeCompare(a.createdAt);
    const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 }; return rank[a.priority] - rank[b.priority] || b.createdAt.localeCompare(a.createdAt);
  });
}
