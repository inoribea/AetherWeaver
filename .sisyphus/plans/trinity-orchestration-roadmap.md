# AetherWeaver → Trinity Orchestration: Execution Plan

**Purpose**: AI-agent–executable implementation plan. Not a whitepaper. Concrete tasks with file paths, type signatures, and success criteria.
**Target**: 12–18 weeks to 85–92% Fugu-quality on developer tasks (code / math / structured extraction).
**Budget**: $300–700.
**Language**: strict EN — code, comments, logs, commits.

---

## Current State (what exists, what it actually does)

| File | Reality |
|---|---|
| `utils/unified-router.ts` | `semantic.analyze` returns `{confidence: 0.5, detectedCapabilities: []}`. Route picks first model from config. |
| `utils/openai-compat.ts` | `selectBestModelForAuto` = hardcoded `if/else` (image → gpt-5-all, search → Qwen3, reasoning → deepseek-reasoner, chinese → hunyuan, default → gemini-flash-lite). |
| `models-config.json` | 13 models, 7 providers, static capability/priority tags. Speed-optimized selection strategy. |
| `utils/langfuseClient.ts` | Single `sendEvent` POST. No trace tree, no score API. |
| `app/langgraph/agent/agent.ts` | Toy pirate demo. LangGraph installed (`@langchain/langgraph ^0.3.6`) but unused for real orchestration. |
| `app/api/chat/route.ts` | Single model pick → single internal API call → response. No multi-turn, no verifier, no feedback. |
| Eval harness | **Does not exist.** |
| Feedback collection | **Does not exist.** |

## Target Architecture

```
User Request
     │
     ▼
┌─────────────────────────────────┐
│  Coordinator (ONNX Qwen3-0.6B)  │  ← hidden states → 10K-head → routing logits
│  or Embedding-based fallback    │
└──────────────┬──────────────────┘
               │ model_id, role, turn_count
               ▼
┌──────────────────────────────────────────────┐
│  LangGraph StateGraph (orchestration engine)  │
│                                              │
│  Thinker ──→ Worker ──→ Verifier              │
│    │           │          │                   │
│    │ decompose  │ execute  │ accept / retry    │
│    ▼           ▼          ▼                   │
│  [cheap/fast  [strongest  [different model    │
│   model]      model]      for independence]   │
│                                              │
│  Stop: Verifier accepts OR turn budget exhausted │
└──────────────┬───────────────────────────────┘
               │ final answer
               ▼
         API Response + Langfuse trace
               │
               ▼
┌──────────────────────┐
│  Feedback Collector   │  ← explicit 👍/👎 + implicit signals
│  (SQLite / Turso)    │     + auto-verification for code/math
└──────────┬───────────┘
           │ weekly batch
           ▼
┌──────────────────────┐
│  Retraining Pipeline  │  ← sep-CMA-ES on (embedding, model_id, reward) tuples
│  (coordinator weights │     outputs coordinator-weights-v{N}.json
│   < 100KB JSON file)  │
└──────────────────────┘
```

---

## Task 0 — Route Entry Unification (1 week)

**Goal**: Resolve the dual-router problem before any coordinator work begins.

**Problem**: AetherWeaver has two independent routing paths:
- `utils/unified-router.ts` + `IntelligentRouterUnified` — the stub the plan targets
- `app/components/routing/smart-router.ts` + `SmartRouterComponent` — the ACTUAL path used by `app/api/chat/route.ts` via `createBasicChain`/`createRAGChain`/`createVisionChain`

These chains internally create their own `ChatOpenAI` instances, bypassing `unified-router.ts` entirely. All Phase 1 coordinator changes will have zero effect on production requests unless this is unified.

**Files**:
- `app/api/chat/route.ts` (modify) — replace `SmartRouterComponent` with `IntelligentRouterUnified`
- `src/chains/basic-chain.ts` (modify) — accept externally injected model/apiKey/baseURL params; remove internal `ChatOpenAI` instantiation
- `src/chains/vision-chain.ts` (modify) — same as basic-chain
- `src/chains/rag-chain.ts` (modify) — same as basic-chain
- `app/components/routing/smart-router.ts` (deprecate) — add `@deprecated` JSDoc, keep as fallback
- `src/components/routing/smart-router.ts` (deprecate) — same treatment; yes, there are two copies

**Pre-condition**: Fix existing bug before Task 0 changes begin.
```
app/api/chat/route.ts: remove duplicate `case "vision_tasks":` (appears twice, TypeScript error)
Verify: `yarn tsc --noEmit` passes before any changes
```

**Decision**: `IntelligentRouterUnified` becomes the single routing entry point. Chains accept model config as parameters rather than internally instantiating `ChatOpenAI` —

**Success criteria**:
- [ ] Pre-condition: `yarn tsc --noEmit` passes (duplicate case bug fixed)
- [ ] `app/api/chat/route.ts` calls `intelligentRouter.route()` (verifiable via grep)
- [ ] Chains (`basic-chain.ts`, `vision-chain.ts`, `rag-chain.ts`) accept external model config — no internal `ChatOpenAI` instantiation
- [ ] Both `smart-router.ts` copies marked `@deprecated`
- [ ] All existing tests pass with unified router (`yarn test`)
- [ ] Manual smoke test: `model: "auto"` → response from a real model (not error)
- [ ] LSP diagnostics clean

---

## Phase 1 — Foundation (4–6 weeks)

### Task 1.1: Coordinator Signal — Embedding-based Router

**Goal**: Replace `semantic.analyze` stub with a real classifier that outputs `{model_id, confidence, depth}`.

