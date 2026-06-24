# Unified Router Phase 2 — Short-Term Improvements (Revised)

**Plan ID**: UR-PHASE2-002
**Date**: 2026-06-23
**Status**: pending-review
**Language**: strict EN — code, comments, logs, commits.

---

## Goal

Implement the 4 unchecked short-term items from `INTEGRATION_SUMMARY.md`, corrected for the real architecture discovered during code audit.

## Real Architecture (verified 2026-06-23)

```
POST /api/v1/chat/completions
  → detectModelSwitchRequest(userContent)
  → routeRequest() → IntelligentRouterUnified.route()
      → semantic.analyze() [HARDCODED: empty capabilities]
      → returns RoutingDecision (selectedModel string)
  → body.model = routingDecision.selectedModel
  → detectIntentFromRequest(body) → target endpoint path
  → fetch(targetEndpoint) → POST /api/chat
      → SmartRouterComponent.invoke() [2nd router, ignores body.model!]
      → routing_rules[route].preferred_models[0]
      → resolve API key by modelDetails.type (lines 296-308)
      → createChatOpenAIInstance(apiKey, model, baseURL) → llm [NEVER PASSED TO CHAINS]
      → createBasicChain() / createVisionChain() / createRAGChain()
          → internally calls createChatOpenAIConfig()
          → getDefaultOpenAICompatProvider() [scans env vars: NEKO/OPENAI/O3]
          → new ChatOpenAI(...) [ignores routing decision!]
      → chain.invoke({ input })
```

**Critical finding**: Chains ignore routing decisions entirely. All models go through the default OpenAI-compatible provider (NEKO) via `createChatOpenAIConfig()`. Type-specific API key resolution at lines 296-308 is dead code — the `llm` variable is never passed to chains.

### Verified file reality

| File | Reality |
|---|---|
| `models-config.json` | Object map `{models: {"gpt-5-all": {...}, ...}}`. No `id`/`name`/`provider` fields. `type` values: `openai_compatible`, `deepseek`, `google_gemini`, `alibaba_tongyi`, `tencent_hunyuan`, `o3_provider`. `config.apiKey`/`config.baseURL` store env var NAMES. `capabilities` is object `{vision: bool, ...}`. `priority` keys: `vision_processing`, `complex_reasoning`, `creative_writing`, `code_generation`, etc. Has `routing_rules`, `selection_strategy`, `keywords` sections. |
| `utils/unified-router.ts` | Pure decision engine (197 lines). `semantic.analyze` returns `{confidence:0.5, detectedCapabilities:[]}`. `intentCache` already exists. `analyzeCapabilities()` expects array but config has object → broken, never called. No provider calling code. |
| `utils/openai-compat.ts` | `selectBestModelForAuto()` imported but UNUSED in v1 route. `detectIntentFromRequest()` returns endpoint path. `MODEL_DISPLAY_NAME`/`MODEL_MAPPING`/`getSupportedModels()` exist. |
| `utils/openaiProvider.ts` | `createChatOpenAIConfig()` → `getDefaultOpenAICompatProvider()` scans env vars for `*_API_KEY`/`*_BASE_URL` pairs. Returns `{model, apiKey, configuration:{baseURL}}`. |
| `utils/langfuseClient.ts` | Single `sendEvent()` POST function. No trace tree, no score API. |
| `src/chains/basic-chain.ts` | `createBasicChain()` — no params. Calls `createChatOpenAIConfig()`, creates `new ChatOpenAI(...)`. |
| `src/chains/vision-chain.ts` | Same pattern. |
| `src/chains/rag-chain.ts` | Same pattern. |
| `app/api/chat/route.ts` | Has DUPLICATE `case "vision_tasks":` (lines 355, 360). Creates `llm` at line 325, never passes to chains. |
| `app/api/v1/chat/completions/route.ts` | Calls `routeRequest()` (unified-router), sets `body.model`, calls `fetch('/api/chat')`. |
| `app/api/admin/models/route.ts` | GET/POST/PUT/DELETE. Uses `fs.writeFileSync` — **won't work on Vercel** (pre-existing). |
| `scripts/` | `test-api-chat-route.js` (25 lines, fetch-based). No `test-unified-router.js`. |

### Dependencies (verified from package.json)
- `@langchain/openai` ✓
- `@langchain/community` ✓ (may include ChatAnthropic/ChatCohere)
- `@langchain/google-genai` ✓
- `@langchain/deepseek` ✓
- `@langchain/anthropic` ✗ (need to install)
- `@langchain/cohere` ✗ (need to install)

## Architecture (Phase 2 target)

