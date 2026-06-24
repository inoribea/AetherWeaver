Status: 60% complete (2026-06-23)

# Task 0 — Route Entry Unification

## Goal

Resolve the dual-router problem before any coordinator work begins. `IntelligentRouterUnified` becomes the single routing entry point for all production requests.

## Files

- `app/api/chat/route.ts` (modify) — replace `SmartRouterComponent` with `IntelligentRouterUnified`
- `src/chains/basic-chain.ts` (modify) — accept externally injected model/apiKey/baseURL params; remove internal `ChatOpenAI` instantiation
- `src/chains/vision-chain.ts` (modify) — same as basic-chain
- `src/chains/rag-chain.ts` (modify) — same as basic-chain
- `app/components/routing/smart-router.ts` (deprecate) — add `@deprecated` JSDoc, keep as fallback
- `src/components/routing/smart-router.ts` (deprecate) — same treatment; yes, there are two copies

## Problem

AetherWeaver has two independent routing paths:

- `utils/unified-router.ts` + `IntelligentRouterUnified` — the stub the plan targets
- `app/components/routing/smart-router.ts` + `SmartRouterComponent` — the ACTUAL path used by `app/api/chat/route.ts` via `createBasicChain`/`createRAGChain`/`createVisionChain`

These chains internally create their own `ChatOpenAI` instances, bypassing `unified-router.ts` entirely. All Phase 1 coordinator changes will have zero effect on production requests unless this is unified.

## Pre-condition

Fix existing bug before Task 0 changes begin.

```
app/api/chat/route.ts: remove duplicate `case "vision_tasks":` (appears twice, TypeScript error)
Verify: `yarn tsc --noEmit` passes before any changes
```

## Decision

`IntelligentRouterUnified` becomes the single routing entry point. Chains accept model config as parameters rather than internally instantiating `ChatOpenAI`.

## Steps

1. **Fix pre-condition** — remove the duplicate `case "vision_tasks":` in `app/api/chat/route.ts`. Verify with `yarn tsc --noEmit`.
2. **Refactor `src/chains/basic-chain.ts`** — replace internal `ChatOpenAI` instantiation with constructor or call-time parameters for `model`, `apiKey`, and `baseURL`.
3. **Refactor `src/chains/vision-chain.ts`** — apply the same external-config pattern as basic-chain.
4. **Refactor `src/chains/rag-chain.ts`** — apply the same external-config pattern as basic-chain.
5. **Deprecate `app/components/routing/smart-router.ts`** — add `@deprecated` JSDoc to the class and key methods. Keep the file as fallback but route production code away from it.
6. **Deprecate `src/components/routing/smart-router.ts`** — apply identical `@deprecated` treatment.
7. **Wire unified router in `app/api/chat/route.ts`** — replace `SmartRouterComponent` calls with `IntelligentRouterUnified.route()`. Ensure the unified router's selected model config is passed into the chain factories.
8. **Run automated tests** — `yarn test` must pass with the new unified routing path.
9. **Manual smoke test** — send a request with `model: "auto"` and confirm a real model responds without error.

## Verification

- [x] Pre-condition: `yarn tsc --noEmit` passes (duplicate case bug fixed)
- [ ] `app/api/chat/route.ts` calls `intelligentRouter.route()` (verifiable via grep)
- [x] Chains (`basic-chain.ts`, `vision-chain.ts`, `rag-chain.ts`) accept external model config — no internal `ChatOpenAI` instantiation (partially)
- [x] Both `smart-router.ts` copies marked `@deprecated`
- [ ] All existing tests pass with unified router (`yarn test`)
- [ ] Manual smoke test: `model: "auto"` → response from a real model (not error)
- [ ] LSP diagnostics clean
