# AetherWeaver — 开源学习型多轮 LLM 编排平台

[English](README.md)

**AetherWeaver 是一个会学习的编排平台。** 给它一条消息，它决定直接回答还是协调 Thinker → Worker → Verifier 跨多个模型协作。它从每次成功和失败中学习，每周改进。开源，Vercel 免费部署，用你自己的 API key。

---

## 它能做什么

### 多轮编排

AetherWeaver 不只是选一个模型就完事。对复杂任务，它跑一个协调的多轮流水线：

```
请求 → Thinker（分析 & 规划）→ Worker（执行）→ Verifier（检查 & 接受/重试）
```

- **自适应深度**：简单问题 1 轮。复杂代码/数学/推理 2-4 轮。
- **预算保护**：每请求有 token/成本/延迟上限。超时优雅降级——跳过 Verifier 返回 Worker 结果，不报错。
- **单一端点**：`model: "auto"`，剩下的协调器处理。

### 自我进化

AetherWeaver 从使用中改进。每次请求产生奖励信号——代码执行结果、数学答案匹配、或显式 👍/👎 反馈：

```
反馈 → 失败诊断（四维度分析）→ 每周重训（sep-CMA-ES，CPU 可跑）→ 更新的协调器权重（<100KB JSON）
```

协调器随时间学会更好的路由决策。不需要标注数据——可验证任务自动提供 ground truth。

### 智能上下文管理

多轮编排会膨胀上下文。AetherWeaver 的上下文构建器为每个角色组装优化过的 prompt，而不是把完整历史塞给每个模型：

- **感官过滤器**：丢弃无关轮次
- **话题聚合**：按对话阶段语义聚类
- **按角色组装**：Thinker 看到问题+计划，Worker 看到计划+证据，Verifier 看到输出+标准

4 轮编排的上下文开销 = ~1.5-2 倍单轮调用，不是 4 倍。

### 随处部署，自带 Key

```bash
git clone https://github.com/inoribea/AetherWeaver.git && cd AetherWeaver
yarn install && cp .env.example .env.local
yarn dev   # localhost:3000
yarn deploy  # Vercel（免费 Hobby 层）
```

一条命令到生产。你自己的 OpenAI / Anthropic / Google / DeepSeek / Qwen / Hunyuan key。你自己的基础设施。你的数据不经过任何第三方编排服务。

---

## 核心优势

**学出来的路由，不是静态规则。** 协调器通过无梯度进化（sep-CMA-ES）在实际使用结果上训练。不需要人工调参，自己变聪明。

**多轮协作，零配置复杂度。** 一个 `model: "auto"` 调用触发 Thinker → Worker → Verifier 协作。不需要工作流 DSL，不需要配置 agent 框架。

**完全透明。** 路由决策、模型选择、置信度、每轮 trace 全部记录到 Langfuse。协调器权重是 <100KB 的 JSON 文件——可审查、可版本化、可审计。

**自我改进，无需数据标注。** 代码执行通过/失败和数学答案匹配自动提供干净的奖励信号。用户反馈是可选的、附加的。

**免费且开源。** MIT 许可证。Vercel Hobby 层。没有席位费，没有 output token 计价，没有供应商锁定。

---

## 快速开始

```bash
git clone https://github.com/inoribea/AetherWeaver.git
cd AetherWeaver
yarn install
cp .env.example .env.local
```

最少配置：

```env
OPENAI_API_KEY=sk-...
# 或 GOOGLE_API_KEY=...
# 或 NEKO_API_KEY=... + NEKO_BASE_URL=...
```

```bash
yarn dev   # → http://localhost:3000
```

```bash
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"用 Rust 写一个无锁并发哈希表"}]}'
```

---

## 配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `ORCHESTRATION_MODE` | `adaptive` | `fast` / `standard` / `deep` / `adaptive` |
| `MAX_TURNS` | `4` | 单次请求最大编排轮数 |
| `ORCHESTRATION_TIMEOUT_MS` | `55000` | 超时（留 5s Vercel buffer） |
| `COORDINATOR_SIDECAR_URL` | — | 本地 Qwen3-0.6B，hidden-state 路由（100% Trinity 保真度） |
| `ENABLE_FEEDBACK` | `true` | 收集 👍/👎 反馈用于学习 |

---

## 可观测性

每个请求产生完整 Langfuse trace 树：

```
Request
├── Coordinator Decision — 模型、置信度、推理
├── Thinker — 模型、token、延迟
├── Worker
├── Verifier — 判决、原因
└── Feedback — 评分、自动验证、失败诊断
```

---

## 架构

```
app/api/v1/chat/completions/route.ts   ← OpenAI 兼容入口
utils/coordinator/                     ← embedder、classifier、bandit、sidecar
utils/orchestration/                   ← LangGraph 状态图、角色 prompt、上下文构建器
utils/feedback/                        ← 反馈存储、失败诊断
scripts/eval/                          ← 评估 harness（6 种策略 + expert baseline）
scripts/train/                         ← sep-CMA-ES 重训 + 定点优化
docker/coordinator-sidecar/            ← 可选 ONNX Qwen3-0.6B sidecar
```

---

## 文档

| 文档 | 内容 |
|---|---|
| [Trinity Orchestration Roadmap](docs/TRINITY_ORCHESTRATION_ROADMAP.md) | 完整实施计划 |
| [Deployment Guide](docs/vercel-guide.md) | Vercel 部署 |
| [API Usage](docs/chat_api_usage.md) | Chat API 参考 |

---

## 研究基础

- **Trinity** (Sakana AI, ICLR 2026) — 多轮协调器 + sep-CMA-ES 训练. [arXiv:2512.04695](https://arxiv.org/abs/2512.04695)
- **SkillForge** (Alibaba, SIGIR 2026) — 自进化 skill、失败诊断. [arXiv:2604.08618](https://arxiv.org/abs/2604.08618)
- **GAM** (BAAI) — JIT 编译式 agent 记忆. [arXiv:2511.18423](https://arxiv.org/abs/2511.18423)
- **LightMem** (Zhejiang Univ) — 三段式轻量记忆. [arXiv:2510.18866](https://arxiv.org/abs/2510.18866)

---

## License

MIT © AetherWeaver