```
POST /api/v1/chat/completions
  → unified-router.route() with FIXED semantic.analyze (Task 2)
  → body.model = selectedModel
  → fetch('/api/chat')
      → SmartRouterComponent (existing, kept as-is)
      → routing_rules[route].preferred_models[0]
      → createChatModelInstance(type, apiKey, model, baseURL) (Task 1)
          → ChatOpenAI | ChatAnthropic | ChatCohere
      → createBasicChain(llm) / createVisionChain(llm) / createRAGChain(llm) (Task 1)
      → chain.invoke()
  → Langfuse trace spans flushed (Task 3)

Offline: scripts/eval-routing.js (Task 4)
```

## Tech Stack

- TypeScript 5.4, Next.js 14.2 (App Router), LangChain 0.3, Yarn 4.9
- New: `@langchain/anthropic`, `@langchain/cohere`

## Baseline / Authority Refs

| Ref | Relevance |
|---|---|
| `INTEGRATION_SUMMARY.md` §短期计划 | This plan's scope |
| `models-config.json` (lines 1-495) | Actual schema, `keywords` section |
| `utils/unified-router.ts` (lines 1-197) | Router to fix |
| `utils/openai-compat.ts` (lines 1-630) | Model lists to update |
| `utils/openaiProvider.ts` (lines 1-122) | Provider config (chains use this) |
| `src/chains/basic-chain.ts` (lines 1-29) | Chain to modify |
| `src/chains/vision-chain.ts` (lines 1-28) | Chain to modify |
| `src/chains/rag-chain.ts` (lines 1-33) | Chain to modify |
| `app/api/chat/route.ts` (lines 1-428) | Provider dispatch + bug fix |
| `app/api/v1/chat/completions/route.ts` (lines 1-278) | Trace wiring |
| `docs/TRINITY_ORCHESTRATION_ROADMAP.md` Task 0 | Overlap: chain refactoring is necessary for this plan |

## Compatibility Boundary

