---
applyTo: '**'
---

# Skill: Add Component Explorer

When the user asks to add, set up, or integrate the component explorer into their project, follow this guide.

## Prerequisites

- The project uses Vite as its bundler
- Node.js >= 22

## Step 1: Install Packages

```
npm install @vscode/component-explorer @vscode/component-explorer-cli @vscode/component-explorer-vite-plugin
```

Use the project's package manager (npm, pnpm, yarn). For workspace monorepos, install into the package that owns the Vite config.

## Step 2: Configure Vite Plugin

Add componentExplorer() to vite.config.ts:

```typescript
import { componentExplorer } from '@vscode/component-explorer-vite-plugin';

export default defineConfig({
  plugins: [
    // ... existing plugins (react, tailwind, etc.)
    componentExplorer(),
  ],
});
```

### Plugin Options

| Option | Default | Description |
|--------|---------|-------------|
| include | './src/**/*.fixture.{ts,tsx}' | Glob pattern for fixture files |
| route | '/___explorer' | URL path for the explorer UI |
| build | 'app-only' | Build mode: 'app-only', 'all', or 'explorer-only' |
| outFile | '___explorer.html' | Output filename for built explorer |
| logLevel | 'info' | 'silent', 'info', 'verbose', 'warn', 'error' |

For projects where fixtures live outside ./src, set include explicitly:

```typescript
componentExplorer({
  include: './app/**/*.fixture.{ts,tsx,js,jsx}',
}),
```

## Step 3: Create component-explorer.json

Create a configuration file at the project root:

```json
{
  "$schema": "./node_modules/@vscode/component-explorer-cli/dist/component-explorer-config.schema.json",
  "screenshotDir": ".screenshots",
  "sessions": [{ "name": "current" }],
  "viteConfig": "./vite.config.ts",
  "redirection": { "port": 5337 }
}
```

**Important: `sessions` is required.** The daemon will crash on startup without at least one session entry. `{ "name": "current" }` uses the current working tree.

### Remix Projects — Separate Vite Config

If the project uses the Remix Vite plugin, the explorer daemon **must** use a separate Vite config that excludes the Remix plugin. The Remix plugin injects a preamble that fails when fixtures are rendered outside Remix routes, causing a silent "can't detect preamble" error.

Create `vite.explorer.config.ts` with everything except the Remix plugin:

```typescript
import { componentExplorer } from '@vscode/component-explorer-vite-plugin';
// ... other plugins (tailwind, etc.)

export default defineConfig({
  // Same resolve/alias config as main vite.config.ts
  plugins: [
    // All plugins EXCEPT the Remix plugin
    componentExplorer({ include: './app/**/*.fixture.{ts,tsx}' }),
  ],
});
```

Then set `"viteConfig": "./vite.explorer.config.ts"` in component-explorer.json.

## Step 4: Configure VS Code — MCP Server

Create or update .vscode/mcp.json:

```json
{
  "servers": {
    "component-explorer": {
      "type": "stdio",
      "command": "./node_modules/.bin/component-explorer",
      "cwd": "${workspaceFolder}",
      "args": [
        "component-explorer",
        "mcp",
        "-c",
        "./component-explorer.json",
        "--no-daemon-autostart",
        "--no-daemon-hint",
        "Start the daemon by running the 'Component Explorer Daemon' VS Code task (use the run_task tool). When you start the task, try up to 2 times to give the daemon enough time to start."
      ]
    }
  }
}
```

## Step 5: Configure VS Code — Daemon Task

Add a task to .vscode/tasks.json:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Component Explorer Daemon",
      "type": "shell",
      "command": "./node_modules/.bin/component-explorer serve -c ./component-explorer.json --kill-if-running",
      "isBackground": true,
      "problemMatcher": {
        "owner": "component-explorer",
        "fileLocation": "absolute",
        "pattern": {
          "regexp": "^\\s*at\\s+(.+?):(\\d+):(\\d+)\\s*$",
          "file": 1,
          "line": 2,
          "column": 3
        },
        "background": {
          "activeOnStart": true,
          "beginsPattern": ".*Setting up sessions.*",
          "endsPattern": "Redirection server listening on.*"
        }
      }
    }
  ]
}
```

If other tasks already exist, merge the new task into the existing tasks array.

## Step 6: Configure VS Code — Launch Configuration (Optional)

Add to .vscode/launch.json:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Component Explorer (Chrome)",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5337/___explorer",
      "preLaunchTask": "Component Explorer Daemon",
      "presentation": {
        "group": "1_component_explorer",
        "order": 4
      }
    }
  ]
}
```

If other launch configurations already exist, merge the new configuration.

## Step 7: Create a First Fixture

Create a fixture file to verify the setup works.

### React Component Fixture

```tsx
// Button.fixture.tsx
import { createRoot } from 'react-dom/client';
import { defineFixture, defineFixtureGroup } from '@vscode/component-explorer';
import { Button } from './Button';

export default defineFixtureGroup({
  Primary: defineFixture({
    properties: [
      { type: 'string', name: 'label', defaultValue: 'Click me' },
      { type: 'boolean', name: 'disabled', defaultValue: false },
    ],
    render: (container, props) => {
      const root = createRoot(container);
      root.render(<Button variant="primary" disabled={props.disabled as boolean}>{props.label as string}</Button>);
      return { dispose: () => root.unmount() };
    },
  }),
  Secondary: defineFixture({
    render: (container) => {
      const root = createRoot(container);
      root.render(<Button variant="secondary">Secondary</Button>);
      return { dispose: () => root.unmount() };
    },
  }),
});
```

### Page/Layout Fixture

For full-page components, use iframe isolation with viewport presets:

```tsx
defineFixture({
  isolation: 'iframe',
  displayMode: {
    type: 'page',
    viewports: ['mobile', 'tablet', 'desktop'],
  },
  render: (container, props) => { /* ... */ },
});
```

Built-in viewport presets: 'mobile' (390×844), 'tablet' (768×1024), 'desktop' (1440×900).

## Step 8: Verify

1. Start the dev server (e.g., `pnpm dev`)
2. Open http://localhost:PORT/___explorer
3. Confirm fixtures appear in the tree view and render correctly

## Step 9 (Optional): CI Integration — Ask the User First

Before setting up CI, ask the user if they want CI integration.

## .gitignore

Add to .gitignore:

```
.screenshots/current/
```

Keep .screenshots/baseline/ committed if using screenshot comparison.
