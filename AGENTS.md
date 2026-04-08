# AGENTS.md - LLM Test Client

## Project Overview

A React-based LLM chat client supporting multiple providers (OpenAI, Anthropic, Google, DeepSeek, Ollama), streaming responses, model evaluation, MCP tool integration, and skill-based prompt templates. Built with TypeScript, Vite, Zustand, and Tailwind CSS. Single-page app with tab-based navigation (no router). UI language is Chinese (zh-CN).

## Build / Lint / Test Commands

```bash
npm run dev              # Start Vite dev server on port 5173
npm run build            # tsc -b && vite build
npm run lint             # eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
npm run typecheck        # tsc --noEmit
npm run preview          # Preview production build
```

**No test framework is configured.** Do not write tests unless asked to set up a test framework first.

**Always run `npm run typecheck` and `npm run lint` after making changes** to verify correctness.

## Project Structure

```
src/
  types/          # TypeScript type definitions (one domain per file; index.ts re-exports some)
  store/          # Zustand state stores: chatStore, providerStore, settingsStore, logStore, evaluationStore
  providers/      # LLM providers: BaseProvider abstract class + per-provider implementations
  components/     # React components in feature folders: Chat/, Settings/, Sidebar/, Markdown/, etc.
  services/       # Utility services: storage.ts, export.ts, token-counter.ts
  skills/         # Skill/prompt-template system: base.ts (SkillRegistry), builtin.ts (5 built-in skills)
  mcp/            # MCP client connecting via external backend at localhost:3001
  config/         # Defaults (defaults.ts) and provider presets (providers.ts)
  utils/          # Shared helpers (helpers.ts): generateId, clsx, debounce, readFileAs*, formatFileSize
  App.tsx         # Root component (default export), three-tab layout
  index.css       # Tailwind directives + custom scrollbar + .markdown-body styles
```

No `hooks/` directory — custom hooks are not extracted; stateful logic lives in stores or inline in components.

## Code Style Guidelines

### TypeScript

- **Strict mode** enabled. Target ES2020, module resolution `bundler`, JSX `react-jsx`.
- `noFallthroughCasesInSwitch: true`, `forceConsistentCasingInFileNames: true`.
- `noUnusedLocals` and `noUnusedParameters` are `false`, but avoid unused variables when practical.
- Use `interface` for object shapes; `type` for unions, intersections, and aliases.
- Prefer explicit return types on exported functions and class methods.
- Use `Record<string, unknown>` for loosely-typed objects; minimize `any`.
- Timestamps are `number` (Unix ms via `Date.now()`). IDs are `string` via `generateId()`.

### Imports

- Use the `@/` path alias for all internal imports (configured in tsconfig and vite.config.ts).
- **Order**: React/external libs first, then `@/` internal modules.
- Named imports only; avoid `import * as`.
- Import types directly from their file (e.g., `@/types/message`), not from the barrel `@/types`.

```typescript
import React, { useState, useCallback } from 'react'
import { Send, Settings } from 'lucide-react'
import { ChatMessage } from '@/types/message'
import { useChatStore } from '@/store/chatStore'
import { generateId } from '@/utils/helpers'
```

### Formatting

- 2-space indentation, single quotes, semicolons, trailing commas in multi-line structures.

### React Components

- Use `React.FC` with a co-located `<Name>Props` interface above the component.
- Named exports for all components; only `App` uses `export default`.
- One component per file; private helper components (e.g., `ModelSelector`) co-located in the same file.
- `React.memo` for performance-critical render-heavy components (e.g., `MessageBubble`, `MarkdownRenderer`).
- Feature-folder layout: `src/components/<Feature>/<Component>.tsx`.

### State Management (Zustand)

- One store per domain. Files named `<domain>Store.ts`.
- Combined state + actions interface at top of file.
- Pattern: `create<State>((set, get) => ({...}))`. Immutable updates via spread/map/filter.
- Manual `persist()` method per store writing to localStorage. No Zustand middleware.
- Debounced persistence where needed (e.g., `appendToLastAssistantMessage` debounces 2000ms).
- Selectors: `useChatStore((s) => s.conversations)`. External access: `useChatStore.getState()`.
- Initialization eagerly loads from storage at creation time; settings merge with defaults.

### Provider Pattern

- All providers extend `BaseProvider` (`src/providers/base.ts`).
- Must implement: `complete()`, `stream()` (AsyncGenerator for SSE), `countTokens()`.
- DeepSeek and Ollama extend `OpenAIProvider` (not BaseProvider directly).
- `LoggingProvider` (decorator) auto-wraps every registered provider via `ProviderRegistry`.
- `ProviderRegistry` singleton manages provider instances, falls back to OpenAI for unknown types.
- Local model support uses a Vite CORS proxy plugin (`/api-proxy` + `X-Proxy-Target` header) in dev mode.

### Skill System

- `SkillDefinition` interface in `skills/base.ts`; `SkillRegistry` class with Map storage.
- `skillRegistry` singleton; built-in skills registered at app startup via `registerBuiltinSkills()`.
- Skills inject `systemPrompt` and optionally `processMessage()` to transform user input.

### Styling

- Tailwind CSS 3, dark mode via `'class'` strategy.
- Custom colors: `primary` (blue scale), `surface` (dark slate, includes custom `850` shade).
- Tailwind utility classes inline in JSX. No CSS modules or styled-components.
- `.markdown-body` in `index.css` for rendered LLM output (headings, code blocks, tables, KaTeX).
- Conditional classes via `clsx()` from `@/utils/helpers`.
- Common palette: `surface-300/400/500` for text, `surface-700/800/850/900/950` for backgrounds, `primary-300/500` for accents.

### Error Handling

- `try/catch` with graceful fallbacks for I/O (localStorage, JSON, API calls).
- API error pattern:
  ```typescript
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(err.error?.message || `API Error: ${res.status}`)
  }
  ```
- Catch unknown errors: `error instanceof Error ? error.message : String(error)`.
- Empty `catch {}` acceptable for best-effort operations (e.g., malformed SSE chunks).

### Naming Conventions

- **Files/folders**: PascalCase for components (`ChatPanel.tsx`), camelCase for utilities/stores (`chatStore.ts`).
- **Components**: PascalCase. **Functions/variables**: camelCase. **Types/interfaces**: PascalCase.
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEYS`), camelCase for config objects (`defaultSettings`).
- **Store hooks**: `use` prefix (`useChatStore`). **Singletons**: camelCase (`providerRegistry`, `skillRegistry`).

### Storage

- All persistence via `localStorage` with `llm_client_` prefixed keys (`src/services/storage.ts`).
- Load functions have try/catch returning sensible defaults. Save functions assume localStorage is available.

### Key Libraries

| Purpose | Library |
|---------|---------|
| State | zustand |
| Icons | lucide-react |
| Markdown | react-markdown, remark-gfm, remark-math, rehype-highlight, rehype-katex, rehype-raw |
| Tokens | js-tiktoken (lazy-loaded, fallback heuristic) |
| Export | file-saver, jspdf, html2canvas |
| IDs | generateId() from helpers (timestamp-random, uuid package is unused) |

### Important Notes

- UI strings are hardcoded Chinese (zh-CN). Code comments, variables, and commits in English.
- No React error boundaries, no router library, no test framework.
- Async generators (`async function*`) are used for SSE streaming in providers.
- `import.meta.env.DEV` is used for the local model CORS proxy (dev mode only).
