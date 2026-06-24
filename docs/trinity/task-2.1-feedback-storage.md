# Task 2.1: Feedback Storage

## Goal

Persistent storage for routing decisions and outcomes.

## Files

- `utils/feedback/store.ts` (new) — CRUD for feedback entries
- `utils/feedback/schema.ts` (new) — TypeScript types + DB migration
- `app/api/feedback/route.ts` (new) — POST handler

## DB Schema (SQLite via Turso, Vercel-compatible)

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

## Implicit Signals

Collected automatically, not via user action:

- `regeneration`: user sent same or similar query again, indicating the previous answer was bad
- `model_switch`: user manually changed model mid-conversation, indicating routing was wrong
- `copy_rate`: user copied response text, a positive signal (requires client-side tracking)

## Implementation Steps

1. Set up Turso database connection in `utils/feedback/schema.ts` with Drizzle or raw SQLite client
2. Run the schema migration to create the `feedback` table and indexes
3. Implement `utils/feedback/store.ts` with insert, query by trace_id, and list functions
4. Create `app/api/feedback/route.ts` as a POST handler that accepts feedback payloads and writes to the store
5. Add implicit signal detection in the chat completion route (regeneration, model switch, copy events)
6. Implement auto-verification for code tasks (test pass or fail) and math tasks (answer matching)
7. Log rating distribution periodically to monitor for class imbalance

## Success Criteria

- [ ] Feedback entries stored and queryable
- [ ] Auto-verification works for code and math tasks (system writes feedback entry without user action)
- [ ] Rating distribution logged (monitor for class imbalance)
