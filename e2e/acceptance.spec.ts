import { expect, test } from '@playwright/test';

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

  await page.getByLabel('Title *').fill('Prepare roadmap');
  await page.getByLabel('Description Optional').fill('Draft milestones');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByLabel('Due date Optional').fill('2099-01-01');
  await page.getByRole('button', { name: 'Add task' }).last().click();
  await expect(page.getByText('Prepare roadmap')).toBeVisible();

  await page.getByRole('button', { name: /add task/i }).click();
  await page.getByLabel('Title *').fill('Product closeout');
  await page.getByLabel('Priority').selectOption('low');
  await page.getByLabel('Due date Optional').fill('2098-01-01');
  await page.getByRole('button', { name: 'Add task' }).last().click();
  const stat = (label: string) => page.locator('.stat-card').filter({ hasText: label }).locator('strong');
  await expect(stat('Total tasks')).toHaveText('2');
  await expect(stat('Pending')).toHaveText('2');

  await page.getByRole('button', { name: 'Edit Prepare roadmap' }).click();
  await page.getByLabel('Title *').fill('Prepare product roadmap');
  await page.getByLabel('Status').selectOption('in-progress');
  await page.getByRole('button', { name: 'Save changes' }).click();
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
