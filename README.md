# AetherWeaver — Open-Source Learned Multi-Turn LLM Orchestration

[简体中文](README-CN.md)

**AetherWeaver is an orchestration platform that learns.** Send it a message. It decides whether to answer directly or coordinate Thinker → Worker → Verifier across multiple models. It learns from every success and failure, improving weekly. Open-source, free to deploy on Vercel, uses your own API keys.

---

## What It Does

### Multi-Turn Orchestration

AetherWeaver doesn't pick one model and call it done. For complex tasks, it runs a coordinated multi-turn pipeline:

```
Request → Thinker (analyze & plan) → Worker (execute) → Verifier (check & accept/retry)
```

- **Adaptive depth**: simple queries = 1 turn. Complex code/math/reasoning = 2-4 turns.
- **Budget protection**: token, cost, and latency caps per request. Degrades gracefully on timeout — skips Verifier and returns Worker output rather than failing.
- **Single endpoint**: `model: "auto"` — the coordinator handles the rest.

### Self-Evolution

AetherWeaver improves from usage. Every request generates a reward signal — code execution results, math answer matching, or explicit 👍/👎 feedback:

```
Feedback → Failure Diagnosis (4-dimension analysis) → Weekly Retraining (sep-CMA-ES, CPU-runnable) → updated coordinator weights (<100KB JSON)
```

The coordinator learns to route better over time. No labeled dataset needed — verifiable tasks provide ground truth automatically.

### Intelligent Context Management

Multi-turn orchestration bloats context. AetherWeaver's context builder assembles role-optimized prompts instead of passing the full history to every model:

- **Sensory filter**: drops irrelevant turns
- **Topic grouper**: semantic clustering per conversation phase
- **Per-role assembly**: Thinker sees problem + plan. Worker sees plan + evidence. Verifier sees output + requirements.

4-turn context overhead = ~1.5-2x single call, not 4x.

### Deploy Anywhere, Bring Your Own Keys

```bash
git clone https://github.com/inoribea/AetherWeaver.git && cd AetherWeaver
yarn install && cp .env.example .env.local
yarn dev   # localhost:3000
yarn deploy  # Vercel (free Hobby tier)
```

One command to production. Your OpenAI / Anthropic / Google / DeepSeek / Qwen / Hunyuan keys. Your infrastructure. Your data never touches a third-party orchestration service.

---

## Key Advantages

**Learned routing, not static rules.** The coordinator trains via gradient-free evolution (sep-CMA-ES) on actual usage outcomes. It gets smarter without human tuning.

**Multi-turn without multi-endpoint complexity.** One `model: "auto"` call triggers Thinker → Worker → Verifier coordination. No workflow DSL, no agent framework to configure.

**Full transparency.** Routing decisions, model choices, confidence scores, and per-turn traces are all logged to Langfuse. Coordinator weights are a <100KB JSON file — inspectable, versioned, auditable.

**Self-improving without data annotation.** Code execution pass/fail and math answer matching provide clean reward signals automatically. User feedback is optional, additive.

**Free and open.** MIT license. Vercel Hobby tier. No seat licenses, no output-token pricing, no vendor lock-in.

---

## Quick Start

```bash
git clone https://github.com/inoribea/AetherWeaver.git
cd AetherWeaver
yarn install
cp .env.example .env.local
```

Minimum config:

```env
OPENAI_API_KEY=sk-...
# or GOOGLE_API_KEY=...
# or NEKO_API_KEY=... + NEKO_BASE_URL=...
```

```bash
yarn dev   # → http://localhost:3000
```

```bash
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Write a lock-free concurrent hashmap in Rust"}]}'
```

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `ORCHESTRATION_MODE` | `adaptive` | `fast` / `standard` / `deep` / `adaptive` |
| `MAX_TURNS` | `4` | Max orchestration turns per request |
| `ORCHESTRATION_TIMEOUT_MS` | `55000` | Timeout (5s Vercel buffer) |
| `COORDINATOR_SIDECAR_URL` | — | Local Qwen3-0.6B for hidden-state routing (100% Trinity fidelity) |
| `ENABLE_FEEDBACK` | `true` | Collect 👍/👎 feedback for learning |

---

## Observability

Every request produces a Langfuse trace tree:

```
Request
├── Coordinator Decision — model, confidence, reasoning
├── Thinker — model, tokens, latency
├── Worker
├── Verifier — verdict, rationale
└── Feedback — rating, auto-verification, failure diagnosis
```

---

## Architecture

```
app/api/v1/chat/completions/route.ts   ← OpenAI-compatible entry point
utils/coordinator/                     ← embedder, classifier, bandit, sidecar
utils/orchestration/                   ← LangGraph state graph, roles, context builder
utils/feedback/                        ← feedback store, failure diagnosis
scripts/eval/                          ← eval harness (6 strategies + expert baseline)
scripts/train/                         ← sep-CMA-ES retraining + targeted optimization
docker/coordinator-sidecar/            ← optional ONNX Qwen3-0.6B sidecar
```

---

## Documentation

| Document | Contents |
|---|---|
| [Trinity Orchestration Roadmap](docs/TRINITY_ORCHESTRATION_ROADMAP.md) | Full implementation plan |
| [Deployment Guide](docs/vercel-guide.md) | Vercel deployment |
| [API Usage](docs/chat_api_usage.md) | Chat API reference |

---

## Research Foundations

- **Trinity** (Sakana AI, ICLR 2026) — Multi-turn coordinator + sep-CMA-ES training. [arXiv:2512.04695](https://arxiv.org/abs/2512.04695)
- **SkillForge** (Alibaba, SIGIR 2026) — Self-evolving skills, failure diagnosis. [arXiv:2604.08618](https://arxiv.org/abs/2604.08618)
- **GAM** (BAAI) — JIT-compilation agent memory. [arXiv:2511.18423](https://arxiv.org/abs/2511.18423)
- **LightMem** (Zhejiang Univ) — Three-stage lightweight memory. [arXiv:2510.18866](https://arxiv.org/abs/2510.18866)

---

## License

MIT © AetherWeaver
