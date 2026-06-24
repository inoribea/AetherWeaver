# Task 1.2: Thinker / Worker / Verifier Cycle

**Goal**: Implement multi-turn orchestration using LangGraph. A single API request can call 2–4 models in sequence with role-specific prompts.

---

## Files

- `utils/orchestration/graph.ts` (new) — LangGraph StateGraph definition
- `utils/orchestration/roles.ts` (new) — role prompt templates (Thinker, Worker, Verifier)
- `utils/orchestration/executor.ts` (new) — calls provider APIs, handles streaming
- `utils/orchestration/context.ts` (new) — JIT context builder per role (GAM-inspired)
- `app/api/chat/route.ts` (modify) — when `model: "auto"` and complexity > threshold, use orchestration path

---

## StateGraph Schema

```typescript
interface OrchestrationState {
  messages: ChatMessage[];          // full conversation
  plan: string | null;              // Thinker output
  workerResponse: string | null;    // Worker output
  verifierVerdict: 'accept' | 'retry' | 'escalate' | null;
  turnCount: number;
  maxTurns: number;                 // configurable, default 4
  startTime: number;                // Date.now() at request start — for timeout degradation
  timeoutMs: number;                // Vercel Pro: 55000 (5s buffer below 60s limit)
  selectedModels: string[];         // history of model choices
  finalAnswer: string | null;
}
```

---

## Timeout Degradation Logic

Checked at every node entry:

```
IF Date.now() - state.startTime > state.timeoutMs * 0.6 AND state.turnCount >= 2:
  → Skip Verifier, return workerResponse as finalAnswer
  → Log: "timeout_degradation" to Langfuse
```

This prevents Vercel 60s Function Invocation timeout. Worst case: Thinker (25s) + Worker (25s) = 50s, skip Verifier, return Worker output. Always return SOMETHING rather than timeout error.

---

## Node Definitions

```
thinker → worker → verifier
  │         │         │
  │         │         ├── accept → END (return workerResponse)
  │         │         ├── retry  → worker (maxTurns check)
  │         │         └── escalate → worker with stronger model
  │         │
  │         └── on error → fallbackChain
  │
  └── decompose problem, select worker model
```

---

## Role Prompts

