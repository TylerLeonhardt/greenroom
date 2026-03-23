---
applyTo: '**'
---

# Skill: Use Component Explorer

When the user asks to create fixtures, take screenshots, compare components, or work with the component explorer, follow this guide.

## Understanding the Architecture

The component explorer has three layers:

1. Vite plugin — discovers *.fixture.{ts,tsx} files, serves the explorer UI at /___explorer
2. Daemon (`component-explorer serve`) — manages browser instances, HMR, screenshot capture
3. MCP server (`component-explorer mcp`) — exposes tools for AI agents to interact with the daemon

The MCP server is configured in .vscode/mcp.json. The daemon is started via a VS Code task.

## Starting the Explorer

1. Start the daemon: Run the VS Code task "Launch Component Explorer" (or equivalent). This starts the dev server and browser context.
2. Open the UI: Navigate to http://localhost:5173/___explorer (port may vary).
3. MCP connects automatically: Once the daemon is running, the MCP server polls for it and connects.

If the MCP server reports the daemon is not running, start the daemon task and retry (up to 4 times to allow startup).

## Writing Fixtures

Fixture files end in .fixture.ts or .fixture.tsx and are auto-discovered by the Vite plugin.

### Core Pattern

Every fixture has a render function that receives a container DOM element and a RenderContext:

```typescript
import { defineFixture } from '@vscode/component-explorer';

export default defineFixture({
  render: (container) => {
    // Render your component into container
    return { dispose: () => { /* cleanup */ } };
  },
});
```

The render function can return:
- void / undefined — no cleanup needed, immediately ready
- { dispose } — object with cleanup function
- { ready, dispose } — ready is a Promise that resolves when fully rendered
- A Promise of any of the above — for async render functions

### Render Context

The second argument to render provides:
- signal — AbortSignal for cancellation (check signal.aborted or listen to 'abort')

```typescript
defineFixture({
  render: async (container, { signal }) => {
    const data = await fetch('/api/data', { signal });
    container.textContent = await data.text();
  },
});
```

### React Fixtures

```tsx
import { createRoot } from 'react-dom/client';
import { defineFixture } from '@vscode/component-explorer';
import { MyComponent } from './MyComponent';

export default defineFixture({
  render: (container) => {
    const root = createRoot(container);
    root.render(<MyComponent />);
    return { dispose: () => root.unmount() };
  },
});
```

### Fixture Groups

Group related fixtures in a single file:

```typescript
import { defineFixture, defineFixtureGroup } from '@vscode/component-explorer';

export default defineFixtureGroup({
  Default: defineFixture({ render: (c) => { /* ... */ } }),
  WithError: defineFixture({ render: (c) => { /* ... */ } }),
  Disabled: defineFixture({ render: (c) => { /* ... */ } }),
});
```

Groups can have metadata (path prefix, labels):

```typescript
export default defineFixtureGroup({ path: 'Forms/', labels: ['forms'] }, {
  Primary: defineFixture({ /* ... */ }),
  Secondary: defineFixture({ /* ... */ }),
});
```

### Fixture Variants

For closely related variants rendered side-by-side:

```typescript
import { defineFixture, defineFixtureGroup, defineFixtureVariants } from '@vscode/component-explorer';

export default defineFixtureGroup({
  Sizes: defineFixtureVariants({
    Small: defineFixture({ render: (c) => { /* ... */ } }),
    Medium: defineFixture({ render: (c) => { /* ... */ } }),
    Large: defineFixture({ render: (c) => { /* ... */ } }),
  }),
});
```

### Isolation Modes

| Mode | Use When |
|------|----------|
| 'none' (default) | Components rendered in the light DOM, no style isolation |
| 'shadow-dom' | Standard components — styles scoped via Shadow DOM |
| 'iframe' | Full-page layouts, components needing complete document isolation |

```typescript
defineFixture({
  isolation: 'iframe',
  displayMode: { type: 'page', viewports: ['mobile', 'tablet', 'desktop'] },
  render: (container) => { /* full page component */ },
});
```

### Display Modes

- `{ type: 'component' }` (default) — renders at natural size
- `{ type: 'page', viewports: ['mobile', 'tablet', 'desktop'] }` — renders in device-sized viewports. Built-in presets: 'mobile' (390x844), 'tablet' (768x1024), 'desktop' (1440x900).

### Styles

Inject stylesheets into the fixture's isolation boundary:

```typescript
defineFixture({
  styles: [
    { type: 'css', content: '.my-class { color: red; }' },
    { type: 'url', href: '/path/to/styles.css' },
  ],
  render: (container) => { /* ... */ },
});
```

### Labels

Labels are string arrays used for filtering and categorizing fixtures:

```typescript
defineFixture({
  labels: ['.screenshot'],
  render: (container) => { /* ... */ },
});
```

Labels can also be set on groups and variants, where they apply to all children:

```typescript
defineFixtureGroup({ labels: ['blocks-ci'] }, { /* fixtures */ });
defineFixtureVariants({ labels: ['.screenshot'] }, { /* variants */ });
```

### Background

Set background: 'dark' for components designed for dark backgrounds:

```typescript
defineFixture({
  background: 'dark',
  render: (container) => { /* ... */ },
});
```

## Recommended Patterns

