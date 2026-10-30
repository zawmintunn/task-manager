import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe('task manager journey', () => {
  it('moves a board card to a dropped column and persists its status', async () => {
    const task={id:'drag-me',title:'Drag me',description:'',status:'todo',priority:'medium',dueDate:'',assignee:null,tags:[],createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z',activity:[]};
    localStorage.setItem('task-manager.tasks.v1',JSON.stringify([task]));
    const user=userEvent.setup(); render(<App />); await user.click(screen.getByRole('button',{name:'Board'}));
    const card=screen.getByText('Drag me').closest('.board-card') as HTMLElement;
    const column=screen.getByRole('region',{name:/In Progress/});
    const data={value:'',setData(_type:string,value:string){this.value=value},getData(){return this.value}};
    fireEvent.dragStart(card,{dataTransfer:data}); fireEvent.dragOver(column); fireEvent.drop(column,{dataTransfer:data});
    expect(within(column).getByText('Drag me')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('task-manager.tasks.v1')||'[]')[0].status).toBe('in-progress');
  });
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
  it('creates, edits, displays, filters, and reloads tags', async()=>{
    const user=userEvent.setup(); const view=render(<App />);
    await user.click(screen.getByRole('button',{name:/add task/i}));
    const createDialog=screen.getByRole('dialog');
    await user.type(within(createDialog).getByLabelText(/title/i),'Plan release');
    await user.type(within(createDialog).getByLabelText(/tags/i),' Work, Planning, work, ');
    await user.click(within(createDialog).getByRole('button',{name:'Add task'}));
    expect(screen.getByLabelText('Tags')).toHaveTextContent('work');
    expect(screen.getByLabelText('Tags')).toHaveTextContent('planning');

    await user.click(screen.getByRole('button',{name:'Edit Plan release'}));
    const editDialog=screen.getByRole('dialog');
    const tagInput=within(editDialog).getByLabelText(/tags/i);
    await user.clear(tagInput); await user.type(tagInput,'Review, Follow-up, REVIEW');
    await user.click(within(editDialog).getByRole('button',{name:'Save changes'}));
    expect(screen.getByLabelText('Tags')).toHaveTextContent('review');
    expect(screen.getByLabelText('Tags')).toHaveTextContent('follow-up');
    expect(screen.getByLabelText('Tags').querySelectorAll('.tag-chip')).toHaveLength(2);

    const filter=screen.getByRole('textbox',{name:'Filter by tag'});
    await user.type(filter,'review, follow-up');
    expect(screen.getByText('Plan release')).toBeInTheDocument();
    await user.clear(filter); await user.type(filter,'missing');
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    view.unmount(); render(<App />);
    expect(screen.getByLabelText('Tags')).toHaveTextContent('follow-up');
  });
  it('imports a legacy backup task without tags and normalizes it for storage', async()=>{
    const user=userEvent.setup(); render(<App />);
    const legacy={id:'legacy',title:'Old task',description:'',status:'todo',priority:'medium',dueDate:'',createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-01T00:00:00.000Z'};
    const backup={format:'task-manager-backup',version:1,exportedAt:'2026-10-01T00:00:00.000Z',tasks:[legacy]};
    await user.upload(screen.getByLabelText('Choose backup file'),new File([JSON.stringify(backup)],'legacy.json',{type:'application/json'}));
    expect(screen.getByRole('dialog')).toHaveTextContent('1 task');
    await user.click(screen.getByRole('button',{name:'Apply import'}));
    expect(screen.getByText('Old task')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('task-manager.tasks.v1')||'[]')[0].tags).toEqual([]);
  });
  it('keeps modal keyboard focus inside and closes on Escape', () => {
    render(<App />); fireEvent.click(screen.getByRole('button',{name:/add task/i}));
    const dialog=screen.getByRole('dialog'); const close=within(dialog).getByRole('button',{name:/close dialog/i}); close.focus(); fireEvent.keyDown(window,{key:'Tab',shiftKey:true});
    expect(document.activeElement).toBe(within(dialog).getByRole('button',{name:/add task/i})); fireEvent.keyDown(window,{key:'Escape'}); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
