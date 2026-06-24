# Task 2.3: A/B Bandit (Thompson Sampling)

## Goal

Between retrains, use Thompson sampling to balance exploration and exploitation for model selection.

## Files

- `utils/coordinator/bandit.ts` (new) — Thompson sampling over model arms
- `utils/unified-router.ts` (modify) — inject bandit between retrains

## Algorithm (Thompson Sampling with Beta Distributions)

```typescript
// Per model arm: track (successes, failures)
// Beta distribution: Beta(α=successes+1, β=failures+1)
// On each request:
//   90%: sample from policy arms, pick argmax
//   10%: uniform random (exploration budget)
// Update counts when feedback arrives
```

## State Management (Vercel Serverless Notes)

State is stored in memory (Map) during server lifetime, and persists to DB on write. On cold start, load from DB.

**On coordinator weights version change** (`coordinator-weights-v{N}.json` version bump): reset all Bandit counts to zero. Old counts were collected under a different policy. Keeping them biases the Bandit.

**Vercel serverless note**: Bandit state is per-instance (not shared across cold starts). DB persistence is the source of truth. Version change reset: write `reset_version=N` to DB. Each instance checks on cold start and resets local state if DB version > local version. This is eventually-consistent (not atomic across instances), acceptable for a 10% exploration budget.

## Implementation Steps

1. Implement `utils/coordinator/bandit.ts` with Beta distribution sampling per model arm
2. Add 90/10 exploit/explore split: sample from Beta distributions for exploitation, uniform random for exploration
3. Add in-memory state Map and DB persistence layer for bandit counts
4. Add cold-start logic: load counts from DB on server start
5. Add version change detection: read `coordinator-weights-v{N}.json` version, compare with DB `reset_version`, reset counts if DB version is newer
6. Modify `utils/unified-router.ts` to inject bandit selection between coordinator policy and final model choice
7. Add feedback hook to update success/failure counts after each request
8. Write `scripts/test/bandit-simulation.ts` for unit testing

## Success Criteria

- [ ] Exploration rate stays at ~10% (±2%, measurable)
- [ ] Bandit-selected models outperform static policy within 1000 requests (accuracy metric)
- [ ] Bandit counts reset on coordinator weights version change (verifiable via unit test)
- [ ] No regression: bandit mode never performs worse than static coordinator
- [ ] `yarn test:bandit` passes: `tsx scripts/test/bandit-simulation.ts --requests 1000 --model-a-rate 0.8 --model-b-rate 0.4` → model A selection ≥ 70%
