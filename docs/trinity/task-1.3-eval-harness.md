# Task 1.3: Eval Harness

**Goal**: Run 500+ benchmark problems through different routing strategies and measure accuracy.

---

## Files

- `scripts/eval/runner.ts` (new) — CLI entry point
- `scripts/eval/datasets/` (new) — dataset loaders
- `scripts/eval/metrics.ts` (new) — accuracy, cost, latency per strategy
- `package.json` (modify) — add `"eval": "tsx scripts/eval/runner.ts"`

---

## Datasets

All publicly available, no API key needed for data:

| Dataset | Problems | Task Type | Verification |
|---|---|---|---|
| HumanEval | 164 | Python code | Execute + test cases |
| MBPP | 500 | Python code | Execute + test cases |
| MATH | 500 | Math reasoning | String match final answer |
| GSM8K | 200 | Math word problems | Numeric match |
| BigBench (subset) | 200 | Reasoning | Multiple choice match |
| Custom schema-val | 200 | Structured extraction | JSON Schema validation |

---

## Strategies Compared

Per problem, run all 6 strategies:

1. **keyword** — Current keyword router (`selectBestModelForAuto`)
2. **random** — Random model selection
3. **frontier** — Always frontier model (gpt-5-all)
4. **expert_baseline** — Expert hand-tuned coordinator (fixed reference baseline, never changes across retrain cycles)
   - File: `scripts/eval/strategies/expert-router.ts`
   - Logic: rule-based, using task_type + content signals, NO ML
   - Implemented by AI agent based on domain knowledge prior to Task 1.3a
   - **Frozen after initial commit** — never modified across retrain cycles
   - Serves as SkillForge's "S_manual" equivalent: the fixed human-reference point
5. **embedding_coordinator** — Embedding-based coordinator (Task 1.1)
6. **trinity_cycle** — Thinker → Worker → Verifier (Task 1.2 with static routing)

---

## Expert Baseline Rationale

SkillForge's key finding — "automated evolution CAN surpass manually curated expert knowledge" — requires a fixed human-designed reference point (Liu et al., SIGIR 2026, [arXiv:2604.08618](https://arxiv.org/abs/2604.08618)). Strategy 4 serves this role. Track across all retrain cycles: does the learned coordinator (strategy 5/6) surpass the expert baseline? Without this, there is no way to measure SkillForge's core claim.

---

## Output Format

`eval-results.json`:

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

---

## Step-by-Step Implementation

1. Create `scripts/eval/datasets/` directory with loaders
   - `humaneval.ts`: load HumanEval problems from JSONL
   - `mbpp.ts`: load MBPP problems
   - `math.ts`: load MATH dataset
   - `gsm8k.ts`: load GSM8K problems
   - `bigbench.ts`: load BigBench subset
   - `schema-val.ts`: load custom schema validation problems
   - Each loader returns `{problem_id, prompt, task_type, expected, verification_fn}`

2. Create `scripts/eval/metrics.ts`
   - `calculateAccuracy(results)`: correct / total
   - `calculateLatency(results)`: average ms per strategy
   - `calculateCost(results)`: estimate from token usage
   - `aggregate(results)`: produce `eval-results.json` schema

3. Create `scripts/eval/runner.ts`
   - CLI: `tsx scripts/eval/runner.ts --strategies=all --output=eval-results.json`
   - For each problem, run all requested strategies
   - Cache API responses to avoid redundant calls (keyed by problem_id + strategy)
   - Write `eval-results.json` on completion
   - Write `scripts/eval/training-labels-v0.jsonl` for Task 1.1 bootstrap

4. Create `scripts/eval/strategies/expert-router.ts`
   - Rule-based router using task_type + content signals
   - NO ML — pure heuristic (e.g., code keywords → deepseek-reasoner, image → gpt-5-all)
   - Freeze after initial commit

5. Modify `package.json`
   - Add `"eval": "tsx scripts/eval/runner.ts"`

6. Add integration test
   - Run on 10-problem subset, verify JSON output schema
   - Verify training labels are generated when `--generate-labels` flag is passed

---

## Success Criteria

- [ ] `yarn eval` runs without errors, produces `eval-results.json`
- [ ] At least one strategy exceeds keyword router accuracy on code + math tasks
- [ ] Results reproducible (seed-based determinism or average over N runs)