**Sequencing note**: Task 1.1 and Task 1.3 have a bootstrap dependency. Break as follows:
```
Task 1.3a: Run eval with keyword router + random + frontier + expert baselines (NO coordinator yet)
    ↓ (produces eval-results-v0.json)
    ↓ Label generation: for each problem, label = model_id of strategy with highest accuracy
    ↓   Tie-breaking: prefer cheaper model (cost-weighted accuracy)
    ↓ (produces scripts/eval/training-labels-v0.jsonl)
Task 1.1: Train v1 coordinator on labels from 1.3a
    ↓   Training data source: scripts/eval/training-labels-v0.jsonl (NOT feedback DB — that's Phase 2)
    ↓ (produces coordinator-weights-v1.json)
Task 1.3b: Re-run eval with all 6 strategies, now including embedding_coordinator
    ↓ (produces final eval-results.json)
```
**Label format** (`scripts/eval/training-labels-v0.jsonl`):
```json
{"embedding": [...], "model_id": "deepseek-reasoner", "task_type": "math", "problem_id": "MATH-42"}
```

**Files**:
- `utils/coordinator/embedder.ts` (new) — wraps `text-embedding-3-small` or local ONNX embedder
- `utils/coordinator/classifier.ts` (new) — logistic regression / 2-layer MLP, loads weights from JSON
- `utils/unified-router.ts` (modify) — wire `classifier.predict(embedding)` into `route()`

**Interface**:
```typescript
interface CoordinatorInput {
  messages: ChatMessage[];
  availableModels: string[];
}
interface CoordinatorOutput {
  selectedModel: string;
  confidence: number;        // 0–1
  recommendedDepth: 1 | 2 | 4;  // turns
  reasoning: string;          // for Langfuse trace
}
```

**Training data**: Generate 6000 labeled examples from synthetic benchmarks (see Task 1.3).

**Fidelity caveat**: Trinity's 86.2% LiveCodeBench was achieved with **hidden states from Qwen3-0.6B** — a dense representation capturing the model's internal reasoning over the full transcript. `text-embedding-3-small` encodes surface semantic similarity, not internal reasoning signal. Trinity proves hidden-state space is perfectly linearly separable for task classification (SVM 100%, chance=25%); no equivalent evidence exists for text-embedding-3-small. The embedding coordinator (Task 1.1) is therefore a **pragmatic approximation** for Vercel deployability. Full Trinity fidelity requires the sidecar (Task 3.2). Realistic quality ceiling: 70-80% of Trinity's routing accuracy without hidden states.

**Weights format** (`coordinator-weights-v1.json`):
```json
{
  "version": 1,
  "input_dim": 1536,
  "num_classes": 7,
  "weights": [[...], ...],
  "bias": [...],
  "class_labels": ["gpt-5-all", "claude-sonnet-4-all", "deepseek-reasoner", ...],
  "training_date": "2026-07-15",
  "training_examples": 6000,
  "accuracy": 0.78
}
```

**Success criteria**:
- `semantic.analyze` returns non-empty `detectedCapabilities`
- `route()` returns different models for different input types (not always first config entry)
- LSP diagnostics clean on `utils/coordinator/` and `utils/unified-router.ts`
- Weights file < 100KB

---

### Task 1.2: Thinker / Worker / Verifier Cycle

**Goal**: Implement multi-turn orchestration using LangGraph. A single API request can call 2–4 models in sequence with role-specific prompts.

**Files**:
- `utils/orchestration/graph.ts` (new) — LangGraph StateGraph definition
- `utils/orchestration/roles.ts` (new) — role prompt templates (Thinker, Worker, Verifier)
- `utils/orchestration/executor.ts` (new) — calls provider APIs, handles streaming
- `utils/orchestration/context.ts` (new) — JIT context builder per role (GAM-inspired)
- `app/api/chat/route.ts` (modify) — when `model: "auto"` and complexity > threshold, use orchestration path

**StateGraph schema**:
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

**Timeout degradation** (checked at every node entry):
```
IF Date.now() - state.startTime > state.timeoutMs * 0.6 AND state.turnCount >= 2:
  → Skip Verifier, return workerResponse as finalAnswer
  → Log: "timeout_degradation" to Langfuse
```
This prevents Vercel 60s Function Invocation timeout. Worst case: Thinker (25s) + Worker (25s) = 50s, skip Verifier, return Worker output. Always return SOMETHING rather than timeout error.

**Node definitions**:
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

**Role prompts** (from Trinity Section 3.2):

- **Thinker**: "Analyze the following problem. Identify the key challenges, required knowledge domains, and propose a step-by-step solution strategy. Do NOT solve the problem — only plan the approach."
- **Worker**: "Execute the following task according to the plan provided. Produce a complete, correct solution. Include your reasoning."
- **Verifier**: "Review the following solution. Check for: (1) correctness, (2) completeness — are all requirements met?, (3) edge cases. Reply with ACCEPT, RETRY (with specific feedback), or ESCALATE (need stronger model)."

**Context builder** (`utils/orchestration/context.ts`) — GAM + LightMem inspired. Instead of passing the full conversation transcript to every turn, build role-optimized contexts:

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

**Why this matters**: Multi-turn orchestration grows context linearly with turns. Without filtering, a 4-turn cycle passes ~4x the tokens of a single call. GAM's JIT principle + LightMem's three-stage model reduce this to ~1.5-2x by eliminating irrelevant turns and giving each role only what it needs.

**Design tradeoff — lossy filtering vs GAM's lossless principle**: GAM argues that "lossless memory can only be realized via searching over complete history" and proves compressed-memory-only systems lose 26 F1 points (27.50 vs 53.18). Our sensory filter drops turns, which contradicts this principle. **Justification**: orchestration cycles are short (≤4 turns). LightMem's efficiency gains (38x token reduction) outweigh GAM's lossless principle at this scale. If future orchestration depths grow beyond 4 turns, revisit with GAM's full page-store + Researcher approach. For now, we accept the lossy tradeoff explicitly.