From Trinity Section 3.2 (Xu et al., ICLR 2026, [arXiv:2512.04695](https://arxiv.org/abs/2512.04695)):

- **Thinker**: "Analyze the following problem. Identify the key challenges, required knowledge domains, and propose a step-by-step solution strategy. Do NOT solve the problem — only plan the approach."
- **Worker**: "Execute the following task according to the plan provided. Produce a complete, correct solution. Include your reasoning."
- **Verifier**: "Review the following solution. Check for: (1) correctness, (2) completeness — are all requirements met?, (3) edge cases. Reply with ACCEPT, RETRY (with specific feedback), or ESCALATE (need stronger model)."

---

## Context Builder

`utils/orchestration/context.ts` — GAM + LightMem inspired. Instead of passing the full conversation transcript to every turn, build role-optimized contexts:

```
Full conversation history (page-store equivalent: in-memory, current session)
     │
     ▼
Sensory Filter (LightMem-inspired)
  └── Drop turns irrelevant to current task (greetings, tangents, resolved sub-questions)
     │
     ▼
Topic Grouper (LightMem-inspired)
  └── Cluster remaining turns by semantic topic → attach topic labels
     │
     ▼
Role-Specific Context Builder (GAM JIT principle)
  ├── Thinker context  = problem statement + topic summary + key constraints
  ├── Worker context   = Thinker's plan + original problem + relevant evidence turns
  └── Verifier context = Worker's output + original requirements + edge case checklist
```

**Interface**:

```typescript
interface ContextBuilder {
  buildThinkerContext(session: Session): PromptContext;
  buildWorkerContext(session: Session, plan: string): PromptContext;
  buildVerifierContext(session: Session, workerOutput: string): PromptContext;
}
interface PromptContext {
  systemPrompt: string;
  messages: ChatMessage[];     // filtered + role-optimized subset
  topicLabel: string;          // LightMem-style topic tag
  turnsIncluded: number;       // for cost tracking
  turnsFiltered: number;       // for efficiency monitoring
}
```

---

## Why the Context Builder Matters

Multi-turn orchestration grows context linearly with turns. Without filtering, a 4-turn cycle passes ~4x the tokens of a single call. GAM's JIT principle + LightMem's three-stage model reduce this to ~1.5-2x by eliminating irrelevant turns and giving each role only what it needs.

---

## Design Tradeoff Notes

**Lossy filtering vs GAM's lossless principle**: GAM argues that "lossless memory can only be realized via searching over complete history" and proves compressed-memory-only systems lose 26 F1 points (27.50 vs 53.18). Our sensory filter drops turns, which contradicts this principle. **Justification**: orchestration cycles are short (≤4 turns). LightMem's efficiency gains (38x token reduction) outweigh GAM's lossless principle at this scale. If future orchestration depths grow beyond 4 turns, revisit with GAM's full page-store + Researcher approach. For now, we accept the lossy tradeoff explicitly.

**GAM dual-agent simplification**: GAM uses Memorizer (offline) + Researcher (online, with iterative Planning→Searching→Reflection loop). Our `context.ts` collapses both into a linear pipeline. For ≤4-turn cycles, the Researcher's iterative reflection is unnecessary overhead. If context windows grow to session-level (50+ turns), restoring the Researcher's reflection loop becomes warranted.

---

## Step-by-Step Implementation

1. Create `utils/orchestration/roles.ts`
   - Export `THINKER_PROMPT`, `WORKER_PROMPT`, `VERIFIER_PROMPT` constants
   - Each prompt is a template function accepting context variables
   - Add unit tests: each prompt renders without syntax errors

2. Create `utils/orchestration/context.ts`
   - Implement `ContextBuilder` class
   - `sensoryFilter`: drop turns with low semantic similarity to current task (cosine threshold 0.3)
   - `topicGrouper`: simple greedy clustering by embedding similarity
   - `buildThinkerContext`, `buildWorkerContext`, `buildVerifierContext`
   - Return `turnsIncluded` and `turnsFiltered` for monitoring

3. Create `utils/orchestration/executor.ts`
   - `executeRole(role, context, modelId): Promise<{text, tokens, latencyMs}>`
   - Handles provider API calls (OpenAI, Anthropic, Google, etc.)
   - Streaming support: accumulate chunks, return full text
   - Error handling: retry once, then throw to graph for fallback

4. Create `utils/orchestration/graph.ts`
   - Define `StateGraph<OrchestrationState>`
   - Nodes: `thinkerNode`, `workerNode`, `verifierNode`, `finalResponseNode`
   - Edges: conditional based on `verifierVerdict` and `turnCount`
   - Entry point: check complexity threshold (skip orchestration for simple queries)
   - Inject Langfuse spans (Task 1.4)

5. Modify `app/api/chat/route.ts`
   - When `model === "auto"` AND `complexity > threshold`, call orchestration graph
   - Otherwise, keep existing single-model path
   - Ensure response format matches OpenAI-compatible schema
   - Add `export const runtime = 'nodejs'` (required for Langfuse SDK)

6. Add integration tests
   - Mock executor responses; assert graph transitions correctly
   - Test timeout degradation: simulate elapsed > 33s, verify Verifier skipped
   - Test maxTurns enforcement: verifier retries until budget exhausted

7. Verify LSP diagnostics clean

---

## Success Criteria

- [ ] Single request triggers 2+ model calls when complexity warrants it
- [ ] Verifier correctly identifies wrong answers: on 10 known-wrong math answers, RETRY/ESCALATE rate ≥ 80%
- [ ] Verifier false-positive rate: on 10 known-correct answers, ACCEPT rate ≥ 80%
- [ ] Turn budget enforced — never exceeds `maxTurns`
- [ ] Timeout degradation triggers correctly: when elapsed > 33s and turnCount ≥ 2, Verifier skipped
- [ ] Streaming: final answer streams to client; intermediate Thinker/Verifier calls are hidden
- [ ] LSP diagnostics clean
- [ ] Smoke test: `POST /api/v1/chat/completions {"model":"auto","messages":[{"role":"user","content":"write a Python function to reverse a linked list"}]}` returns valid response within 60s
