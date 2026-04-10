# AGENTS.md - LLM Test Client

React-based LLM chat client with multi-provider support (OpenAI, Anthropic, Google, DeepSeek, Ollama), streaming SSE responses, model evaluation, MCP tool integration, and skill-based prompt templates. TypeScript + Vite + Zustand + Tailwind CSS. Single-page app with tab-based navigation (no router). UI language is Chinese (zh-CN).

## Setup

**`npm install` is required before any other command.** There is no lockfile-committed `node_modules` — the `vite` binary comes from devDependencies.

## Build / Lint / Typecheck

```bash
npm run dev              # Vite dev server on port 5173 (host exposed)
npm run build            # tsc -b && vite build
npm run typecheck        # tsc --noEmit
npm run lint             # eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
npm run preview          # Preview production build
```

- **No test framework.** Do not write tests unless asked.
- **Always run `npm run typecheck` and `npm run lint` after changes.**
- No standalone eslint config file — config is likely inline or uses defaults.

## Project Structure

```
src/
  types/          # One domain per file; index.ts barrel re-exports some
  store/          # Zustand stores: chatStore, providerStore, settingsStore, logStore, evaluationStore
  providers/      # BaseProvider abstract + OpenAI, Anthropic, Google, DeepSeek, Ollama, LoggingProvider
  components/     # Feature folders: Chat/, Settings/, Sidebar/, Markdown/, Evaluation/, Log/, MCP/, Export/, TokenCounter/
  services/       # storage.ts, export.ts, token-counter.ts
  skills/         # SkillRegistry (base.ts) + 5 built-in skills (builtin.ts)
  mcp/            # MCP client (expects external backend at localhost:3001)
  config/         # defaults.ts, providers.ts
  utils/          # helpers.ts: generateId, clsx, debounce, readFileAs*, formatFileSize
  App.tsx         # Root component (default export), three-tab layout (chat/evaluation/logs)
  main.tsx        # Entry point, wraps App in StrictMode
  index.css       # Tailwind directives + custom scrollbar + .markdown-body styles
```

No `hooks/` directory — stateful logic lives in stores or inline in components.

## Architecture & Patterns

### Provider Pattern

- All providers extend `BaseProvider` (`src/providers/base.ts`). Must implement `complete()`, `stream()` (AsyncGenerator for SSE), `countTokens()`.
- DeepSeek and Ollama extend `OpenAIProvider` (not BaseProvider directly). Ollama overrides `complete()`/`stream()` to set a dummy API key.
- `LoggingProvider` (decorator) auto-wraps every registered provider.
- `ProviderRegistry` singleton (in `src/providers/index.ts`) manages instances, falls back to OpenAI for unknown types.
- Dev-mode CORS proxy: Vite plugin (`corsProxyPlugin` in vite.config.ts) proxies `/api-proxy` + `X-Proxy-Target` header.

### State Management (Zustand)

- One store per domain, file named `<domain>Store.ts`.
- Combined state + actions interface at top of file.
- Manual `persist()` methods writing to localStorage — no Zustand persist middleware.
- Stores eagerly load from storage at creation time.
- `appendToLastAssistantMessage` debounces persistence (2000ms).
- Selectors: `useChatStore((s) => s.conversations)`. External: `useChatStore.getState()`.

### Skill System

- `SkillDefinition` interface in `skills/base.ts`; `SkillRegistry` singleton with Map storage.
- Built-in skills registered at app startup via `registerBuiltinSkills()` (called in `App.tsx` useEffect).
- Skills inject `systemPrompt` and optionally `processMessage()`.

### Storage

- All persistence via `localStorage` with `llm_client_` prefix (keys in `src/services/storage.ts`).

## Code Conventions

### TypeScript

- Strict mode, target ES2020, module resolution `bundler`, JSX `react-jsx`.
- `noUnusedLocals` and `noUnusedParameters` are `false`.
- `interface` for objects; `type` for unions/intersections/aliases.
- Timestamps: `number` (Unix ms). IDs: `string` via `generateId()`.
- Avoid `any`; use `Record<string, unknown>` for loose objects.

### Imports

- `@/` path alias for all internal imports (configured in tsconfig + vite.config.ts).
- Order: React/external first, then `@/` internal.
- Named imports only. Import types from their file (e.g. `@/types/message`), not the barrel.

```typescript
import React, { useState, useCallback } from 'react'
import { Send, Settings } from 'lucide-react'
import { ChatMessage } from '@/types/message'
import { useChatStore } from '@/store/chatStore'
import { generateId } from '@/utils/helpers'
```

### React Components

- `React.FC` with co-located `<Name>Props` interface above.
- Named exports for all components; only `App` uses `export default`.
- Feature-folder layout: `src/components/<Feature>/<Component>.tsx`.
- `React.memo` for render-heavy components (`MessageBubble`, `MarkdownRenderer`).

### Formatting

- 2-space indent, single quotes, semicolons, trailing commas in multi-line.

### Naming

- Files: PascalCase (components), camelCase (utilities/stores).
- Store hooks: `use` prefix (`useChatStore`). Singletons: camelCase (`providerRegistry`, `skillRegistry`).
- Constants: UPPER_SNAKE_CASE.

### Error Handling

- `try/catch` with graceful fallbacks for I/O.
- API error pattern: `res.json().catch(() => ({ error: { message: res.statusText } }))`.
- Empty `catch {}` acceptable for best-effort operations.

### Styling

- Tailwind CSS 3, dark mode via `'class'` strategy.
- Custom colors: `primary` (blue), `surface` (dark slate with custom `850` shade).
- Common palette: `surface-300/400/500` for text, `surface-700/800/850/900/950` for backgrounds, `primary-300/500` for accents.
- Conditional classes via `clsx()` from `@/utils/helpers`.

## Key Libraries

| Purpose | Library |
|---------|---------|
| State | zustand |
| Icons | lucide-react |
| Markdown rendering | react-markdown, remark-gfm, remark-math, rehype-highlight, rehype-katex, rehype-raw |
| Token counting | js-tiktoken (lazy-loaded, heuristic fallback) |
| Export | file-saver, jspdf, html2canvas |

## Gotchas

- `uuid` is in dependencies but unused — IDs use `generateId()` (timestamp-random).
- UI strings are hardcoded Chinese (zh-CN). Code, variables, commits in English.
- No React error boundaries, no router, no test framework.
- Async generators (`async function*`) for SSE streaming in providers.
- `import.meta.env.DEV` gates the CORS proxy (dev only).
- App starts in dark mode (`class="dark"` on `<html>` in index.html).