**GAM dual-agent simplification**: GAM uses Memorizer (offline) + Researcher (online, with iterative Planning→Searching→Reflection loop). Our `context.ts` collapses both into a linear pipeline. For ≤4-turn cycles, the Researcher's iterative reflection is unnecessary overhead. If context windows grow to session-level (50+ turns), restoring the Researcher's reflection loop becomes warranted.

**Success criteria**:
- Single request triggers 2+ model calls when complexity warrants it
- Verifier correctly identifies wrong answers: on 10 known-wrong math answers, RETRY/ESCALATE rate ≥ 80%
- Verifier false-positive rate: on 10 known-correct answers, ACCEPT rate ≥ 80%
- Turn budget enforced — never exceeds `maxTurns`
- Timeout degradation triggers correctly: when elapsed > 33s and turnCount ≥ 2, Verifier skipped
- Streaming: final answer streams to client; intermediate Thinker/Verifier calls are hidden
- LSP diagnostics clean
- Smoke test: `POST /api/v1/chat/completions {"model":"auto","messages":[{"role":"user","content":"write a Python function to reverse a linked list"}]}` returns valid response within 60s

---

### Task 1.3: Eval Harness

**Goal**: Run 500+ benchmark problems through different routing strategies and measure accuracy.

**Files**:
- `scripts/eval/runner.ts` (new) — CLI entry point
- `scripts/eval/datasets/` (new) — dataset loaders
- `scripts/eval/metrics.ts` (new) — accuracy, cost, latency per strategy
- `package.json` (modify) — add `"eval": "tsx scripts/eval/runner.ts"`

**Datasets** (all publicly available, no API key needed for data):
| Dataset | Problems | Task Type | Verification |
|---|---|---|---|
| HumanEval | 164 | Python code | Execute + test cases |
| MBPP | 500 | Python code | Execute + test cases |
| MATH | 500 | Math reasoning | String match final answer |
| GSM8K | 200 | Math word problems | Numeric match |
| BigBench (subset) | 200 | Reasoning | Multiple choice match |
| Custom schema-val | 200 | Structured extraction | JSON Schema validation |

**Strategies compared per problem**:
1. Current keyword router (`selectBestModelForAuto`)
2. Random model selection
3. Always frontier model (gpt-5-all)
4. **Expert hand-tuned coordinator** — the best rule-based router an expert can design (fixed reference baseline, never changes across retrain cycles)
   - File: `scripts/eval/strategies/expert-router.ts`
   - Logic: rule-based, using task_type + content signals, NO ML
   - Implemented by AI agent based on domain knowledge prior to Task 1.3a
   - **Frozen after initial commit** — never modified across retrain cycles
   - Serves as SkillForge's "S_manual" equivalent: the fixed human-reference point
5. Embedding-based coordinator (Task 1.1)
6. Thinker → Worker → Verifier (Task 1.2 with static routing)

**Why the expert baseline matters** (SkillForge validation): SkillForge's key finding — "automated evolution CAN surpass manually curated expert knowledge" — requires a fixed human-designed reference point. Strategy 4 serves this role. Track across all retrain cycles: does the learned coordinator (strategy 5/6) surpass the expert baseline? Without this, there is no way to measure SkillForge's core claim.

**Output format** (`eval-results.json`):
```json
{
  "timestamp": "2026-07-20T10:00:00Z",
  "total_problems": 1764,
  "strategies": {
    "keyword_router": { "accuracy": 0.62, "avg_latency_ms": 3200, "avg_cost": 0.003 },
    "random": { "accuracy": 0.51, "avg_latency_ms": 3500, "avg_cost": 0.004 },
    "frontier": { "accuracy": 0.78, "avg_latency_ms": 4500, "avg_cost": 0.012 },
    "expert_baseline": { "accuracy": 0.70, "avg_latency_ms": 3400, "avg_cost": 0.005 },
    "embedding_coordinator": { "accuracy": 0.71, "avg_latency_ms": 3300, "avg_cost": 0.004 },
    "trinity_cycle": { "accuracy": 0.82, "avg_latency_ms": 12000, "avg_cost": 0.018 }
  }
}
```

**Success criteria**:
- `yarn eval` runs without errors, produces `eval-results.json`
- At least one strategy exceeds keyword router accuracy on code + math tasks
- Results reproducible (seed-based determinism or average over N runs)

---

### Task 1.4: Langfuse Proper Integration

**Goal**: Replace `sendEvent` with Langfuse SDK trace tree + score API.

**Files**:
- `utils/langfuse/client.ts` (rewrite) — Langfuse SDK initialization (`langfuse` npm package, ^3.x)
- `utils/langfuse/tracer.ts` (new) — trace/span/generation helpers
- `utils/orchestration/graph.ts` (modify) — wrap each node in Langfuse span
- `app/api/chat/route.ts` (modify) — create root trace per request; add `export const runtime = 'nodejs'` (Langfuse SDK uses Node.js APIs, incompatible with Edge Runtime)

**Trace tree structure**:
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

**Score API** (embedded in response metadata):
```typescript
// Response includes:
{ "x-aetherweaver-trace-id": "trace_abc123" }

// User / client calls:
POST /api/feedback
{ "traceId": "trace_abc123", "rating": 1 | 0, "correction?": "optional correct answer" }
```

**Success criteria**:
- Langfuse dashboard shows full trace tree with per-node latency/tokens
- `POST /api/feedback` accepts and stores ratings
- No breaking changes to existing API response format

---

## Phase 2 — Learning Loop (4–6 weeks)

