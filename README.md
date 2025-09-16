# AetherWeaver: Unified LLM Routing & Orchestration Platform
[简体中文](README-CN.md)

AetherWeaver is a powerful, extensible platform for building advanced LLM applications. It provides a unified interface for multiple model providers, intelligent routing, RAG capabilities, and OpenAI-compatible endpoints.

## ✨ Key Features

- **Multi-Model Support**: Integrates with OpenAI, Google Gemini, Deepseek, Claude, and more.
- **Intelligent Routing**: Dynamically routes requests to the best-suited model based on task complexity and type (e.g., code, vision, reasoning).
- **Retrieval-Augmented Generation (RAG)**: Supports multiple embedding models (OpenAI, Cloudflare) and vector databases (Qdrant, Upstash, Pinecone).
- **OpenAI-Compatible API**: Drop-in replacement for OpenAI's API, allowing seamless integration with existing tools.
- **Observability**: Built-in integration with Langfuse for detailed tracing and monitoring.
- **Extensible Agents**: Build powerful agents with custom tools like web search.

## 🚀 Quick Start

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/inoribea/AetherWeaver.git
    cd AetherWeaver
    ```

2.  **Install dependencies**:
    ```bash
    yarn install
    ```

3.  **Configure environment variables**:
    ```bash
    cp .env.example .env.local
    ```
    Fill in your API keys in `.env.local`. At a minimum, you need one model provider API key (e.g., `OPENAI_API_KEY`).

4.  **Run the development server**:
    ```bash
    yarn dev
    ```

5.  **Open your browser** and navigate to `http://localhost:3000`.

## 🛠️ Configuration

The application is configured through environment variables. Key options include:

- `ANALYSIS_MODE`: Set to `rule_based` (default) for fast routing or `llm_enhanced` for more accurate, AI-powered routing.
- `EMBEDDING_PROVIDER`: Choose between `OpenAI` and `Cloudflare` for document embeddings.
- `QDRANT_URL` / `UPSTASH_VECTOR_REST_URL`: Configure your vector database connection.
- `LANGFUSE_SECRET_KEY`: Enable monitoring by providing your Langfuse secret key.

For a complete list of variables, see [docs/vercel-guide.md](docs/vercel-guide.md).

### OpenAI-compatible Providers (Generic)

This project supports any OpenAI-compatible provider using the pattern `<PREFIX>_API_KEY` + `<PREFIX>_BASE_URL` (e.g., `OPENAI`, `NEKO`, `O3`, `OPENROUTER`).

- Select default provider via `OPENAI_COMPAT_PROVIDER=<prefix>` (case-insensitive).
- If not set, the resolver tries: `OPENAI` → `NEKO` → `O3` → `OPENROUTER` → the first discovered pair in env.
- Official OpenAI does not require `OPENAI_BASE_URL`.
- You can also override per-route model pools with real model IDs defined in `models-config.json` (e.g., `BASIC_MODELS`, `STRUCTURED_OUTPUT_MODELS`).

Example:

```
# Choose default provider
OPENAI_COMPAT_PROVIDER=O3

# O3 provider
O3_API_KEY=your_o3_key
O3_BASE_URL=https://api.o3.fan/v1

# Route overrides (real model IDs from models-config.json)
BASIC_MODELS=Qwen/Qwen3-235B-A22B-search
STRUCTURED_OUTPUT_MODELS=Qwen/Qwen3-235B-A22B-search
```

OpenAI-compatible v1 endpoint auth (optional):

```
ENABLE_API_AUTH=true
LANGCHAIN_API_KEYS=user_key_1,user_key_2
# Callers must send: Authorization: Bearer <user_key>
```

See `.env.example` and [docs/vercel-guide.md](docs/vercel-guide.md) for more details.

## 📚 Documentation

- **[Project Overview](docs/SUMMARY.md)**: High-level summary of features and configuration.
- **[API Usage](docs/chat_api_usage.md)**: How to use the different chat APIs.
- **[RAG & Embeddings](docs/retrieval_interface.md)**: Details on configuring RAG.
- **[Smart Routing](docs/v1_decision_logic.md)**: In-depth explanation of the routing logic.
- **[Deployment Guide](docs/vercel-guide.md)**: Guide for deploying on Vercel.

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
