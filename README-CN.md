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