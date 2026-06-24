# Task 1.4: Langfuse Proper Integration

**Goal**: Replace `sendEvent` with Langfuse SDK trace tree + score API.

---

## Files

- `utils/langfuse/client.ts` (rewrite) — Langfuse SDK initialization (`langfuse` npm package, ^3.x)
- `utils/langfuse/tracer.ts` (new) — trace/span/generation helpers
- `utils/orchestration/graph.ts` (modify) — wrap each node in Langfuse span
- `app/api/chat/route.ts` (modify) — create root trace per request; add `export const runtime = 'nodejs'` (Langfuse SDK uses Node.js APIs, incompatible with Edge Runtime)

---

## Trace Tree Structure

```
Request (trace)
├── Coordinator Decision (span)
│   ├── embedding_gen (generation)
│   └── classifier_predict (span)
├── Thinker (generation) — model, tokens, latency
├── Worker (generation) — model, tokens, latency
├── Verifier (generation) — model, tokens, verdict
└── Final Response (span)
```

---

## Score API

Embedded in response metadata:

```typescript
// Response includes:
{ "x-aetherweaver-trace-id": "trace_abc123" }

// User / client calls:
POST /api/feedback
{ "traceId": "trace_abc123", "rating": 1 | 0, "correction?": "optional correct answer" }
```

---

## Note: Current State

The codebase currently has a basic `LangfuseTracer` that does fire-and-forget `sendEvent` POSTs. This task upgrades to the full Langfuse SDK with proper trace trees, spans, and the score API.

---

## Step-by-Step Implementation

1. Install Langfuse SDK
   - `yarn add langfuse@^3.x`
   - Verify package version in `package.json`

2. Rewrite `utils/langfuse/client.ts`
   - Replace `sendEvent` with `Langfuse` SDK instance
   - Initialize with `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASEURL`
   - Export singleton `langfuse` client
   - Handle initialization failure gracefully (log warning, disable tracing)

3. Create `utils/langfuse/tracer.ts`
   - `createTrace(requestId, metadata): Trace`
   - `createSpan(trace, name, metadata): Span`
   - `createGeneration(span, model, input, output, tokens, latencyMs): Generation`
   - `scoreTrace(traceId, name, value, comment?): void`
   - Flush on process exit / request end

4. Modify `utils/orchestration/graph.ts`
   - Wrap each node (thinker, worker, verifier) in Langfuse span
   - Log model, tokens, latency per generation
   - Log coordinator decision reasoning as span metadata
   - Log timeout degradation events

5. Modify `app/api/chat/route.ts`
   - Create root trace at request start
   - Add `x-aetherweaver-trace-id` header to response
   - Add `export const runtime = 'nodejs'` (Langfuse SDK requires Node.js APIs)
   - Ensure trace is flushed before response completes

6. Create `app/api/feedback/route.ts` (new)
   - POST handler accepts `{traceId, rating, correction?}`
   - Calls `langfuse.score()` with the rating
   - Stores feedback in feedback DB (Task 2.1)
   - Returns 200 on success, 404 if traceId not found

7. Add integration tests
   - Mock Langfuse SDK; verify trace tree structure matches expected hierarchy
   - Verify `x-aetherweaver-trace-id` header present in response
   - Verify feedback endpoint writes score to Langfuse

8. Verify LSP diagnostics clean

---

## Success Criteria

- [ ] Langfuse dashboard shows full trace tree with per-node latency/tokens
- [ ] `POST /api/feedback` accepts and stores ratings
- [ ] No breaking changes to existing API response format
