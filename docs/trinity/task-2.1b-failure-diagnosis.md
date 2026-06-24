# Task 2.1b: Failure Diagnosis (SkillForge-style)

## Goal

When a response receives `rating=0`, automatically diagnose WHY the orchestration failed, not just THAT it failed. Modeled on SkillForge's Failure Analyzer → Skill Diagnostician → Skill Optimizer pipeline (Liu et al., SIGIR 2026).

## Files

- `utils/feedback/diagnosis.ts` (new) — LLM-powered failure analyzer + diagnostician
- `utils/feedback/store.ts` (modify) — write diagnosis fields on rating=0

## Diagnosis Pipeline

Runs asynchronously after a bad rating is recorded:

```
rating=0 recorded
  │
  ▼
Failure Analyzer (4 dimensions, parallel — uses gemini-flash-lite for speed and cost)
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

## Failure Analyzer Prompts

### Capability Analyzer (`utils/feedback/diagnosis.ts`)

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

### Role Analyzer

```
Analyze whether the correct role was assigned at this orchestration turn.
Turn count: {turnCount} / {maxTurns}
Role assigned: {role} (Thinker/Worker/Verifier)
Previous turn outcome: {previousTurnSummary}

Was this the right role for this point in the orchestration cycle?
Score 0-1: 1.0 = correct role, 0.0 = wrong role (e.g., Thinker assigned when Worker should execute)

Output JSON: {"score": float, "explanation": "..."}
```

### Verifier Analyzer

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

### Decomposition Analyzer

```
Analyze whether the Thinker correctly decomposed the problem.
Original problem: {problemSummary}
Thinker's plan: {planSummary}
Worker's approach: {workerApproach}

Did the Thinker's plan guide the Worker in the right direction, or did it mischaracterize the problem?
Score 0-1: 1.0 = Thinker's decomposition was helpful and accurate, 0.0 = Thinker sent Worker down wrong path

Output JSON: {"score": float, "explanation": "..."}
```

## Aggregation Logic

Lowest score equals the most broken component:

```typescript
function aggregate(scores: DimensionScore[]): string | null {
  const min = scores.reduce((a, b) => a.score < b.score ? a : b);
  if (min.score > 0.5) return null;  // all components scored > 0.5 → no clear failure
  return min.category;  // 'capability_mismatch' | 'role_error' | 'verifier_error' | 'thinker_error'
}
```

All four Analyzer prompts use consistent semantics: **high score = component working correctly, low score = component likely failed**. The aggregator picks the dimension with the LOWEST score (the most probable failure).

## Implementation Steps

1. Implement the four analyzer prompts in `utils/feedback/diagnosis.ts` as parallel LLM calls
2. Implement the aggregation function that picks the lowest score across the four dimensions
3. Implement the Skill Diagnostician mapping from failure category to fix target
4. Modify `utils/feedback/store.ts` to write `diagnosis_detail`, `targeted_fix`, and `failure_category` when `rating=0`
5. Add async pipeline trigger in the feedback POST handler to run diagnosis after a bad rating
6. Add 30-second SLA timeout handling (mark `failure_category='diagnosis_timeout'` and skip if exceeded)
7. Log diagnosis distribution to monitor which components fail most

## Success Criteria

- [ ] Every `rating=0` entry gets a non-null `failure_category` within 30 seconds
- [ ] Diagnosis distribution logged (monitor which components fail most)
- [ ] Distinct failure categories produce distinct fix types (verifiable in retrain pipeline)
