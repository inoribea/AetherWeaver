# Research References

## Adopted

Papers integrated into the plan.

| Paper | Source | Adopted for | arXiv link |
|---|---|---|---|
| **Trinity** - Xu et al., "Trinity: An Evolved LLM Coordinator." ICLR 2026. | Sakana AI | Thinker/Worker/Verifier cycle (Task 1.2), sep-CMA-ES training (Task 2.2), 0.6B hidden-state coordinator (Task 3.2) | [arXiv:2512.04695](https://arxiv.org/abs/2512.04695) |
| **Conductor** - Nielsen et al., "Learning to Orchestrate Agents in Natural Language with the Conductor." ICLR 2026. | Sakana AI | Natural-language workflow planning concept. Phase 3+ target; Trinity captures 80%+ value at lower cost. | [arXiv:2512.04388](https://arxiv.org/abs/2512.04388) |
| **SkillForge** - Liu et al., "SkillForge: Forging Domain-Specific, Self-Evolving Agent Skills in Cloud Technical Support." ACM SIGIR 2026 Industry Track. | Alibaba Cloud | Failure diagnosis pipeline (Task 2.1b), targeted optimization per failure category (Task 2.2) | [arXiv:2604.08618](https://arxiv.org/abs/2604.08618) |
| **GAM** - Yan et al., "General Agentic Memory Via Deep Research." | BAAI / Renmin / PKU / HK PolyU | JIT context construction per orchestration turn (Task 1.2 context builder). Full-history page-store + lightweight memory index -> role-optimized prompts. | [arXiv:2511.18423](https://arxiv.org/abs/2511.18423) |
| **LightMem** - Fang et al., "LightMem: Lightweight and Efficient Memory-Augmented Generation." | Zhejiang Univ / NUS | Three-stage memory model (Task 1.2 context builder): sensory filter -> topic grouper -> role-specific context. | [arXiv:2510.18866](https://arxiv.org/abs/2510.18866) |

## Evaluated and excluded

Papers considered but rejected.

| Paper | Source | Reason for exclusion |
|---|---|---|
| **FedTextGrad** - Chen et al., "Can Textual Gradient Work in Federated Learning?" | UBC / NTU / UPenn | Federated learning architecture irrelevant to single-deployment model. TextGrad prompt optimization addresses prompt tuning, not model selection. |
| **Ctx2Skill** - Si et al., "From Context to Skills: Can Language Models Learn from Context Skillfully?" | THU / DeepLang / UIUC | Context -> skill extraction is orthogonal to model selection routing problem. Cross-time Replay may be relevant for Phase 3+ coordinator stability. |
| **TokenDance** - Bian et al., "TokenDance: Scaling Multi-Agent LLM Serving via Collective KV Cache Sharing." | PKU / SJTU | Inference-engine-level KV Cache optimization. AetherWeaver calls external APIs, does not serve models. Relevant only for coordinator sidecar at scale (Task 3.2 footnote). |
| **Helium** - Wadlom et al., "Efficient LLM Serving for Agentic Workflows: A Data Systems Perspective." | - | Inference-engine-level workflow caching. Below AetherWeaver's orchestration abstraction layer. |

## Phase 3 candidates

Deferred papers, not in current plan.

| Paper | Source | Potential use |
|---|---|---|
| **AgentSwing** - Feng et al., "AgentSwing: Adaptive Parallel Context Management Routing for Long-Horizon Web Agents." | Alibaba Tongyi Lab | Parallel-branch orchestration topology (Debate mode: multiple Workers -> Synthesizer). Phase 3 topology library candidate. |
| **MUSE-Autoskill** - Lin et al., "MUSE-Autoskill: Self-Evolving Agents via Skill Creation, Memory, Management, and Evaluation." | ByteDance | Skill lifecycle formalization (creation -> memory -> management -> evaluation -> refinement). Per-skill memory, unit-test-driven refinement, cross-agent skill transfer. Validate Phase 3 federated feedback direction. |

## Other references

- **Fugu**: Sakana AI. [https://sakana.ai/fugu-release/](https://sakana.ai/fugu-release/)
- **sep-CMA-ES**: Ros & Hansen, "A Simple Modification in CMA-ES Achieving Linear Time and Space Complexity." PPSN 2008.
- **Transformers.js**: [https://huggingface.co/docs/transformers.js](https://huggingface.co/docs/transformers.js)
- **LangGraph**: [https://langchain-ai.github.io/langgraph/](https://langchain-ai.github.io/langgraph/)
- **Langfuse**: [https://langfuse.com/docs](https://langfuse.com/docs)
