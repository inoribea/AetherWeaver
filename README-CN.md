# AetherWeaver: 统一 LLM 路由与编排平台

AetherWeaver 是一个功能强大、可扩展的平台，用于构建先进的 LLM 应用。它为多个模型服务商提供了统一的接口、智能路由、RAG 功能以及 OpenAI 兼容的 API 端点。

## ✨ 主要特性

- **多模型支持**: 集成 OpenAI、Google Gemini、Deepseek、Claude 等多种大语言模型。
- **智能路由**: 根据任务的复杂度和类型（如代码、视觉、推理），将请求动态路由到最合适的模型。
- **检索增强生成 (RAG)**: 支持多种 Embedding 模型（OpenAI、Cloudflare）和向量数据库（Qdrant、Upstash、Pinecone）。
- **OpenAI 兼容 API**: 可作为 OpenAI API 的直接替代品，无缝集成现有工具生态。
- **可观测性**: 内置 Langfuse 集成，提供详细的请求追踪和监控。
- **可扩展的 Agent**: 支持构建带有自定义工具（如网络搜索）的强大 Agent。

## 🚀 快速开始

1.  **克隆代码仓库**:
    ```bash
    git clone https://github.com/inoribea/AetherWeaver.git
    cd AetherWeaver
    ```

2.  **安装依赖**:
    ```bash
    yarn install
    ```

3.  **配置环境变量**:
    ```bash
    cp .env.example .env.local
    ```
    在 `.env.local` 文件中填入你的 API 密钥。至少需要一个模型服务商的 API 密钥（例如 `OPENAI_API_KEY`）。

4.  **启动开发服务器**:
    ```bash
    yarn dev
    ```

5.  **打开浏览器** 并访问 `http://localhost:3000`。

## 🛠️ 配置

应用程序通过环境变量进行配置。关键选项包括：

- `ANALYSIS_MODE`: 设置为 `rule_based` (默认) 以进行快速路由，或 `llm_enhanced` 以实现更精准的、由 AI 驱动的路由。
- `EMBEDDING_PROVIDER`: 为文档嵌入选择 `OpenAI` 或 `Cloudflare`。
- `QDRANT_URL` / `UPSTASH_VECTOR_REST_URL`: 配置你的向量数据库连接。
- `LANGFUSE_SECRET_KEY`: 提供你的 Langfuse 密钥以启用监控。

完整的变量列表，请参阅 [docs/vercel-guide.md](docs/vercel-guide.md)。

### OpenAI 兼容提供商（通用）

本项目支持任意 OpenAI 格式的兼容提供商，按照 `<PREFIX>_API_KEY` + `<PREFIX>_BASE_URL` 的规则配置（例如：`OPENAI`、`NEKO`、`O3`、`OPENROUTER`）。

- 通过 `OPENAI_COMPAT_PROVIDER=<prefix>` 指定默认提供商（不区分大小写）。
- 未指定时，将按顺序尝试：`OPENAI` → `NEKO` → `O3` → `OPENROUTER` → 自动扫描环境中的第一对 `*_API_KEY/_BASE_URL`。
- 官方 OpenAI 可不设置 `OPENAI_BASE_URL`（使用官方默认域名）。
- 可用“路由模型池覆盖”变量将特定路由切换到第三方真实模型名（需在 `models-config.json` 中存在），如：`BASIC_MODELS`、`STRUCTURED_OUTPUT_MODELS`。

示例：

```
# 选择默认提供商
OPENAI_COMPAT_PROVIDER=

# O3 提供商
O3_API_KEY=your_o3_key
O3_BASE_URL=

# 路由覆盖（使用 models-config.json 中的真实模型名）
BASIC_MODELS=Qwen/Qwen3-235B-A22B-search
STRUCTURED_OUTPUT_MODELS=Qwen/Qwen3-235B-A22B-search
```

OpenAI 兼容 v1 端点鉴权（可选）：

```
ENABLE_API_AUTH=true
LANGCHAIN_API_KEYS=user_key_1,user_key_2
# 调用方需在请求头携带：Authorization: Bearer <user_key>
```

详细示例请参考 `.env.example` 与 [docs/vercel-guide.md](docs/vercel-guide.md)。

## 📚 文档

- **[项目总览](docs/SUMMARY.md)**: 功能和配置的高级摘要。
- **[API 用法](docs/chat_api_usage.md)**: 如何使用不同的聊天 API。
- **[RAG 与 Embedding](docs/retrieval_interface.md)**: 关于配置 RAG 的详细信息。
- **[智能路由](docs/v1_decision_logic.md)**: 对路由逻辑的深入解释。
- **[部署指南](docs/vercel-guide.md)**: 在 Vercel 上部署的指南。

## 🤝 贡献

欢迎参与贡献！请创建 Issue 或提交 Pull Request。

## 📄 许可证

本项目采用 MIT 许可证。详情请见 [LICENSE](LICENSE) 文件。
