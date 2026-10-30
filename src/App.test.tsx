import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe('task manager journey', () => {
  it('follows system preference until a theme is chosen, then persists the choice', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const view = render(<App />);
    expect(view.container.querySelector('.app-shell')).toHaveAttribute('data-theme', 'dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(view.container.querySelector('.app-shell')).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('task-manager-theme')).toBe('light');
    view.unmount();
    render(<App />);
    expect(document.querySelector('.app-shell')).toHaveAttribute('data-theme', 'light');
    vi.unstubAllGlobals();
  });
  it('keeps the first-run empty view until a search or filter is active', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('A clear desk. A fresh start.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create your first task' })).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Search tasks' }), 'missing');
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear search and filters' })).toBeInTheDocument();
    expect(screen.queryByText('A clear desk. A fresh start.')).not.toBeInTheDocument();
  });

  it('creates, edits, searches, completes, reloads, and deletes a task', async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    await user.click(screen.getByRole('button', { name: /add task/i }));
    await user.type(screen.getByLabelText(/title/i), 'Prepare roadmap');
    await user.type(screen.getByLabelText(/description/i), 'Draft milestones');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /add task/i }));
    expect(screen.getByText('Prepare roadmap')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Prepare roadmap' }));
    const title=screen.getByLabelText(/title/i); await user.clear(title); await user.type(title,'Prepare product roadmap');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await user.type(screen.getByRole('textbox', { name: 'Search tasks' }), 'product');
    expect(screen.getByText('Prepare product roadmap')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Complete Prepare product roadmap' }));
    expect(screen.getAllByText('Done').length).toBeGreaterThan(1);
    view.unmount(); render(<App />);
    expect(screen.getByText('Prepare product roadmap')).toBeInTheDocument();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete Prepare product roadmap' }));
    expect(screen.queryByText('Prepare product roadmap')).not.toBeInTheDocument();
  });
  it('shows an actionable message when saving fails', async () => {
    const user=userEvent.setup(); vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('quota','QuotaExceededError')});
    render(<App />); await user.click(screen.getByRole('button',{name:/add task/i})); await user.type(screen.getByLabelText(/title/i),'Unsaved task'); await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:/add task/i}));
    expect(screen.getByRole('alert')).toHaveTextContent(/check that browser storage is available/i); expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.getByLabelText(/title/i)).toHaveValue('Unsaved task');
  });
  it('previews an import and merges only after explicit confirmation', async () => {
    const user=userEvent.setup(); const current={id:'old',title:'Current task',description:'',status:'todo',priority:'low',dueDate:'',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'};
    const incoming={...current,id:'new',title:'Restored task'}; localStorage.setItem('task-manager.tasks.v1',JSON.stringify([current])); render(<App />);
    const file=new File([JSON.stringify({format:'task-manager-backup',version:1,exportedAt:'2026-10-30T00:00:00.000Z',tasks:[incoming]})],'backup.json',{type:'application/json'});
    await user.upload(screen.getByLabelText('Choose backup file'),file);
    expect(screen.getByRole('dialog')).toHaveTextContent('1 task'); expect(screen.getByText('Current task')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Merge with current tasks/)); await user.click(screen.getByRole('button',{name:'Apply import'}));
    expect(screen.getByText('Current task')).toBeInTheDocument(); expect(screen.getByText('Restored task')).toBeInTheDocument(); expect(JSON.parse(localStorage.getItem('task-manager.tasks.v1')||'[]')).toHaveLength(2);
  });
  it('does not change stored tasks when an invalid backup is selected', async()=>{
    const user=userEvent.setup(); const original='[{"id":"kept"}]'; localStorage.setItem('task-manager.tasks.v1',original); render(<App />);
    await user.upload(screen.getByLabelText('Choose backup file'),new File(['{}'],'bad.json',{type:'application/json'}));
    expect(screen.getByRole('alert')).toHaveTextContent(/not a Task Manager backup/); expect(localStorage.getItem('task-manager.tasks.v1')).toBe(original);
  });
  it('keeps modal keyboard focus inside and closes on Escape', () => {
    render(<App />); fireEvent.click(screen.getByRole('button',{name:/add task/i}));
    const dialog=screen.getByRole('dialog'); const close=within(dialog).getByRole('button',{name:/close dialog/i}); close.focus(); fireEvent.keyDown(window,{key:'Tab',shiftKey:true});
    expect(document.activeElement).toBe(within(dialog).getByRole('button',{name:/add task/i})); fireEvent.keyDown(window,{key:'Escape'}); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