### Task 2.1: Feedback Storage

**Goal**: Persistent storage for routing decisions + outcomes.

**Files**:
- `utils/feedback/store.ts` (new) — CRUD for feedback entries
- `utils/feedback/schema.ts` (new) — TypeScript types + DB migration
- `app/api/feedback/route.ts` (new) — POST handler

**Schema** (SQLite via Turso, Vercel-compatible):
```sql
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  request_embedding BLOB,        -- float32 array as binary
  selected_model TEXT NOT NULL,
  coordinator_confidence REAL,
  depth_used INTEGER,            -- 1, 2, or 4
  rating INTEGER,                -- 1 (good) or 0 (bad)
  correction TEXT,               -- user-provided correct answer
  task_type TEXT,                -- 'code' | 'math' | 'structured' | 'chat' | 'creative'
  auto_verified INTEGER,         -- 1 if system verified, 0 if human feedback

  -- SkillForge-style failure diagnosis fields (populated when rating=0)
  failure_category TEXT,         -- 'capability_mismatch' | 'role_error' | 'verifier_error' | 'thinker_error' | NULL
  diagnosis_detail TEXT,         -- LLM-generated diagnosis: which component failed and why
  targeted_fix TEXT,             -- LLM-generated fix suggestion for the specific deficient component

  -- Context management fields (LightMem + GAM inspired)
  session_topic TEXT,            -- topic label for this conversation (e.g., 'debug-python-async', 'math-calculus')
  context_turns_included INTEGER,-- how many conversation turns were included in this model call's prompt
  context_turns_filtered INTEGER,-- how many turns were filtered out by sensory filter

  latency_ms INTEGER,
  cost_estimate REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_feedback_model ON feedback(selected_model);
CREATE INDEX idx_feedback_rating ON feedback(rating);
CREATE INDEX idx_feedback_task ON feedback(task_type);
CREATE INDEX idx_feedback_failure ON feedback(failure_category) WHERE failure_category IS NOT NULL;
```

**Implicit signals** (collected automatically, not via user action):
- `regeneration`: user sent same/similar query again → previous answer was bad
- `model_switch`: user manually changed model mid-conversation → routing was wrong
- `copy_rate`: user copied response text → positive signal (requires client-side tracking)

**Success criteria**:
- Feedback entries stored and queryable
- Auto-verification works for code/math tasks (system writes feedback entry without user action)
- `rating` distribution logged (monitor for class imbalance)

---

### Task 2.1b: Failure Diagnosis (SkillForge-style)

**Goal**: When a response receives `rating=0`, automatically diagnose WHY the orchestration failed — not just THAT it failed. Modeled on SkillForge's Failure Analyzer → Skill Diagnostician → Skill Optimizer pipeline (Liu et al., SIGIR 2026).

**Files**:
- `utils/feedback/diagnosis.ts` (new) — LLM-powered failure analyzer + diagnostician
- `utils/feedback/store.ts` (modify) — write diagnosis fields on rating=0

**Diagnosis pipeline** (runs asynchronously after bad rating is recorded):
```
rating=0 recorded
  │
  ▼
Failure Analyzer (4 dimensions, parallel — uses gemini-flash-lite for speed/cost)
  ├── Capability Analyzer
  ├── Role Analyzer
  ├── Verifier Analyzer
  └── Decomposition Analyzer
  │ (each returns {score: 0-1, explanation: string})
  ▼
Aggregation: argmax(score) across 4 dimensions
  │ (if max_score < 0.5 → all ambiguous → skip diagnosis, log "unclassified")
  ▼
Skill Diagnostician: map failure to specific fix target
  ├── 'capability_mismatch' → model capability weights need retrain
  ├── 'role_error' → role prompt template needs revision
  ├── 'verifier_error' → verifier accept threshold needs adjustment
  └── 'thinker_error' → thinker prompt template needs revision
  │
  ▼
Write diagnosis_detail + targeted_fix + failure_category to feedback row
  │ (SLA: within 30s. On timeout → mark failure_category='diagnosis_timeout', skip)
```

**Failure Analyzer prompts** (4 dimensions, parallel):

**Capability Analyzer** (`utils/feedback/diagnosis.ts`):
```
Analyze whether the selected model had the right capabilities for this task.
Task: {task_summary}
Selected model: {model_id}
Model capabilities: {capability_tags}
Task requires: {detected_capabilities}

Score 0-1: how well did the model's capabilities match the task requirements?
1.0 = perfect match, model clearly has needed capabilities
0.0 = complete mismatch, model lacks critical capability (e.g., vision task sent to text-only model)

Output JSON: {"score": float, "explanation": "..."}
```

**Role Analyzer**:
```
Analyze whether the correct role was assigned at this orchestration turn.
Turn count: {turnCount} / {maxTurns}
Role assigned: {role} (Thinker/Worker/Verifier)
Previous turn outcome: {previousTurnSummary}

Was this the right role for this point in the orchestration cycle?
Score 0-1: 1.0 = correct role, 0.0 = wrong role (e.g., Thinker assigned when Worker should execute)

Output JSON: {"score": float, "explanation": "..."}
```

**Verifier Analyzer**:
```
Analyze whether the Verifier made the correct acceptance decision.
Verifier verdict: {verdict} (ACCEPT / RETRY / ESCALATE)
Worker output summary: {workerSummary}
Correctness check: was the Worker's output actually correct?
  - Code task: did tests pass? {testResult}
  - Math task: did answer match? {matchResult}
  - Other: user rating was 0 (bad)

Did the Verifier make the wrong call?
Score 0-1: 1.0 = Verifier was correct, 0.0 = Verifier made wrong decision
(e.g., Verifier ACCEPTed but answer was wrong → score=0. Verifier RETRY'd but answer was actually correct → score=0)

Output JSON: {"score": float, "explanation": "..."}
```