- **MUST preserve**: All existing API endpoints and response formats
- **MUST preserve**: `models-config.json` schema (extend with new `type` values, don't break)
- **MUST preserve**: Chain backward compatibility — `createBasicChain()` without args still works
- **MUST NOT**: Change `SmartRouterComponent` behavior (fixing dual-router is Trinity Task 0, not this plan)
- **MUST NOT**: Break existing model routing (13 existing models continue to work)
- **NON-GOAL**: Full dual-router unification (Trinity Task 0), Thinker/Worker/Verifier (Trinity Phase 1)

## Serverless Constraints

| Component | Compatible? | Mitigation |
|---|---|---|
| Config entries (Task 1) | ✅ | Static JSON, deployed with code |
| chatModelFactory (Task 1) | ✅ | Pure function, creates LangChain model instances per-request |
| Modified chains (Task 1) | ✅ | LLM instances created per-request, no shared state |
| semantic.analyze keyword check (Task 2) | ✅ | Pure string matching, no API call |
| intentCache (Task 2) | ⚠️ | Already exists in unified-router.ts. Best-effort — works for warm requests, evaporates on cold start. NOT removed (zero cost, some benefit). |
| LangfuseTracer (Task 3) | ✅ | Fire-and-forget async flush, no persistent in-memory state |
| eval-routing.js (Task 4) | ✅ | Offline script, runs locally/CI, no runtime dependency |
| ~~RouterMetricsCollector~~ | ❌ | REMOVED from plan. In-memory metrics don't survive cold starts. |
| ~~ABTestManager with in-memory results~~ | ❌ | REMOVED from plan. Replaced with offline eval. |
| `fs.writeFileSync` in admin routes | ❌ | Pre-existing issue, NOT introduced by this plan. Noted for awareness. |

## Verification (global)

- `yarn tsc --noEmit` passes (pre-condition: fix duplicate case)
- `yarn build` succeeds
- `yarn dev` starts without errors
- Manual smoke test: `model: "auto"` → response from a real model
- LSP diagnostics clean on all modified files

---

## Pre-condition: Fix duplicate case bug in /api/chat/route.ts

**File**: `app/api/chat/route.ts`

**Problem**: `case "vision_tasks":` appears at lines 355 and 360, causing TypeScript error and unreachable code.

**Fix**: Merge the two cases. The first occurrence (line 355) chains `"basic" | "agent" | "vision_tasks"` using `createVisionChain()`. The second (line 360) chains `"vision_tasks" | "reasoning_tasks" | ...` using `createBasicChain()`. Keep the more specific handler (line 355 — use `createVisionChain()` for vision_tasks).

```typescript
// BEFORE (lines 352-369):
switch (route) {
  case "basic":
  case "agent":
  case "vision_tasks": {           // ← FIRST occurrence
    const chain = createVisionChain();
    result = await chain.invoke({ input: safeMessageContent });
    break;
  }
  case "vision_tasks":             // ← DUPLICATE, unreachable
  case "reasoning_tasks":
  case "chinese_tasks":
  case "code_tasks":
  case "creative_tasks":
  case "structured_output": {
    const chain = createBasicChain();
    result = await chain.invoke({ input: safeMessageContent });
    break;
  }

// AFTER:
switch (route) {
  case "basic":
  case "agent":
  case "vision_tasks": {
    const chain = createVisionChain();
    result = await chain.invoke({ input: safeMessageContent });
    break;
  }
  case "reasoning_tasks":
  case "chinese_tasks":
  case "code_tasks":
  case "creative_tasks":
  case "structured_output": {
    const chain = createBasicChain();
    result = await chain.invoke({ input: safeMessageContent });
    break;
  }
```

**Verify**: `yarn tsc --noEmit` passes.

---

## Task 1: Add Anthropic + Cohere Native Provider Support

**Why**: INTEGRATION_SUMMARY lists Anthropic/Cohere as short-term targets. Current code uses `ChatOpenAI` for ALL providers — even Google Gemini and DeepSeek. Adding native SDK support enables direct API access without proxy services, reducing latency and cost.

**Critical prerequisite**: Chains must accept injected LLM instances. Currently they create their own `ChatOpenAI` via `createChatOpenAIConfig()`, bypassing the model-specific API key resolution entirely. This task fixes that.

### Step 1.1: Install LangChain provider packages

```bash
yarn add @langchain/anthropic @langchain/cohere
```

### Step 1.2: Add config entries to models-config.json

Add to the `"models"` object (not an array — the schema is an object map):

```json
"claude-sonnet-4-native": {
  "type": "anthropic",
  "config": {
    "apiKey": "ANTHROPIC_API_KEY",
    "model": "claude-sonnet-4-20250514",
    "temperature": 0.7
  },
  "capabilities": {
    "vision": true,
    "reasoning": true,
    "tool_calling": true,
    "structured_output": true,
    "agents": false,
    "chinese": false,
    "search": false,
    "web_search": false,
    "code_generation": true,
    "creative_writing": true,
    "mathematical_computation": true
  },
  "priority": {
    "complex_reasoning": 1,
    "creative_writing": 1,
    "code_generation": 2,
    "mathematical_computation": 2,
    "structured_analysis": 2,
    "vision_processing": 3
  },
  "cost_per_1k_tokens": 0.015,
  "speed_rating": 6,
  "quality_rating": 10
},
"command-r-plus": {
  "type": "cohere",
  "config": {
    "apiKey": "COHERE_API_KEY",
    "model": "command-r-plus",
    "temperature": 0.7
  },
  "capabilities": {
    "vision": false,
    "reasoning": true,
    "tool_calling": true,
    "structured_output": true,
    "agents": false,
    "chinese": false,
    "search": false,
    "web_search": false,
    "code_generation": true,
    "creative_writing": false,
    "mathematical_computation": true
  },
  "priority": {
    "complex_reasoning": 3,
    "code_generation": 3,
    "mathematical_computation": 3,
    "structured_analysis": 3
  },
  "cost_per_1k_tokens": 0.003,
  "speed_rating": 8,
  "quality_rating": 7
}
```

Also add `anthropic` and `cohere` to `routing_rules` and `keywords` if desired (optional — not required for basic provider support).

### Step 1.3: Create chat model factory

**Action**: NEW file `utils/chatModelFactory.ts`

```typescript
// utils/chatModelFactory.ts
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatCohere } from '@langchain/cohere';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Creates the appropriate LangChain chat model instance based on provider type.
 * Replaces the monolithic createChatOpenAIInstance() in /api/chat/route.ts.
 *
 * @param type - Provider type from models-config.json (e.g. 'anthropic', 'cohere', 'openai_compatible')
 * @param apiKey - Resolved API key value (from process.env)
 * @param model - Model name to pass to the provider
 * @param baseURL - Optional base URL (for OpenAI-compatible providers)
 * @param temperature - Model temperature (default 0.7)
 */
export function createChatModelInstance(
  type: string,
  apiKey: string,
  model: string,
  baseURL?: string,
  temperature: number = 0.7,
): BaseChatModel {
  switch (type) {
    case 'anthropic':
      return new ChatAnthropic({
        apiKey,
        modelName: model,
        temperature,
        ...(baseURL ? { clientOptions: { baseURL } } : {}),
      });

    case 'cohere':
      return new ChatCohere({
        apiKey,
        model,
        temperature,
      });

    // All OpenAI-compatible types (existing behavior preserved)
    case 'openai_compatible':
    case 'o3_provider':
    case 'deepseek':
    case 'google_gemini':
    case 'alibaba_tongyi':
    case 'tencent_hunyuan':
    default:
      return new ChatOpenAI({
        modelName: model,
        apiKey,
        temperature,
        ...(baseURL ? { configuration: { baseURL } } : {}),
      });
  }
}
```

### Step 1.4: Modify chains to accept optional LLM

**Files**: `src/chains/basic-chain.ts`, `src/chains/vision-chain.ts`, `src/chains/rag-chain.ts`

Pattern: add optional `llm?: BaseChatModel` parameter. If provided, use it. If not, fall back to existing `createChatOpenAIConfig()` behavior (backward compatible).

**basic-chain.ts** (same pattern for all three):

```typescript
// src/chains/basic-chain.ts
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { createChatOpenAIConfig } from "@/utils/openaiProvider";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export function createBasicChain(llm?: BaseChatModel) {
  const prompt = ChatPromptTemplate.fromTemplate(`
你是一个智能AI助手。

当前模式：基础对话模式
- 提供简洁、直接、友好的回答
- 使用自然、易懂的语言  
- 避免过于技术性的内容
- 保持对话的轻松氛围

用户请求：{input}
`);

  const model = llm ?? new ChatOpenAI({
    modelName: process.env.BASIC_MODEL_NAME || "gpt-5-mini",
    temperature: 0.0,
    maxTokens: 800,
    apiKey: createChatOpenAIConfig().apiKey,
    ...(createChatOpenAIConfig().configuration ? { configuration: createChatOpenAIConfig().configuration } : {}),
  });

  return RunnableSequence.from([prompt, model]);
}
```

**vision-chain.ts**:

```typescript
// src/chains/vision-chain.ts
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { createChatOpenAIConfig } from "@/utils/openaiProvider";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export function createVisionChain(llm?: BaseChatModel) {
  const prompt = ChatPromptTemplate.fromTemplate(`
你是一个专业的AI绘画助手。

当前模式：视觉生成模式
- 根据用户的文字描述生成高质量的图片。
- 理解并执行复杂的场景、物体和风格要求。
- 输出的应该是一张图片，而不是文字描述。

用户请求：{input}
`);

  const model = llm ?? new ChatOpenAI({
    modelName: process.env.VISION_MODEL_NAME || "gpt-5-all",
    temperature: 0.8,
    maxTokens: 1024,
    apiKey: createChatOpenAIConfig().apiKey,
    ...(createChatOpenAIConfig().configuration ? { configuration: createChatOpenAIConfig().configuration } : {}),
  });

  return RunnableSequence.from([prompt, model]);
}
```

**rag-chain.ts**:

```typescript
// src/chains/rag-chain.ts
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { createChatOpenAIConfig } from "@/utils/openaiProvider";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export function createRAGChain(llm?: BaseChatModel) {
  const prompt = ChatPromptTemplate.fromTemplate(`
你是一个智能AI助手。

当前模式：知识检索模式
- 基于提供的参考文档和知识库回答
- 确保信息的准确性和可靠性
- 明确引用相关文档内容
- 如果文档不足，明确说明信息来源
- 优先使用已验证的知识

参考文档：
{context_documents}

用户请求：{input}
`);

  const model = llm ?? new ChatOpenAI({
    modelName: process.env.RAG_MODEL_NAME || "gpt-5",
    temperature: -0.1,
    maxTokens: 1000,
    apiKey: createChatOpenAIConfig().apiKey,
    ...(createChatOpenAIConfig().configuration ? { configuration: createChatOpenAIConfig().configuration } : {}),
  });

  return RunnableSequence.from([prompt, model]);
}
```

### Step 1.5: Modify /api/chat/route.ts

**Actions**:
1. Import `createChatModelInstance` from `@/utils/chatModelFactory`
2. Add `type: 'anthropic'` and `type: 'cohere'` cases to API key resolution (lines 296-308)
3. Replace `createChatOpenAIInstance` with `createChatModelInstance`
4. Pass `llm` to chain functions

**Add import** (near other imports in `/api/chat/route.ts`):

```typescript
import { createChatModelInstance } from "@/utils/chatModelFactory";
```

**Add provider type cases** (after line 307 `google_gemini` case):

```typescript
} else if (modelDetails.type === "anthropic") {
  selectedApiKey = process.env.ANTHROPIC_API_KEY as string;
} else if (modelDetails.type === "cohere") {
  selectedApiKey = process.env.COHERE_API_KEY as string;
}
```

**Replace `createChatOpenAIInstance` call** (replace line 325):

```typescript
// BEFORE:
const llm = createChatOpenAIInstance(selectedApiKey || "", selectedModelName, selectedBaseURL);

// AFTER:
const llm = createChatModelInstance(
  modelDetails.type,
  selectedApiKey || "",
  selectedModelName,
  selectedBaseURL,
);
```

**Pass llm to chains** (replace switch statement lines 352-389):

```typescript
switch (route) {
  case "basic":
  case "agent":
  case "vision_tasks": {
    const chain = createVisionChain(llm);
    result = await chain.invoke({ input: safeMessageContent });
    break;
  }
  case "reasoning_tasks":
  case "chinese_tasks":
  case "code_tasks":
  case "creative_tasks":
  case "structured_output": {
    const chain = createBasicChain(llm);
    result = await chain.invoke({ input: safeMessageContent });
    break;
  }
  case "enhanced_tasks": {
    result = { content: `您已进入增强模式。您的输入是: ${safeMessageContent}` };
    break;
  }
  case "rag":
  case "search_tasks": {
    const chain = createRAGChain(llm);
    result = await chain.invoke({ input: safeMessageContent, context_documents: [] });
    break;
  }
  default: {
    const chain = createBasicChain(llm);
    result = await chain.invoke({ input: safeMessageContent });
    break;
  }
}
```

### Step 1.6: Update model lists in openai-compat.ts

Add to `MODEL_DISPLAY_NAME`:

```typescript
'claude-sonnet-4-native': 'Claude Sonnet 4 (Native)',
'command-r-plus': 'Command R+',
```

Add to `MODEL_MAPPING`:

```typescript
'claude-sonnet-4-native': 'claude-sonnet-4-native',
'command-r-plus': 'command-r-plus',
```

Add to `getSupportedModels()` array (after existing models):

```typescript
{
  id: 'claude-sonnet-4-native',
  object: 'model',
  created: Math.floor(Date.now() / 1000),
  owned_by: 'anthropic',
  capabilities: {
    vision: true, reasoning: true, tool_calling: true, structured_output: true,
    agents: false, chinese: false, search: false, web_search: false,
    code_generation: true, creative_writing: true, mathematical_computation: true,
  },
  display_name: 'Claude Sonnet 4 (Native)',
  description: 'Direct Anthropic API access for Claude Sonnet 4. No proxy required.',
},
{
  id: 'command-r-plus',
  object: 'model',
  created: Math.floor(Date.now() / 1000),
  owned_by: 'cohere',
  capabilities: {
    vision: false, reasoning: true, tool_calling: true, structured_output: true,
    agents: false, chinese: false, search: false, web_search: false,
    code_generation: true, creative_writing: false, mathematical_computation: true,
  },
  display_name: 'Command R+',
  description: 'Direct Cohere API access for Command R+. Optimized for reasoning and code.',
},
```

### Step 1.7: Create test script

**Action**: NEW file `scripts/test-unified-router.js`

```javascript
// scripts/test-unified-router.js
// Verifies: new model config entries load correctly, provider dispatch works.
// Usage: node scripts/test-unified-router.js

const path = require('path');

async function main() {
  // Test 1: Config file loads
  const configPath = path.join(process.cwd(), 'models-config.json');
  const fs = require('fs');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  console.assert(config.models['claude-sonnet-4-native'], '❌ claude-sonnet-4-native not found in config');
  console.assert(config.models['claude-sonnet-4-native'].type === 'anthropic', '❌ Wrong type for claude-sonnet-4-native');
  console.assert(config.models['command-r-plus'], '❌ command-r-plus not found in config');
  console.assert(config.models['command-r-plus'].type === 'cohere', '❌ Wrong type for command-r-plus');

  // Test 2: Model type counts
  const types = {};
  for (const [id, model] of Object.entries(config.models)) {
    types[model.type] = (types[model.type] || 0) + 1;
  }
  console.log('Model types:', JSON.stringify(types, null, 2));
  console.assert(types.anthropic === 1, '❌ Expected 1 anthropic model');
  console.assert(types.cohere === 1, '❌ Expected 1 cohere model');

  console.log('✅ All config validation tests passed');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
```

### Step 1.8: Verification

```bash
# Install
yarn add @langchain/anthropic @langchain/cohere

# Type check
yarn tsc --noEmit

# Build
yarn build

# Config test
node scripts/test-unified-router.js

# Smoke test (requires ANTHROPIC_API_KEY or COHERE_API_KEY in .env.local)
# curl -X POST http://localhost:3000/api/v1/chat/completions \
#   -H "Content-Type: application/json" \
#   -d '{"model":"claude-sonnet-4-native","messages":[{"role":"user","content":"Hello"}]}'
```

---

## Task 2: Fix semantic.analyze

**Why**: INTEGRATION_SUMMARY reports 50ms routing time, but `semantic.analyze` returns hardcoded empty capabilities. The `keywords` section already exists in `models-config.json` with categorized keyword lists — use them for fast, offline semantic analysis.

**Dual-router caveat**: This fix only affects `/api/v1/chat/completions` (which uses `unified-router.ts`). `/api/chat` has its own routing via `SmartRouterComponent` and is NOT changed by this task. Full unification is Trinity Task 0 scope.

### Step 2.1: Implement keyword-based semantic analyzer

**File**: `utils/unified-router.ts`

Replace the `semantic` private property (lines 168-178):

```typescript
private semantic = {
  analyze: async (messages: any[]): Promise<IntentAnalysis> => {
    // Extract all text from messages
    const text = messages.map(m => {
      if (typeof m.content === 'string') return m.content.toLowerCase();
      if (Array.isArray(m.content)) {
        return m.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text || '')
          .join(' ')
          .toLowerCase();
      }
      return '';
    }).join(' ');

    // Use keywords from models-config.json
    const keywords = (this.modelsConfig as any)?.keywords || {};
    const detectedCapabilities: string[] = [];
    const intents: Array<{ intent: string; score: number }> = [];

    for (const [category, words] of Object.entries<string[]>(keywords)) {
      const matchCount = words.filter(w => text.includes(w.toLowerCase())).length;
      if (matchCount > 0) {
        detectedCapabilities.push(category);
        intents.push({ intent: category, score: Math.min(matchCount / words.length, 0.95) });
      }
    }

    // Chinese detection via Unicode range (supplements keywords.chinese)
    if (/[\u4e00-\u9fff]/.test(text)) {
      if (!detectedCapabilities.includes('chinese')) {
        detectedCapabilities.push('chinese');
        intents.push({ intent: 'chinese', score: 0.8 });
      }
    }

    const confidence = detectedCapabilities.length > 0
      ? intents.reduce((max, i) => Math.max(max, i.score), 0)
      : 0.3;

    return {
      type: 'semantic',
      confidence,
      detectedCapabilities,
      intents,
    };
  }
};
```

### Step 2.2: Fix analyzeCapabilities for object capabilities

**File**: `utils/unified-router.ts`

Replace `analyzeCapabilities` method (lines 91-96):

```typescript
analyzeCapabilities(capabilities: string[]): string[] {
  return this.getAvailableModels().filter(model => {
    const config = this.models.get(model);
    if (!config?.capabilities) return false;
    // capabilities is an object: { vision: true, reasoning: true, ... }
    // NOT an array. True capabilities are those with value === true.
    return capabilities.some(cap => config.capabilities[cap] === true);
  });
}
```

### Step 2.3: Verification

```bash
# Type check
yarn tsc --noEmit

# Test routing with different inputs (should return different models)
# curl -X POST http://localhost:3000/api/v1/chat/completions \
#   -H "Content-Type: application/json" \
#   -d '{"model":"auto","messages":[{"role":"user","content":"分析这张图片"}]}'
# Expected: selectedModel includes vision-capable model (e.g., qvq-plus or gpt-5-all)

# curl -X POST http://localhost:3000/api/v1/chat/completions \
#   -H "Content-Type: application/json" \
#   -d '{"model":"auto","messages":[{"role":"user","content":"Write a Python sorting function"}]}'
# Expected: selectedModel includes code-capable model (e.g., qwen-turbo or deepseek-reasoner)
```

---

## Task 3: Langfuse Trace Enhancement (serverless-safe)

**Why**: INTEGRATION_SUMMARY lists enhanced monitoring. Current Langfuse client is a single `sendEvent()` with no trace tree. Add structured tracing that survives serverless cold starts (fire-and-forget, no in-memory state accumulation).

### Step 3.1: Add LangfuseTracer to langfuseClient.ts

**File**: `utils/langfuseClient.ts`

Append after existing `sendEvent` function:

```typescript
// utils/langfuseClient.ts (append)

export interface TraceSpan {
  name: string;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Lightweight tracer for a single request.
 * Fire-and-forget: spans are flushed at request end via flush().
 * No in-memory state accumulation — safe for serverless.
 */
export class LangfuseTracer {
  private spans: TraceSpan[] = [];
  private requestId: string;

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  startSpan(name: string, metadata?: Record<string, unknown>): TraceSpan {
    const span: TraceSpan = {
      name,
      startTime: Date.now(),
      metadata: { ...(metadata || {}), requestId: this.requestId },
    };
    this.spans.push(span);
    return span;
  }

  endSpan(span: TraceSpan, metadata?: Record<string, unknown>): void {
    span.endTime = Date.now();
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }
  }

  /**
   * Send all spans to Langfuse. Non-blocking — errors are logged, not thrown.
   * Call at the end of each request handler.
   */
  async flush(): Promise<void> {
    const flushPromises = this.spans.map(span =>
      sendEvent({
        event: span.name,
        properties: {
          ...span.metadata,
          durationMs: span.endTime ? span.endTime - span.startTime : undefined,
        },
        timestamp: new Date(span.startTime).toISOString(),
      })
    );
    this.spans = [];
    await Promise.allSettled(flushPromises);
  }
}
```

### Step 3.2: Wire tracer into unified-router.ts

**File**: `utils/unified-router.ts`

Add to `route()` method — wrap the routing logic with trace spans:

```typescript
// In route() method, after the cache check:
async route(request: RoutingRequest): Promise<RoutingDecision> {
  // ... existing code ...

  const routeStart = Date.now();
  // (existing routing logic between lines 103-166 goes here)
  // ... 

  // After returning the decision:
  const duration = Date.now() - routeStart;
  if (typeof globalThis !== 'undefined') {
    // Fire-and-forget: don't await
    sendEvent({
      event: 'router.decision',
      properties: {
        selectedModel: selected || 'unknown',
        strategy,
        confidence: intent.confidence || 0.5,
        durationMs: duration,
        capabilityMatch,
      },
      timestamp: new Date().toISOString(),
    }).catch(() => {}); // silently ignore flush errors in hot path
  }

  return { /* ... */ };
}
```

Note: The tracer's `flush()` is NOT called from unified-router.ts because the v1 completions route is the outer handler that coordinates the full request lifecycle. The v1 completions route should call flush.

### Step 3.3: Wire tracer into v1 chat completions route

**File**: `app/api/v1/chat/completions/route.ts`

Add tracer around the routing decision and internal fetch:

```typescript
import { LangfuseTracer } from '@/utils/langfuseClient';

export async function POST(req: NextRequest) {
  return wrapWithErrorHandling("v1_chat_completions_POST", async () => {
    const requestId = crypto.randomUUID();
    const tracer = new LangfuseTracer(requestId);

    // ... existing auth, parsing ...

    const routeSpan = tracer.startSpan('router.decision', { model: body.model });
    const routingDecision = await routeRequest(routingRequest);
    tracer.endSpan(routeSpan, {
      selectedModel: routingDecision.selectedModel,
      confidence: routingDecision.confidence,
      strategy: routingDecision.metadata.routingStrategy,
    });

    // ... existing fetch ...

    const fetchSpan = tracer.startSpan('internal_api_call', { endpoint: targetEndpoint });
    const internalResponse = await fetch(internalRequest);
    tracer.endSpan(fetchSpan, {
      status: internalResponse.status,
      model: body.model,
    });

    // At end of handler (before returning response):
    tracer.flush().catch(err => console.warn('[Langfuse] flush error:', err));

    // ... return response ...
  });
}
```

### Step 3.4: Verification

```bash
yarn tsc --noEmit
yarn build

# Start and make a request (Langfuse events are fire-and-forget)
yarn dev
# In another terminal:
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'

# Check logs for Langfuse activity (no errors expected)
```

---

## Task 4: Offline Eval Script

**Why**: INTEGRATION_SUMMARY lists A/B testing. Runtime A/B testing on serverless is impractical (no persistent state for results). Replace with an offline eval script that compares routing strategies locally or in CI.

### Step 4.1: Create eval script

**Action**: NEW file `scripts/eval-routing.js`

```javascript
// scripts/eval-routing.js
// Offline routing evaluation. Compares keyword-based routing vs first-model vs random.
// Usage: node scripts/eval-routing.js [--runs N]
// Output: scripts/eval-results.json

const fs = require('fs');
const path = require('path');

// Load models-config.json
const configPath = path.join(process.cwd(), 'models-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const keywords = config.keywords || {};
const models = Object.keys(config.models);

// Test queries covering all task types
const testQueries = [
  { content: '请分析这张图片的内容', expected: 'vision' },
  { content: 'Analyze this photo and describe what you see', expected: 'vision' },
  { content: '证明勾股定理的详细步骤', expected: 'reasoning' },
  { content: 'Explain why the sky is blue using physics', expected: 'reasoning' },
  { content: '写一首关于春天的诗', expected: 'chinese' },
  { content: '用中文解释量子计算的基本原理', expected: 'chinese' },
  { content: 'Write a Python function to implement quicksort', expected: 'code' },
  { content: '调试这段代码：function add(a,b) { return a-b }', expected: 'code' },
  { content: '写一个关于AI觉醒的短篇故事', expected: 'creative' },
  { content: 'Write a poem about the ocean', expected: 'creative' },
  { content: '搜索最新的AI新闻', expected: 'search' },
  { content: 'Search for the latest TypeScript features', expected: 'search' },
  { content: '用JSON格式输出用户信息', expected: 'structured' },
  { content: '提取这段文本中的关键信息并以表格形式呈现', expected: 'structured' },
  { content: 'Hello, how are you today?', expected: 'default' },
  { content: '计算 234 * 567 的结果', expected: 'math' },
];

// Strategy 1: Keyword-based (matches Task 2 semantic.analyze logic)
function keywordStrategy(content) {
  const text = content.toLowerCase();
  const intents = [];

  for (const [category, words] of Object.entries(keywords)) {
    const matchCount = words.filter(w => text.includes(w.toLowerCase())).length;
    if (matchCount > 0) {
      intents.push({ category, score: matchCount / words.length });
    }
  }

  intents.sort((a, b) => b.score - a.score);
  return intents.length > 0 ? intents[0].category : 'default';
}

// Strategy 2: First model in config (current unified-router fallback behavior)
function firstModelStrategy() {
  return models[0] || 'gemini-flash-lite';
}

// Strategy 3: Random model
function randomStrategy() {
  return models[Math.floor(Math.random() * models.length)];
}

// Map keyword category to routing rule
const categoryToRule = {
  vision: 'vision_tasks',
  reasoning: 'reasoning_tasks',
  chinese: 'chinese_tasks',
  code: 'code_tasks',
  creative: 'creative_tasks',
  search: 'search_tasks',
  structured: 'structured_output',
  math: 'reasoning_tasks',
  default: 'basic',
};

// Run evaluation
const runs = parseInt(process.argv[3] || '1', 10);
const results = [];

for (const query of testQueries) {
  const detected = keywordStrategy(query.content);
  const rule = categoryToRule[detected] || 'basic';
  const preferred = config.routing_rules?.[rule]?.preferred_models || [];

  for (let i = 0; i < runs; i++) {
    results.push({
      query: query.content.substring(0, 60),
      expectedCategory: query.expected,
      detectedCategory: detected,
      match: detected === query.expected,
      routingRule: rule,
      preferredModels: preferred,
      firstModel: firstModelStrategy(),
      randomModel: randomStrategy(),
    });
  }
}

// Summary
const total = results.length;
const correct = results.filter(r => r.match).length;
const accuracy = total > 0 ? (correct / total * 100).toFixed(1) : 0;

// Category-level accuracy
const byCategory = {};
for (const r of results) {
  const cat = r.expectedCategory;
  byCategory[cat] = byCategory[cat] || { total: 0, correct: 0 };
  byCategory[cat].total++;
  if (r.match) byCategory[cat].correct++;
}

const categoryAccuracy = {};
for (const [cat, stats] of Object.entries(byCategory)) {
  categoryAccuracy[cat] = {
    accuracy: (stats.correct / stats.total * 100).toFixed(1) + '%',
    samples: stats.total,
  };
}

// Model distribution for each strategy
function countModels(key) {
  const dist = {};
  for (const r of results) {
    const model = typeof r[key] === 'string' ? r[key] : (r[key][0] || 'unknown');
    dist[model] = (dist[model] || 0) + 1;
  }
  return dist;
}

const report = {
  evaluatedAt: new Date().toISOString(),
  totalQueries: total,
  runsPerQuery: runs,
  accuracy: accuracy + '%',
  byCategory: categoryAccuracy,
  modelDistribution: {
    keywordPreferred: countModels('preferredModels'),
    firstModel: countModels('firstModel'),
    random: countModels('randomModel'),
  },
  results: results.slice(0, 20), // first 20 for readability
};

const outputPath = path.join(process.cwd(), 'scripts', 'eval-results.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`✅ Eval complete: ${correct}/${total} correct (${accuracy}%)`);
console.log(`📊 Report saved to: ${outputPath}`);
console.log('Category accuracy:', JSON.stringify(categoryAccuracy, null, 2));
```

### Step 4.2: Verification

```bash
# Run eval
node scripts/eval-routing.js

# Expected output:
# ✅ Eval complete: X/16 correct (XX%)
# 📊 Report saved to: scripts/eval-results.json

# Check report
node -e "console.log(JSON.stringify(require('./scripts/eval-results.json'), null, 2))"
```

---

## Risk & Rollback

| Risk | Mitigation |
|---|---|
| `@langchain/anthropic` API mismatch with installed `@langchain/core` version | Pin compatible version. Test `yarn install` before proceeding. |
| Chains with `llm` parameter break existing callers | Backward compatible — `llm` is optional. All existing callers (`createBasicChain()` without args) continue to work. |
| `ChatAnthropic` constructor options differ from documentation | Read `@langchain/anthropic` README for exact `ChatAnthropicFields` interface. Adjust `chatModelFactory.ts` if needed. |
| Keyword analysis accuracy drops below hardcoded baseline | Current hardcoded returns empty — ANY keyword analysis is better. Start with existing keywords, iterate. |
| Langfuse flush fails silently | `Promise.allSettled` + `.catch()` wrapper prevents unhandled rejections. Failed traces are lost but don't break the request. |
| `fs.writeFileSync` in admin routes (pre-existing) | Not introduced by this plan. Admin endpoints (POST/PUT/DELETE) won't work on Vercel regardless. Separate fix needed. |
| Vercel cold start clears `intentCache` | Already the case. No regression. Cache is best-effort only. |

## Task Dependency Graph

```
Pre-condition (duplicate case fix)
     │
     ├──→ Task 1 (Anthropic + Cohere providers)
     │       │
     │       └──→ Task 3 (Langfuse traces) [parallel with Task 2]
     │
     └──→ Task 2 (semantic.analyze fix)
             │
             └──→ Task 4 (offline eval) [needs fixed semantic.analyze for accurate comparison]
```

Tasks 1+3 and 2+4 can run in parallel as two independent tracks.

## Estimated Effort

| Task | Est. Time | Key Risk |
|---|---|---|
| Pre-condition: fix duplicate case | 5 min | None |
| Task 1: Add providers + chains | 2–3 hours | `ChatAnthropic`/`ChatCohere` API surface |
| Task 2: Fix semantic.analyze | 1–2 hours | None (string matching) |
| Task 3: Langfuse traces | 1–2 hours | None (fire-and-forget) |
| Task 4: Offline eval | 1 hour | None (offline script) |
| **Total** | **5–8 hours** | |
