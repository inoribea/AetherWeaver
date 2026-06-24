# Task 1.1: Coordinator Signal — Embedding-based Router

**Goal**: Replace `semantic.analyze` stub with a real classifier that outputs `{model_id, confidence, depth}`.

---

## Sequencing Note

Task 1.1 and Task 1.3 have a bootstrap dependency. Break as follows:

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

---

## Files

- `utils/coordinator/embedder.ts` (new) — wraps `text-embedding-3-small` or local ONNX embedder
- `utils/coordinator/classifier.ts` (new) — logistic regression / 2-layer MLP, loads weights from JSON
- `utils/unified-router.ts` (modify) — wire `classifier.predict(embedding)` into `route()`

---

## Interface

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

---

## Training Data Source

Generate 6000 labeled examples from synthetic benchmarks (see Task 1.3).

---

## Fidelity Caveat

Trinity's 86.2% LiveCodeBench was achieved with **hidden states from Qwen3-0.6B** — a dense representation capturing the model's internal reasoning over the full transcript. `text-embedding-3-small` encodes surface semantic similarity, not internal reasoning signal. Trinity proves hidden-state space is perfectly linearly separable for task classification (SVM 100%, chance=25%); no equivalent evidence exists for text-embedding-3-small.

The embedding coordinator (Task 1.1) is therefore a **pragmatic approximation** for Vercel deployability. Full Trinity fidelity requires the sidecar (Task 3.2). Realistic quality ceiling: 70-80% of Trinity's routing accuracy without hidden states.

---

## Weights Format

`coordinator-weights-v1.json`:

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

---

## Step-by-Step Implementation

1. Create `utils/coordinator/embedder.ts`
   - Implement `embed(messages: ChatMessage[]): Promise<number[]>`
   - Primary path: call OpenAI `text-embedding-3-small` API
   - Fallback path: load local ONNX embedder via Transformers.js (for sidecar-less local dev)
   - Cache embeddings in-memory for identical message hashes (LRU, max 1000)

2. Create `utils/coordinator/classifier.ts`
   - Implement `class CoordinatorClassifier`
   - Constructor loads `coordinator-weights-v1.json` from disk
   - Method `predict(embedding: number[]): CoordinatorOutput`
   - Inference: matrix multiply + softmax, pick argmax
   - Map class index to `selectedModel` via `class_labels`
   - `recommendedDepth` default = 2; override via heuristic (code/math → 4, chat → 1)

3. Modify `utils/unified-router.ts`
   - Replace `semantic.analyze` stub with embedder + classifier pipeline
   - `route()` calls `embedder.embed()` then `classifier.predict()`
   - Pass `reasoning` field through to Langfuse trace (Task 1.4)
   - Keep existing explicit-model bypass intact (if user specifies model, skip coordinator)

4. Add unit tests
   - Mock embedder returns fixed vector; assert classifier picks expected model
   - Test `availableModels` filtering (classifier only returns models present in config)
   - Test weights file loading failure → graceful fallback to keyword router

5. Verify LSP diagnostics clean on `utils/coordinator/` and `utils/unified-router.ts`

---

## Success Criteria

- [ ] `semantic.analyze` returns non-empty `detectedCapabilities`
- [ ] `route()` returns different models for different input types (not always first config entry)
- [ ] LSP diagnostics clean on `utils/coordinator/` and `utils/unified-router.ts`
- [ ] Weights file < 100KB