**Decomposition Analyzer**:
```
Analyze whether the Thinker correctly decomposed the problem.
Original problem: {problemSummary}
Thinker's plan: {planSummary}
Worker's approach: {workerApproach}

Did the Thinker's plan guide the Worker in the right direction, or did it mischaracterize the problem?
Score 0-1: 1.0 = Thinker's decomposition was helpful and accurate, 0.0 = Thinker sent Worker down wrong path

Output JSON: {"score": float, "explanation": "..."}
```

**Aggregation logic** (lowest score = most broken component):
```typescript
function aggregate(scores: DimensionScore[]): string | null {
  const min = scores.reduce((a, b) => a.score < b.score ? a : b);
  if (min.score > 0.5) return null;  // all components scored > 0.5 → no clear failure
  return min.category;  // 'capability_mismatch' | 'role_error' | 'verifier_error' | 'thinker_error'
}
```
**Note**: All four Analyzer prompts use consistent semantics: **high score = component working correctly, low score = component likely failed**. The aggregator picks the dimension with the LOWEST score (the most probable failure).

**Success criteria**:
- Every `rating=0` entry gets a non-null `failure_category` within 30 seconds
- Diagnosis distribution logged (monitor which components fail most)
- Distinct failure categories produce distinct fix types (verifiable in retrain pipeline)

---

### Task 2.2: Weekly Retraining Pipeline (Targeted Optimization)

**Goal**: Script that pulls feedback data, retrains coordinator classifier, ships updated weights.

**Files**:
- `scripts/train/retrain.ts` (new) — main training script with targeted optimization dispatcher
- `scripts/train/cmaes.ts` (new) — sep-CMA-ES implementation (port from Trinity paper, Appendix B)
- `scripts/train/data.ts` (new) — loads feedback from DB, groups by failure_category
- `scripts/train/export.ts` (new) — serializes weights to `coordinator-weights-v{N}.json`
- `scripts/train/prompt-optimizer.ts` (new) — LLM-based prompt refinement for role templates (SkillForge-style)
- `package.json` (modify) — add `"retrain": "tsx scripts/train/retrain.ts"`

**Training algorithm**: sep-CMA-ES (separable CMA-ES)
- Input: embedding vector (1536-d from text-embedding-3-small)
- Output: logits over 5–7 model classes
- Parameters: ~10K (1536 × 7 + 7 bias)
- Reward: binary (rating == 1 ? +1 : -1)
- Population size λ = 4 + 3·ln(D) where D = parameter dimension (1536×7 + 7 = 10759)
  → λ ≈ 33 (NOT 26 — ln(10759) ≈ 9.28, 4 + 3×9.28 ≈ 32)
- Stopping: max 200 generations or convergence (σ < 1e-6)

**Why sep-CMA-ES not logistic regression**: Trinity's key finding — in high-dim, low-budget regime, gradient-free outperforms gradient-based methods because per-parameter gradients from binary reward have low SNR. sep-CMA-ES samples full parameter vectors and evaluates holistically.

**Prompt-optimizer specification** (`scripts/train/prompt-optimizer.ts`):
```
System: You are a prompt optimization specialist. Given a set of diagnosis records
where the current prompt caused failures, produce an improved version.

Current prompt: {currentRolePrompt}
Failure diagnoses (last 7 days, up to 20 entries):
{diagnosis_list}

Requirements for the improved prompt:
1. Address the specific failures described in the diagnoses
2. Preserve the original role's purpose (Thinker plans, Worker executes, Verifier checks)
3. Keep similar length (±30% of original)
4. Output ONLY the new prompt text, no explanation
```

**Validation gating**: Before deploying a new prompt, run `scripts/eval/runner.ts --strategy=trinity_cycle --prompt-override=new` on a 50-problem subset. New prompt accuracy must >= old prompt accuracy. If degraded, discard candidate, log to Langfuse, keep old prompt. This prevents prompt drift across retrain cycles.

**Pipeline** (global retrain + targeted optimization):
```
yarn retrain
  ├── 1. Pull feedback entries from DB (last 7 days)
  ├── 2. Generate embeddings for all entries
  ├── 3. Filter: keep only entries with rating != null
  │
  ├── 4. GLOBAL RETRAIN (all rated entries)
  │   ├── Balance classes (undersample majority)
  │   ├── Run sep-CMA-ES (200 gens × 26 pop = 5200 evaluations)
  │   └── Evaluate on holdout set → candidate_weights
  │
  ├── 5. TARGETED OPTIMIZATION (per failure_category, SkillForge-style)
  │   ├── GROUP BY failure_category WHERE count >= 10
  │   ├── 'capability_mismatch' (most frequent):
  │   │   └── Retrain classifier weights on capability_mismatch subset only
  │   │       (higher weight on these samples → model learns to avoid this mistake)
  │   ├── 'role_error':
  │   │   └── Feed diagnosis_detail entries to LLM prompt-optimizer
  │   │       → produce candidate prompt
  │   │       → VALIDATE: run eval subset (50 problems) with new prompt
  │   │       → IF accuracy >= current prompt accuracy → deploy
  │   │       → ELSE discard, log "prompt_degraded"
  │   ├── 'verifier_error':
  │   │   └── Adjust verifier accept threshold (lower = stricter)
  │   │       Grid search over [0.5, 0.6, 0.7, 0.8, 0.9] on eval subset
  │   │       → pick threshold with best F1 on known-wrong + known-correct samples
  │   ├── 'thinker_error':
  │   │   └── Feed diagnosis_detail entries to LLM prompt-optimizer
  │   │       → produce candidate prompt
  │   │       → VALIDATE: same gating as role_error
  │   └── Export: role-prompts-v{N}.json, verifier-threshold-v{N}.json
  │       (only if validation passed)
  │
  ├── 6. Evaluate on holdout set
  ├── 7. If accuracy > current deployed → export coordinator-weights-v{N+1}.json
  └── 8. Log metrics + failure distribution to Langfuse
```

