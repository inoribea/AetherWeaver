# Task 3.2: Coordinator Sidecar (Opt-in, 100% Fidelity)

## Goal

Power users can run Qwen3-0.6B locally via Docker + ONNX for hidden-state-based coordination. AetherWeaver connects to `localhost:8080`.

## Files

- `docker/coordinator-sidecar/Dockerfile` (new)
- `docker/coordinator-sidecar/server.py` (new): FastAPI, loads ONNX model, exposes `/hidden-states`
- `utils/coordinator/sidecar.ts` (new): TypeScript client for sidecar endpoint
- `utils/coordinator/classifier.ts` (modify): fallback chain: sidecar -> embedding -> static
- `.env.example` (modify): add `COORDINATOR_SIDECAR_URL` (empty by default)

## Sidecar guard

Connection ONLY attempted when `COORDINATOR_SIDECAR_URL` env var is set. When absent: skip sidecar entirely - no TCP connection attempt, no timeout delay. Verify: requests without the env var add less than 5ms overhead from the sidecar check.

## Sidecar API spec

```
POST /hidden-states
Body: { "messages": [...], "return_logits": true }
Response: { "hidden_states": [[float, ...]], "routing_logits": [float, ...], "latency_ms": 85 }
```

## ONNX model notes

Convert Qwen3-0.6B via `optimum-cli export onnx`. ~1.2GB FP16. Runs on CPU (inference ~100ms).

## Implementation steps

1. Export Qwen3-0.6B to ONNX format using `optimum-cli export onnx`
2. Create `docker/coordinator-sidecar/Dockerfile` with Python + ONNX Runtime base image
3. Implement `docker/coordinator-sidecar/server.py` as FastAPI app that loads the ONNX model and serves `/hidden-states`
4. Create `utils/coordinator/sidecar.ts` as a lightweight HTTP client with configurable timeout
5. Modify `utils/coordinator/classifier.ts` to prepend sidecar to the fallback chain: attempt sidecar first, fall back to embedding classifier, then static policy
6. Add `COORDINATOR_SIDECAR_URL` to `.env.example` with empty default
7. Add Docker Compose service definition for the sidecar
8. Benchmark sidecar vs embedding classifier on HumanEval 50-problem subset

## Success criteria

- [ ] Sidecar starts with `docker compose up`
- [ ] AetherWeaver detects sidecar availability and uses it when present
- [ ] Fallback to embedding classifier works when sidecar is unavailable
- [ ] On HumanEval 50-problem subset: sidecar coordinator accuracy is greater than or equal to embedding coordinator accuracy + 2% (not just "different" - verifiably better)
