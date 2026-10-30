# Task Manager

A lightweight personal task manager for capturing work, setting priorities, and tracking progress. Tasks are stored in your browser on this device; there is no account or server.

## Requirements

- Node.js 20.19 or newer (or 22.12 or newer)
- npm

## Install and run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (usually <http://localhost:5173>).

## Example workflow

Select **Add task**, enter a title such as “Prepare project brief”, choose a priority and optional due date, then save. Search for “project”, filter by status or priority, and open the task to edit details. Use the circle control to mark it complete or reopen it. Deletion asks for confirmation. Refresh the page to see tasks saved on this browser.

## Checks and production build

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

For real-browser acceptance checks, install Playwright's Chromium once with
`npx playwright install chromium`, then run `npm run test:e2e`. The browser tests
start the Vite app automatically and save an empty-state screenshot to
`artifacts/qa-task-manager-empty.png`.

## Publish with GitHub Pages

The `Deploy Task Manager to GitHub Pages` workflow publishes the production app
when changes are pushed to `main` and can also be started from the repository's
**Actions** tab. In **Settings → Pages**, set the build and deployment source to
**GitHub Actions**. After the workflow succeeds, open
<https://zawmintunn.github.io/task-manager/>.

Tasks are saved in each visitor's browser on that device and are not shared
between visitors or synced across devices.

## MVP limitations

Tasks remain in this browser's local storage and are not synced across devices or browsers. Clearing site data removes them. This MVP has no authentication, collaboration, reminders, recurring tasks, or server backup. If browser storage is blocked or full, the app shows a save error and and keeps your saved data unchanged.
