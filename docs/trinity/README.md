# AetherWeaver → Trinity Orchestration: Master Plan

**Target**: 12–18 weeks to 85–92% Fugu-quality on developer tasks (code / math / structured extraction).  
**Budget**: $300–700.  
**Language**: strict EN — code, comments, logs, commits.

---

## Current State

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

## Task Index

| ID | Task | File | Phase |
|---|---|---|---|
| 0 | Route Entry Unification | task-0-route-unification.md | Foundation |
| 1.1 | Coordinator Signal | task-1.1-coordinator-signal.md | Phase 1 |
| 1.2 | Thinker/Worker/Verifier | task-1.2-thinker-worker-verifier.md | Phase 1 |
| 1.3 | Eval Harness | task-1.3-eval-harness.md | Phase 1 |
| 1.4 | Langfuse Integration | task-1.4-langfuse-integration.md | Phase 1 |
| 2.1 | Feedback Storage | task-2.1-feedback-storage.md | Phase 2 |
| 2.1b | Failure Diagnosis | task-2.1b-failure-diagnosis.md | Phase 2 |
| 2.2 | Retraining Pipeline | task-2.2-retraining-pipeline.md | Phase 2 |
| 2.3 | A/B Bandit | task-2.3-ab-bandit.md | Phase 2 |
| 3.1 | Adaptive Depth | task-3.1-adaptive-depth.md | Phase 3 |
| 3.2 | Coordinator Sidecar | task-3.2-coordinator-sidecar.md | Phase 3 |
| 3.3 | Federated Feedback | task-3.3-federated-feedback.md | Phase 3 |

## Phase Summaries

- **Foundation**: Resolve the dual-router problem and establish a single routing entry point before any coordinator work begins.
- **Phase 1**: Build the embedding-based coordinator, implement the Thinker → Worker → Verifier cycle, run the evaluation harness, and integrate Langfuse tracing.
- **Phase 2**: Collect feedback, diagnose failures automatically, run weekly sep-CMA-ES retraining with targeted optimization, and deploy Thompson sampling bandits between retrains.
- **Phase 3**: Predict adaptive orchestration depth, optionally run a local ONNX sidecar for hidden-state routing, and offer privacy-preserving federated feedback.

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

See [references.md](references.md) for the full bibliography and research foundations.
