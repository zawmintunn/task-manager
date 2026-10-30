import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('task lifecycle, filters, persistence, deletion, and browser console', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A clear desk. A fresh start.' })).toBeVisible();

  await page.screenshot({ path: 'artifacts/qa-task-manager-empty.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Search tasks' }).fill('no matching task');
  await expect(page.getByRole('heading', { name: 'No tasks found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await page.getByRole('button', { name: /add task/i }).click();
  await page.getByRole('button', { name: 'Add task' }).last().click();
  await expect(page.getByText('Enter a title to save this task.')).toBeVisible();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title *').fill('Prepare roadmap');
  await dialog.getByLabel('Description Optional').fill('Draft milestones');
  await dialog.getByLabel('Priority').selectOption('high');
  await dialog.getByLabel('Due date Optional').fill('2099-01-01');
  await dialog.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByText('Prepare roadmap')).toBeVisible();

  await page.getByRole('button', { name: /add task/i }).click();
  await page.getByRole('dialog').getByLabel('Title *').fill('Product closeout');
  await page.getByRole('dialog').getByLabel('Priority').selectOption('low');
  await page.getByRole('dialog').getByLabel('Due date Optional').fill('2098-01-01');
  await page.getByRole('dialog').getByRole('button', { name: 'Add task' }).click();
  const stat = (label: string) => page.locator('.stat-card').filter({ hasText: label }).locator('strong');
  await expect(stat('Total tasks')).toHaveText('2');
  await expect(stat('Pending')).toHaveText('2');

  await page.getByRole('button', { name: 'Edit Prepare roadmap', exact: true }).click();
  await dialog.getByLabel('Title *').fill('Prepare product roadmap');
  await dialog.getByLabel('Status').selectOption('in-progress');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('textbox', { name: 'Search tasks' }).fill('product');
  await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('in-progress');
  await page.getByRole('combobox', { name: 'Filter by priority' }).selectOption('high');
  await page.getByRole('combobox', { name: 'Sort tasks' }).selectOption('priority');
  await expect(page.getByText('Prepare product roadmap')).toBeVisible();
  await expect(page.locator('.task-card .task-title')).toHaveText(['Prepare product roadmap']);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  const titles = page.locator('.task-card .task-title');
  await page.getByRole('combobox', { name: 'Sort tasks' }).selectOption('priority');
  await expect(titles).toHaveText(['Prepare product roadmap', 'Product closeout']);
  await page.getByRole('combobox', { name: 'Sort tasks' }).selectOption('dueDate');
  await expect(titles).toHaveText(['Product closeout', 'Prepare product roadmap']);

  await page.getByRole('button', { name: 'Complete Prepare product roadmap' }).click();
  await expect(page.getByRole('button', { name: 'Reopen Prepare product roadmap' })).toBeVisible();
  await expect(stat('Pending')).toHaveText('1');
  await expect(stat('Completed')).toHaveText('1');
  await page.getByRole('button', { name: 'Reopen Prepare product roadmap' }).click();
  await expect(page.getByRole('button', { name: 'Complete Prepare product roadmap' })).toBeVisible();
  await expect(stat('Pending')).toHaveText('2');
  await expect(stat('Completed')).toHaveText('0');
  await page.reload();
  await expect(page.getByText('Prepare product roadmap')).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Prepare product roadmap' }).click();
  await expect(page.getByText('Prepare product roadmap')).toHaveCount(0);
  await page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Product closeout' }).click();
  await expect(page.getByRole('heading', { name: 'A clear desk. A fresh start.' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('mobile layout and keyboard dialog controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A clear desk. A fresh start.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/qa-task-manager-mobile.png', fullPage: true });

  await page.getByRole('button', { name: 'Create your first task' }).click();
  await expect(page.getByLabel('Title *')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Add task' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('board assignment, activity history, persistence, and backup round trip', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: /add task/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title *').fill('Coordinate launch');
  await dialog.getByLabel('Owner Optional').fill('Morgan Lee');
  await dialog.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByText('Morgan Lee')).toBeVisible();

  await page.getByRole('button', { name: 'Edit Coordinate launch', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Task activity history' })).toContainText('Task created');
  await dialog.getByLabel('Owner Optional').fill('Riley Chen');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Riley Chen')).toBeVisible();

  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.locator('[aria-label="Tasks by status"]').getByRole('heading', { name: 'To Do' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Move Coordinate launch to status' }).selectOption('in-progress');
  await expect(page.locator('.board-in-progress')).toContainText('Coordinate launch');

  await page.getByRole('button', { name: 'View or edit Coordinate launch' }).click();
  await expect(page.getByRole('region', { name: 'Task activity history' })).toContainText('Owner changed from Morgan Lee to Riley Chen');
  await expect(page.getByRole('region', { name: 'Task activity history' })).toContainText('Status changed from To Do to In Progress');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.locator('.board-in-progress')).toContainText('Coordinate launch');
  await expect(page.locator('.board-in-progress')).toContainText('Riley Chen');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8')) as {
    tasks: Array<{ title: string; assignee: string; status: string; activity: Array<{ type: string }> }>;
  };
  expect(exported.tasks).toHaveLength(1);
  expect(exported.tasks[0]).toMatchObject({ title: 'Coordinate launch', assignee: 'Riley Chen', status: 'in-progress' });
  expect(exported.tasks[0].activity.map(event => event.type)).toEqual(expect.arrayContaining(['created', 'assignment_changed', 'status_changed']));

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Import backup' }).click();
  await page.getByLabel('Choose backup file').setInputFiles(await download.path());
  await expect(page.getByRole('dialog', { name: 'Import backup' })).toContainText('The file contains 1 task');
  await page.getByRole('button', { name: 'Apply import' }).click();
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.locator('.board-in-progress')).toContainText('Coordinate launch');
  await expect(page.locator('.board-in-progress')).toContainText('Riley Chen');
  await page.getByRole('button', { name: 'View or edit Coordinate launch' }).click();
  await expect(page.getByRole('region', { name: 'Task activity history' })).toContainText('Owner changed from Morgan Lee to Riley Chen');
  await expect(page.getByRole('region', { name: 'Task activity history' })).toContainText('Status changed from To Do to In Progress');
});

test('tags can be created, edited, filtered, persisted, and restored from backup', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: /add task/i }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title *').fill('Plan release');
  await dialog.getByLabel(/Tags/).fill(' Work, Planning, work, ');
  await dialog.getByRole('button', { name: 'Add task' }).click();
  await expect(page.locator('.task-card').filter({ hasText: 'Plan release' }).getByLabel('Tags')).toContainText('Work');
  await expect(page.locator('.task-card').filter({ hasText: 'Plan release' }).getByLabel('Tags')).toContainText('Planning');

  await page.getByRole('button', { name: /add task/i }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title *').fill('Write update');
  await dialog.getByLabel(/Tags/).fill('review');
  await dialog.getByRole('button', { name: 'Add task' }).click();

  await page.getByRole('button', { name: 'Edit Plan release', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Tags/).fill('Review, Follow-up, REVIEW');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  const planCard = page.locator('.task-card').filter({ hasText: 'Plan release' });
  await expect(planCard.getByLabel('Tags')).toContainText('review');
  await expect(planCard.getByLabel('Tags')).toContainText('follow-up');
  await expect(planCard.getByLabel('Tags').locator('.tag-chip')).toHaveCount(2);

  await page.getByRole('textbox', { name: 'Filter by tag' }).fill('review, follow-up');
  await expect(page.locator('.task-card .task-title')).toHaveText(['Plan release']);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.reload();
  await expect(page.locator('.task-card').filter({ hasText: 'Plan release' }).getByLabel('Tags')).toContainText('follow-up');

  await page.getByRole('button', { name: 'Board', exact: true }).click();
  const board = page.locator('.board');
  await expect(board.getByRole('region', { name: 'To Do' }).filter({ hasText: 'Plan release' }).getByLabel('Tags')).toContainText('review');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8')) as { version: number; tasks: Array<{ title: string; tags: string[] }> };
  expect(exported.version).toBe(1);
  expect(exported.tasks.find(task => task.title === 'Plan release')?.tags).toEqual(['review', 'follow-up']);

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Import backup' }).click();
  await page.getByLabel('Choose backup file').setInputFiles(await download.path());
  await page.getByRole('button', { name: 'Apply import' }).click();
  await expect(page.locator('.task-card').filter({ hasText: 'Plan release' }).getByLabel('Tags')).toContainText('follow-up');
});

test('legacy backups import without tags and tags remain accessible in mobile list and board views', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const legacy = {
    id: 'legacy-no-tags', title: 'Legacy task', description: '', status: 'todo', priority: 'medium', dueDate: '',
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  };
  const legacyBackup = { format: 'task-manager-backup', version: 1, exportedAt: '2026-10-01T00:00:00.000Z', tasks: [legacy] };
  await page.getByRole('button', { name: 'Import backup' }).click();
  await page.getByLabel('Choose backup file').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacyBackup)) });
  await expect(page.getByRole('dialog', { name: 'Import backup' })).toContainText('The file contains 1 task');
  await page.getByRole('button', { name: 'Apply import' }).click();
  await expect(page.getByRole('button', { name: 'View or edit Legacy task' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole('button', { name: /add task/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/Tags/)).toBeVisible();
  await dialog.getByLabel('Title *').fill('Mobile tagged task');
  await dialog.getByLabel(/Tags/).fill('mobile, qa');
  await dialog.getByRole('button', { name: 'Add task' }).click();
  const mobileCard = page.locator('.task-card').filter({ hasText: 'Mobile tagged task' });
  await expect(mobileCard.getByLabel('Tags')).toContainText('mobile');
  await expect(page.getByRole('textbox', { name: 'Filter by tag' })).toBeVisible();
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  const todoColumn = page.locator('.board-todo');
  await expect(todoColumn.getByRole('button', { name: 'View or edit Mobile tagged task' }).getByLabel('Tags')).toContainText('qa');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
