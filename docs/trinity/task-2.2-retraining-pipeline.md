# Task 2.2: Weekly Retraining Pipeline (Targeted Optimization)

## Goal

Script that pulls feedback data, retrains the coordinator classifier, and ships updated weights.

## Files

- `scripts/train/retrain.ts` (new) — main training script with targeted optimization dispatcher
- `scripts/train/cmaes.ts` (new) — sep-CMA-ES implementation (port from Trinity paper, Appendix B)
- `scripts/train/data.ts` (new) — loads feedback from DB, groups by failure_category
- `scripts/train/export.ts` (new) — serializes weights to `coordinator-weights-v{N}.json`
- `scripts/train/prompt-optimizer.ts` (new) — LLM-based prompt refinement for role templates (SkillForge-style)
- `package.json` (modify) — add `"retrain": "tsx scripts/train/retrain.ts"`

## Training Algorithm (sep-CMA-ES)

Separable CMA-ES parameters:

- Input: embedding vector (1536-d from text-embedding-3-small)
- Output: logits over 5–7 model classes
- Parameters: ~10K (1536 × 7 + 7 bias)
- Reward: binary (`rating == 1 ? +1 : -1`)
- Population size λ = 4 + 3·ln(D) where D = parameter dimension (1536×7 + 7 = 10759)
  - λ ≈ 33 (NOT 26 — ln(10759) ≈ 9.28, 4 + 3×9.28 ≈ 32)
- Stopping: max 200 generations or convergence (σ < 1e-6)

**Why sep-CMA-ES not logistic regression**: Trinity's key finding — in high-dim, low-budget regime, gradient-free outperforms gradient-based methods because per-parameter gradients from binary reward have low SNR. sep-CMA-ES samples full parameter vectors and evaluates holistically.

## Prompt-Optimizer Spec (`scripts/train/prompt-optimizer.ts`)

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

## Validation Gating

Before deploying a new prompt, run `scripts/eval/runner.ts --strategy=trinity_cycle --prompt-override=new` on a 50-problem subset. New prompt accuracy must be greater than or equal to old prompt accuracy. If degraded, discard the candidate, log to Langfuse, and keep the old prompt. This prevents prompt drift across retrain cycles.

## Pipeline Diagram (Global + Targeted Optimization)

```
yarn retrain
  ├── 1. Pull feedback entries from DB (last 7 days)
  ├── 2. Generate embeddings for all entries
  ├── 3. Filter: keep only entries with rating != null
  │
  ├── 4. GLOBAL RETRAIN (all rated entries)
  │   ├── Balance classes (undersample majority)
  │   ├── Run sep-CMA-ES (200 gens × 33 pop = 6600 evaluations)
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

## Implementation Steps

1. Implement `scripts/train/cmaes.ts` with separable CMA-ES (port from Trinity paper Appendix B)
2. Implement `scripts/train/data.ts` to load feedback from DB and group by `failure_category`
3. Implement global retrain logic: class balancing, sep-CMA-ES run, holdout evaluation
4. Implement targeted optimization dispatcher with per-category handlers
5. Implement `scripts/train/prompt-optimizer.ts` with the LLM-based prompt refinement spec
6. Implement validation gating: run eval subset on candidate prompts, reject degraded candidates
7. Implement `scripts/train/export.ts` to serialize weights and prompt versions to JSON
8. Wire up `yarn retrain` in package.json and add Langfuse logging

## Success Criteria

- [ ] `yarn retrain` completes without errors
- [ ] Exported weights file is valid JSON, < 100KB
- [ ] New weights achieve higher eval accuracy than previous version (or pipeline correctly rejects)
- [ ] Targeted optimization produces distinct outputs per failure_category (`role-prompts-v{N}.json` differs from previous)
- [ ] Failure category distribution shifts over retrain cycles (each category percentage should decrease — system is learning)
- [ ] Prompt-optimizer validation gating works: degraded prompt candidates are correctly rejected
- [ ] Data-gating works: when count < 10 per failure_category, that category is skipped (no crash)
- [ ] `yarn test:verifier` passes: `tsx scripts/eval/test-verifier.ts --dataset scripts/eval/fixtures/wrong-answers.json` → RETRY/ESCALATE ≥ 8/10
