# Task 3.1: Adaptive Depth Mode

## Goal

The coordinator predicts not only which model but how many turns (1, 2, or 4). Simple queries skip orchestration entirely.

## Files

- `utils/coordinator/classifier.ts` (modify): multi-head output: model_logits + depth_logits
- `utils/orchestration/graph.ts` (modify): conditional edges based on predicted depth

## Depth logic

```
depth=1: fast path - Worker only, no Thinker/Verifier (identical to current behavior)
depth=2: standard - Worker -> Verifier (for most dev tasks)
depth=4: deep - Thinker -> Worker -> Verifier -> retry (complex code/math)
```

## Training

Depth labels derived from eval harness. Problems that frontier model gets right in 1 shot -> depth=1. Problems that benefit from multi-turn -> depth=2 or 4.

## Implementation steps

1. Modify `utils/coordinator/classifier.ts` to add a second classification head for depth prediction alongside existing model selection logits
2. Update training data generation in the eval harness to label each example with target depth based on single-turn vs multi-turn performance
3. Modify `utils/orchestration/graph.ts` to branch conditionally on predicted depth instead of using fixed graph topology
4. Add depth prediction logging to Langfuse traces for observability
5. Validate depth distribution on eval harness: ensure simple queries stay at depth=1 and complex queries escalate appropriately
6. Benchmark latency across depth levels to confirm general chat stays within 2x baseline

## Success criteria

- [ ] Less than 20% of simple queries trigger depth=2+ (no wasteful orchestration)
- [ ] More than 60% of code/math queries trigger depth=2+ (orchestration fires when useful)
- [ ] Average latency for general chat stays within 2x of current baseline