**Success criteria**:
- `yarn retrain` completes without errors
- Exported weights file is valid JSON, < 100KB
- New weights achieve higher eval accuracy than previous version (or pipeline correctly rejects)
- Targeted optimization produces distinct outputs per failure_category (role-prompts-v{N}.json differs from previous)
- Failure category distribution shifts over retrain cycles (each category % should decrease — system is learning)
- Prompt-optimizer validation gating works: degraded prompt candidates are correctly rejected
- Data-gating works: when count < 10 per failure_category, that category is skipped (no crash)
- [ ] `yarn test:verifier` passes: `tsx scripts/eval/test-verifier.ts --dataset scripts/eval/fixtures/wrong-answers.json` → RETRY/ESCALATE ≥ 8/10

---

### Task 2.3: A/B Bandit (Thompson Sampling)

**Goal**: Between retrains, use Thompson sampling to balance exploration/exploitation for model selection.

**Files**:
- `utils/coordinator/bandit.ts` (new) — Thompson sampling over model arms
- `utils/unified-router.ts` (modify) — inject bandit between retrains

**Algorithm**:
```typescript
// Per model arm: track (successes, failures)
// Beta distribution: Beta(α=successes+1, β=failures+1)
// On each request:
//   90%: sample from policy arms, pick argmax
//   10%: uniform random (exploration budget)
// Update counts when feedback arrives
```

**State**: stored in memory (Map) during server lifetime, persists to DB on write. On cold start, load from DB. **On coordinator weights version change** (`coordinator-weights-v{N}.json` version bump): reset all Bandit counts to zero. Old counts were collected under a different policy; keeping them biases the Bandit.

**Vercel serverless note**: Bandit state is per-instance (not shared across cold starts). DB persistence is the source of truth. Version change reset: write `reset_version=N` to DB; each instance checks on cold start and resets local state if DB version > local version. This is eventually-consistent (not atomic across instances), acceptable for a 10% exploration budget.

**Success criteria**:
- [ ] Exploration rate stays at ~10% (±2%, measurable)
- [ ] Bandit-selected models outperform static policy within 1000 requests (accuracy metric)
- [ ] Bandit counts reset on coordinator weights version change (verifiable via unit test)
- [ ] No regression: bandit mode never performs worse than static coordinator
- [ ] `yarn test:bandit` passes: `tsx scripts/test/bandit-simulation.ts --requests 1000 --model-a-rate 0.8 --model-b-rate 0.4` → model A selection ≥ 70%

---

## Phase 3 — Polish & Scale (4–6 weeks)

### Task 3.1: Adaptive Depth Mode

**Goal**: Coordinator predicts not only which model but how many turns (1, 2, or 4). Simple queries skip orchestration entirely.

**Files**:
- `utils/coordinator/classifier.ts` (modify) — multi-head output: model_logits + depth_logits
- `utils/orchestration/graph.ts` (modify) — conditional edges based on predicted depth

**Depth logic**:
```
depth=1: fast path — Worker only, no Thinker/Verifier (identical to current behavior)
depth=2: standard — Worker → Verifier (for most dev tasks)
depth=4: deep — Thinker → Worker → Verifier → retry (complex code/math)
```

**Training**: depth labels derived from eval harness. Problems that frontier model gets right in 1 shot → depth=1. Problems that benefit from multi-turn → depth=2 or 4.

**Success criteria**:
- < 20% of simple queries trigger depth=2+ (no wasteful orchestration)
- > 60% of code/math queries trigger depth=2+ (orchestration fires when useful)
- Average latency for general chat stays within 2× of current baseline

---

### Task 3.2: Coordinator Sidecar (Opt-in, 100% Fidelity)

**Goal**: Power users can run Qwen3-0.6B locally via Docker + ONNX for hidden-state–based coordination. AetherWeaver connects to `localhost:8080`.

**Files**:
- `docker/coordinator-sidecar/Dockerfile` (new)
- `docker/coordinator-sidecar/server.py` (new) — FastAPI, loads ONNX model, exposes `/hidden-states`
- `utils/coordinator/sidecar.ts` (new) — TypeScript client for sidecar endpoint
- `utils/coordinator/classifier.ts` (modify) — fallback chain: sidecar → embedding → static
- `.env.example` (modify) — add `COORDINATOR_SIDECAR_URL` (empty by default)

**Sidecar guard**: Connection ONLY attempted when `COORDINATOR_SIDECAR_URL` env var is set. When absent: skip sidecar entirely — no TCP connection attempt, no timeout delay. Verify: requests without the env var add < 5ms overhead from the sidecar check.

**Sidecar API**:
```
POST /hidden-states
Body: { "messages": [...], "return_logits": true }
Response: { "hidden_states": [[float, ...]], "routing_logits": [float, ...], "latency_ms": 85 }
```

**ONNX model**: Convert Qwen3-0.6B via `optimum-cli export onnx`. ~1.2GB FP16. Runs on CPU (inference ~100ms).

**Success criteria**:
- Sidecar starts with `docker compose up`
- AetherWeaver detects sidecar availability, uses it when present
- Fallback to embedding works when sidecar is unavailable
- On HumanEval 50-problem subset: sidecar coordinator accuracy ≥ embedding coordinator accuracy + 2% (not just "different" — verifiably better)

