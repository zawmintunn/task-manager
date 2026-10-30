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
  await page.getByRole('button', { name: /add task/i }).click();
  await page.getByRole('button', { name: 'Add task' }).last().click();
  await expect(page.getByText('Enter a title to save this task.')).toBeVisible();

  await page.getByLabel('Title *').fill('Prepare roadmap');
  await page.getByLabel('Description Optional').fill('Draft milestones');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByRole('button', { name: 'Add task' }).last().click();
  await expect(page.getByText('Prepare roadmap')).toBeVisible();
  await expect(page.getByText('Total tasks').locator('..').getByText('1')).toBeVisible();

  await page.getByRole('button', { name: 'Edit Prepare roadmap' }).click();
  await page.getByLabel('Title *').fill('Prepare product roadmap');
  await page.getByLabel('Status').selectOption('in-progress');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('textbox', { name: 'Search tasks' }).fill('product');
  await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('in-progress');
  await page.getByRole('combobox', { name: 'Filter by priority' }).selectOption('high');
  await page.getByRole('combobox', { name: 'Sort tasks' }).selectOption('priority');
  await expect(page.getByText('Prepare product roadmap')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();

  await page.getByRole('button', { name: 'Complete Prepare product roadmap' }).click();
  await expect(page.getByRole('button', { name: 'Reopen Prepare product roadmap' })).toBeVisible();
  await page.getByRole('button', { name: 'Reopen Prepare product roadmap' }).click();
  await expect(page.getByRole('button', { name: 'Complete Prepare product roadmap' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Prepare product roadmap')).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete Prepare product roadmap' }).click();
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

  await page.getByRole('button', { name: 'Create your first task' }).click();
  await expect(page.getByLabel('Title *')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
