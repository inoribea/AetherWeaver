# Task 3.3: Federated Feedback (Opt-in)

## Goal

Users who opt in contribute anonymized routing data to improve global coordinator. Privacy-preserving. No conversation content leaves the user's system.

## Files

- `utils/feedback/federated.ts` (new): opt-in toggle, data hashing, upload
- `app/api/admin/feedback/export/route.ts` (new): admin export endpoint (for self-hosted users who want to contribute)

## Data uploaded format (JSON schema)

Per routing decision:

```json
{
  "bucket_id": "pca_bucket_42",
  "model_selected": "deepseek-reasoner",
  "depth_used": 2,
  "rating": 1,
  "task_type": "code",
  "auto_verified": true,
  "coordinator_version": 3
}
```

- `bucket_id`: PCA-reduced embedding bucket (k=100), NOT raw hash
- `model_selected`: the model chosen by the coordinator
- `depth_used`: orchestration depth (1, 2, or 4)
- `rating`: feedback rating (1 for positive, -1 for negative)
- `task_type`: inferred task category
- `auto_verified`: whether the rating came from automatic verification
- `coordinator_version`: version of the coordinator that made the routing decision

## Privacy notes

Embeddings are PCA-reduced to 100 buckets offline. Only bucket IDs are uploaded, not raw embeddings, not truncated hashes. This prevents embedding reconstruction while preserving routing pattern analysis. Salt is per-deployment (generated once on first federated opt-in).

**NO** conversation text, user messages, model outputs, IP addresses, user IDs, raw embeddings, or embedding hashes are ever uploaded.

## Implementation steps

1. Implement `utils/feedback/federated.ts` with opt-in toggle, per-deployment salt generation, PCA bucket ID computation, and batched upload logic
2. Create `app/api/admin/feedback/export/route.ts` as an admin-only endpoint that returns exportable JSON of aggregated routing decisions
3. Add federated opt-in UI toggle (off by default) in settings
4. Generate per-deployment salt on first opt-in and store securely
5. Document the exact data shared and not shared in user-facing privacy docs
6. Add unit tests verifying no PII leakage in exported JSON

## Success criteria

- [ ] Opt-in is off by default
- [ ] Export produces valid JSON with no PII
- [ ] Documentation explains exactly what data is shared and what is not