---

### Task 3.3: Federated Feedback (Opt-in)

**Goal**: Users who opt in contribute anonymized routing data to improve global coordinator. Privacy-preserving — no conversation content leaves the user's system.

**Files**:
- `utils/feedback/federated.ts` (new) — opt-in toggle, data hashing, upload
- `app/api/admin/feedback/export/route.ts` (new) — admin export endpoint (for self-hosted users who want to contribute)

**Data uploaded** (per routing decision):
```json
{
  "bucket_id": "pca_bucket_42",        // PCA-reduced embedding bucket (k=100), NOT raw hash
  "model_selected": "deepseek-reasoner",
  "depth_used": 2,
  "rating": 1,
  "task_type": "code",
  "auto_verified": true,
  "coordinator_version": 3
}
```

**Privacy**: Embeddings are PCA-reduced to 100 buckets offline. Only bucket IDs are uploaded — not raw embeddings, not truncated hashes. This prevents embedding reconstruction while preserving routing pattern analysis. Salt is per-deployment (generated once on first federated opt-in).

**NO**: conversation text, user messages, model outputs, IP addresses, user IDs, raw embeddings, embedding hashes.

**Success criteria**:
- Opt-in is off by default
- Export produces valid JSON with no PII
- Documentation explains exactly what data is shared and what is not

---

## File Manifest

### New files
```
utils/coordinator/
├── embedder.ts              # Embedding generation (ONNX local or API)
├── classifier.ts            # Logistic regression / MLP + weight loading
├── bandit.ts                # Thompson sampling
└── sidecar.ts               # Sidecar client
utils/orchestration/
├── graph.ts                 # LangGraph StateGraph
├── roles.ts                 # Thinker/Worker/Verifier prompts
├── context.ts               # JIT context builder (GAM) + sensory filter (LightMem)
└── executor.ts              # Provider API calls, streaming
utils/feedback/
├── store.ts                 # SQLite/Turso CRUD
├── schema.ts                # Types + migration
├── diagnosis.ts             # SkillForge-style failure analyzer + diagnostician
└── federated.ts             # Opt-in data export
utils/langfuse/
├── client.ts                # (rewrite) SDK init
└── tracer.ts                # Trace/span/generation helpers
scripts/eval/
├── runner.ts                # CLI entry
├── datasets/                # Dataset loaders
└── metrics.ts               # Accuracy/cost/latency
scripts/train/
├── retrain.ts               # Pipeline entry + targeted optimization dispatcher
├── cmaes.ts                 # sep-CMA-ES implementation
├── data.ts                  # DB → (X, y) grouped by failure_category
├── export.ts                # Weights serialization
└── prompt-optimizer.ts      # LLM-based role prompt refinement (SkillForge-style)
docker/coordinator-sidecar/
├── Dockerfile
└── server.py
app/api/feedback/route.ts    # POST /api/feedback
```

### Modified files
```
utils/unified-router.ts      # Wire coordinator into route()
utils/openai-compat.ts       # selectBestModelForAuto → call coordinator
app/api/chat/route.ts        # Single-model → orchestration dispatch
package.json                 # Scripts: eval, retrain
models-config.json           # Prune 13 → 5-7 models
```

### Deleted/nothing
```
(Nothing deleted — existing routes preserved as fast-path fallback)
```

---

## Success Criteria Per Phase