### Extract Render Functions

For complex fixtures, extract render logic into standalone named functions:

```typescript
export default defineFixtureGroup({
  Buttons: defineFixture({
    labels: ['.screenshot'],
    render: renderButtons,
  }),
  InputBoxes: defineFixture({
    labels: ['.screenshot'],
    render: renderInputBoxes,
  }),
});

function renderButtons(container: HTMLElement): void {
  container.style.padding = '16px';
  container.style.display = 'flex';
  container.style.gap = '8px';
}

function renderInputBoxes(container: HTMLElement): void {
  // ...
}
```

### Set Explicit Container Dimensions

Fixtures should set explicit width/height on the container for deterministic screenshots:

```typescript
function renderEditor(container: HTMLElement): void {
  container.style.width = '600px';
  container.style.height = '400px';
}
```

### Project-Specific Wrapper Functions

For large projects, create a shared utility file (e.g. fixtureUtils.ts) with wrapper functions that apply common setup to all fixtures. Examples:

- Auto-create Dark/Light theme variants using defineFixtureVariants
- Inject shared services or dependency injection containers
- Manage cleanup via a disposable store
- Apply project-wide styles or container setup

### Async Render with Services

```typescript
defineFixture({
  render: async (container, { signal }) => {
    const services = await createServices();
    const widget = services.createWidget(container, { /* options */ });
    return { dispose: () => widget.dispose() };
  },
});
```

### Parameterized Render Functions

```typescript
interface WidgetFixtureOptions {
  code: string;
  width?: string;
  height?: string;
}

export default defineFixtureGroup({ path: 'editor/' }, {
  TypeScript: defineFixture({
    labels: ['.screenshot'],
    render: (container) => renderWidget({ code: tsCode, width: '600px', height: '400px' }, container),
  }),
  Markdown: defineFixture({
    labels: ['.screenshot'],
    render: (container) => renderWidget({ code: mdCode, width: '500px' }, container),
  }),
});

function renderWidget(options: WidgetFixtureOptions, container: HTMLElement): void {
  container.style.width = options.width ?? '400px';
  container.style.height = options.height ?? '300px';
}
```

## MCP Tools Reference

### Discovery
- `list_fixtures` — List all fixtures. Supports fixtureIdPattern (regex) and labelPattern (regex) filters.
- `sessions` — List active sessions with URLs and source tree IDs.
- `get_url` — Get URLs for viewing fixtures in the explorer UI or raw rendering.

### Screenshots
- `screenshot` — Take a screenshot of a single fixture. Set stabilityCheck: true for extra verification.
- `check_stability` — Check rendering stability of multiple fixtures.

### Comparison (requires multiple sessions)
- `compare_screenshot` — Compare a fixture's screenshot across two sessions.
- `approve_diff` — Approve a known visual diff with a comment.

### Watch List
- `watch_add` / `watch_remove` / `watch_set` — Manage the fixture watch list.
- `watch_compare` — Compare all watched fixtures across sessions.
- `wait_for_update` — Block until source changes, then auto-re-screenshot watched fixtures.

### Debugging
- `evaluate_js` — Evaluate a JavaScript expression in the browser page.
- `debug_reload_page` — Force-reload the browser page.

### Session Management
- `open_session` — Open a new worktree-backed session at a git ref.
- `close_session` — Close a dynamic session.
- `update_session_ref` — Change the git ref of a dynamic session.
- `restart_session` — Restart a stuck session.

### Tasks
- `check_task` — Poll a long-running task for progress.
- `cancel_task` — Cancel a running task.

## Common Workflows

### Creating a Fixture for an Existing Component

1. Find the component file (e.g., `app/components/Button.tsx`).
2. Create `app/components/Button.fixture.tsx` next to it.
3. Import the component and wrap it in defineFixture with a render function.
4. The explorer auto-discovers the fixture — refresh the explorer UI.

### Taking Screenshots via MCP

1. `list_fixtures` — find the fixture ID
2. `screenshot(fixtureId)` — capture the current state
3. `screenshot(fixtureId, stabilityCheck: true)` — verify rendering is stable

### Comparing Against a Baseline

1. `sessions` — check available sessions
2. `open_session(name: "baseline", ref: "main")` — if no baseline session exists
3. `compare_screenshot(fixtureId)` — see the diff
4. `approve_diff(fixtureId, originalHash, modifiedHash, comment)` — if the change is intentional

### Watching Fixtures During Development

1. `watch_set(fixtureIds: ["Button/Primary", "Button/Secondary"])`
2. `wait_for_update(sourceTreeId)` — blocks until code changes, auto-re-screenshots
3. Repeat `wait_for_update` with the new sourceTreeId

## File Naming Convention

Place fixture files next to the component they test:

```
app/
  components/
    Button/
      Button.tsx
      Button.fixture.tsx
    Input/
      Input.tsx
      Input.fixture.tsx
```

## Troubleshooting

- **Fixture not appearing:** Verify the file matches the glob pattern. Check the vite plugin's `include` option.
- **MCP timeout:** The daemon may not be running. Start it via the VS Code task.
- **Stale screenshots:** Use `debug_reload_page` to force-reload, or `restart_session` if stuck.
- **Style leaks:** Use `isolation: 'iframe'` for components needing full document isolation.