### Phase 1 (Foundation)
- [ ] Coordinator predicts different models for image vs code vs math inputs (no single model > 60% of non-explicit requests)
- [ ] Thinker → Worker → Verifier cycle completes for complex queries
- [ ] Verifier: on 10 known-wrong answers, RETRY/ESCALATE ≥ 80%; on 10 known-correct, ACCEPT ≥ 80%
- [ ] Context builder filters irrelevant turns (sensory filter) and produces role-specific contexts
- [ ] Context turns tracked: `turnsIncluded` / `turnsFiltered` logged per model call
- [ ] `yarn eval` produces `eval-results.json` with 5 strategies compared
- [ ] Trinity cycle on HumanEval: pass@1 ≥ [TBD — benchmark Fugu's score first]
- [ ] Langfuse dashboard shows full trace tree with per-node latency
- [ ] LSP diagnostics clean on all new files
- [ ] `yarn test` passes with unified router (Task 0 verification)

### Phase 2 (Learning Loop)
- [ ] Feedback entries accumulating (100+ verified per week)
- [ ] Every `rating=0` entry has non-null `failure_category` (diagnosis coverage > 95%)
- [ ] Failure category distribution logged and monitored
- [ ] `yarn retrain` produces `coordinator-weights-v{N}.json` + `role-prompts-v{N}.json`
- [ ] Retrained weights outperform previous version on eval suite
- [ ] Targeted optimization produces verifiable improvements per failure category
- [ ] Bandit mode matches or exceeds static policy after 1000 requests
- [ ] 10% exploration budget maintained (±2%)

### Phase 3 (Polish)
- [ ] Depth-1 queries < 20% of total (simple queries stay fast)
- [ ] Depth-2+ queries > 60% of code/math tasks
- [ ] Sidecar mode works end-to-end (local Docker → hidden states → routing decision)
- [ ] Federated export produces valid, anonymized JSON
- [ ] Full test suite passes (`yarn test`) with orchestration integration tests

---

## Budget

| Item | Cost | When |
|---|---|---|
| Synthetic seed data API calls (6000 examples) | $200–500 | Phase 1, one-time |
| Eval harness API calls (ongoing) | $50–100/week | Phase 2+, recurring |
| Vercel Pro (for 60s timeout on deep mode) | $20/month | Phase 1+, recurring |
| Turso DB (feedback storage) | Free tier | Phase 2+ |
| GPU server for sidecar testing | $20–50 | Phase 3, one-time |
| **Total** | **$300–700** | |

---

## References

### Adopted (integrated into plan)

| Paper | Source | Adopted For |
|---|---|---|
| **Trinity** — Xu et al., "Trinity: An Evolved LLM Coordinator." ICLR 2026. [arXiv:2512.04695](https://arxiv.org/abs/2512.04695) | Sakana AI | Thinker/Worker/Verifier cycle (Task 1.2), sep-CMA-ES training (Task 2.2), 0.6B hidden-state coordinator (Task 3.2) |
| **Conductor** — Nielsen et al., "Learning to Orchestrate Agents in Natural Language with the Conductor." ICLR 2026. [arXiv:2512.04388](https://arxiv.org/abs/2512.04388) | Sakana AI | Natural-language workflow planning concept. Phase 3+ target; Trinity captures 80%+ value at lower cost. **Philosophical tension**: Conductor's core claim is that coordination strategies *emerge* from end-to-end RL — not from hand-designed patterns. Our fixed Thinker/Worker/Verifier roles are hand-designed. This is a deliberate tradeoff for Phase 1-2 simplicity; Conductor-style emergent workflows are a Phase 3+ goal if RL infrastructure becomes available. |
| **SkillForge** — Liu et al., "SkillForge: Forging Domain-Specific, Self-Evolving Agent Skills in Cloud Technical Support." ACM SIGIR 2026 Industry Track. [arXiv:2604.08618](https://arxiv.org/abs/2604.08618) | Alibaba Cloud | Failure diagnosis pipeline (Task 2.1b), targeted optimization per failure category (Task 2.2) |
| **GAM** — Yan et al., "General Agentic Memory Via Deep Research." [arXiv:2511.18423](https://arxiv.org/abs/2511.18423) | BAAI / Renmin / PKU / HK PolyU | JIT context construction per orchestration turn (Task 1.2 context builder). Full-history page-store + lightweight memory index → role-optimized prompts. |
| **LightMem** — Fang et al., "LightMem: Lightweight and Efficient Memory-Augmented Generation." [arXiv:2510.18866](https://arxiv.org/abs/2510.18866) | Zhejiang Univ / NUS | Three-stage memory model (Task 1.2 context builder): sensory filter → topic grouper → role-specific context. **Note**: LightMem's sleep-time consolidation is *offline memory reorganization* (dedup/merge of conversation history entries), NOT model retraining. Our weekly retrain (sep-CMA-ES) is Trinity-style evolutionary training, not LightMem sleep-time. A separate offline memory consolidation step for context store maintenance is a Phase 3 candidate (not in current plan). |

### Evaluated and excluded

| Paper | Source | Reason for Exclusion |
|---|---|---|
| **FedTextGrad** — Chen et al., "Can Textual Gradient Work in Federated Learning?" [arXiv:2502.19980](https://arxiv.org/abs/2502.19980) | UBC / NTU / UPenn | Federated learning architecture irrelevant to single-deployment model. TextGrad prompt optimization addresses prompt tuning, not model selection. |
| **Ctx2Skill** — Si et al., "From Context to Skills: Can Language Models Learn from Context Skillfully?" [arXiv:2604.27660](https://arxiv.org/abs/2604.27660) | THU / DeepLang / UIUC | Context → skill extraction is orthogonal to model selection routing problem. Cross-time Replay may be relevant for Phase 3+ coordinator stability. |
| **TokenDance** — Bian et al., "TokenDance: Scaling Multi-Agent LLM Serving via Collective KV Cache Sharing." [arXiv:2604.03143](https://arxiv.org/abs/2604.03143) | PKU / SJTU | Inference-engine–level KV Cache optimization. AetherWeaver calls external APIs, does not serve models. Relevant only for coordinator sidecar at scale (Task 3.2 footnote). |
| **Helium** — Wadlom et al., "Efficient LLM Serving for Agentic Workflows: A Data Systems Perspective." [arXiv:2603.16104](https://arxiv.org/abs/2603.16104) | — | Inference-engine–level workflow caching. Below AetherWeaver's orchestration abstraction layer. |

### Phase 3 candidates (deferred, not in current plan)

| Paper | Source | Potential Use |
|---|---|---|
| **AgentSwing** — Feng et al., "AgentSwing: Adaptive Parallel Context Management Routing for Long-Horizon Web Agents." [arXiv:2603.27490](https://arxiv.org/abs/2603.27490) | Alibaba Tongyi Lab | Parallel-branch orchestration topology (Debate mode: multiple Workers → Synthesizer). Phase 3 topology library candidate. |
| **MUSE-Autoskill** — Lin et al., "MUSE-Autoskill: Self-Evolving Agents via Skill Creation, Memory, Management, and Evaluation." [arXiv:2605.27366](https://arxiv.org/abs/2605.27366) | ByteDance | Skill lifecycle formalization (creation → memory → management → evaluation → refinement). Per-skill memory, unit-test–driven refinement, cross-agent skill transfer. Validate Phase 3 federated feedback direction. |

### Other references

- **Fugu**: Sakana AI. [https://sakana.ai/fugu-release/](https://sakana.ai/fugu-release/)
- **sep-CMA-ES**: Ros & Hansen, "A Simple Modification in CMA-ES Achieving Linear Time and Space Complexity." PPSN 2008.
- **Transformers.js**: [https://huggingface.co/docs/transformers.js](https://huggingface.co/docs/transformers.js)
- **LangGraph**: [https://langchain-ai.github.io/langgraph/](https://langchain-ai.github.io/langgraph/)
- **Langfuse**: [https://langfuse.com/docs](https://langfuse.com/docs)
