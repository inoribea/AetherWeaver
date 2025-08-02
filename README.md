# 项目数据库支持说明

本项目支持多种向量数据库和标准数据库，方便用户根据需求选择合适的存储方案。

## 新增支持的数据库

- **PineconeStore**  
  通过环境变量 `PINECONE_API_KEY`、`PINECONE_INDEX` 和 `PINECONE_ENVIRONMENT` 配置。  
  需要安装依赖：`@langchain/pinecone` 和 `@pinecone-database/pinecone`。  
  支持高并发批量请求，适合大规模向量检索。

- **Neon Postgres**  
  通过环境变量 `DATABASE_URL` 配置，使用 Neon 提供的无服务器 PostgreSQL。  
  需要安装依赖：`@neondatabase/serverless` 和 `@langchain/community`。  
  支持 pgvector 扩展，方便存储和查询向量。

- **UpstashVectorStore**  
  通过环境变量 `UPSTASH_VECTOR_REST_URL` 和 `UPSTASH_VECTOR_REST_TOKEN` 配置。  
  需要安装依赖：`@langchain/community` 和 `@upstash/vector`。  
## 部署指南

本项目支持在 Vercel 平台部署，详细部署步骤和环境变量配置请参考 
[Vercel 部署指南](docs/vercel_deployment_guide.md)。

该指南涵盖了如何配置 Pinecone、Neon Postgres 和 Upstash 向量数据库的环境变量，以及项目依赖安装和部署注意事项，帮助您快速完成项目上线。
  支持内置向量嵌入模型，也可使用 OpenAI Embeddings。

以上数据库支持已从项目中移除，相关环境变量和依赖请清理。

## 环境变量示例

请参考 `.env.example` 文件，配置对应的环境变量以启用所需数据库支持。

## 使用说明

在调用 `createVectorStore` 函数时，可通过传入参数选择使用的数据库类型：

```ts
const { vectorStore, provider } = await createVectorStore(documents, "pinecone");
// 或 "neon"、"upstash"、不传则使用默认内存存储
```

确保已正确配置对应数据库的环境变量，并安装相关依赖。

## 依赖安装示例

```bash
npm install @langchain/pinecone @pinecone-database/pinecone @langchain/community @neondatabase/serverless @upstash/vector
```

## 备注

- 本项目默认优先使用 Cloudflare Embeddings，若无则使用 OpenAI Embeddings。  
- 请根据实际部署环境（如 Vercel）配置环境变量，确保数据库连接正常。  
- 详细使用请参考项目文档和各数据库官方文档。
# 🤖 LangChain + Next.js 统一智能路由系统

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/langchain-ai/langchain-nextjs-template)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flangchain-ai%2Flangchain-nextjs-template)

这是一个基于 LangChain.js + Next.js 的**统一智能路由系统**，具有**零提示词消耗**的智能路由、语义分析和动态模型切换能力。

## 🌟 核心特性

### 🎯 统一智能路由架构
- **语义分析路由** - 基于自然语言理解的智能路由决策
- **能力匹配路由** - 根据任务需求匹配具备相应能力的模型
- **明确指定路由** - 支持用户明确指定使用特定模型
- **智能降级链** - 当首选模型不可用时自动降级到备选模型
- **复杂度阈值路由** - 根据任务复杂度自动选择合适模型等级
- **环境变量动态配置** - 支持通过环境变量灵活调整路由模型映射和四路径模型选项，适配Vercel部署

### 🚀 智能模型路由系统
- **零提示词消耗** - 基于算法的智能路由，节省 60%+ 成本
- **毫秒级决策** - 平均 50ms 路由时间，提升 80%+ 响应速度
- **11种核心能力** - 覆盖视觉、推理、代码、搜索等所有场景
- **多维度评分** - 能力、成本、速度、质量综合考虑

### 🔧 零代码模型管理
- **统一路由器** - 集成所有路由逻辑的核心架构
- **动态模型注册** - 运行时添加新模型无需重启
- **配置热重载** - 实时更新模型配置和路由规则
- **Web 管理界面** - 可视化模型配置和监控

## 🧩 依赖模型决策路由说明

本项目采用多层次依赖模型决策路由机制，结合规则分析与大语言模型（LLM）增强，实现智能路由选择：

- **规则分析**：基于关键词和上下文对用户输入进行初步分类，识别任务类型（如agent、rag、enhanced等）。
- **LLM增强**：在规则分析基础上，调用大语言模型对路由决策进行置信度评估和优化，提升准确率。
- **置信度阈值判断**：根据置信度判断是否接受当前路由，若置信度不足则逐级升级路由策略，确保选择最合适的模型路径。
- **多轮重试机制**：支持多次重试和升级，最终返回最优路由结果，保证系统稳定性和智能性。
- **环境变量配置支持**：通过环境变量如`LANGFLOW_ROUTER_ROUTE_SIMILARITIES`等动态调整路由关键词映射和匹配策略，支持Vercel环境灵活管理。

## 🔄 复杂模型决策四路径

项目中定义了四条核心模型决策路径，分别对应不同复杂度和任务类型：

1. **Basic（基础路径）**  
   适用于简单、通用的任务，响应速度快，资源消耗低。

2. **Enhanced（增强路径）**  
   针对需要更复杂分析和生成的任务，结合更多上下文和专业知识。

3. **RAG（检索增强生成路径）**  
   结合向量数据库和知识库检索，适合需要外部知识支持的问答和信息检索任务。

4. **Agent（智能代理路径）**  
   支持多步骤任务执行和工具调用，适合复杂计算、操作和多任务协同。

路由器根据输入内容和置信度动态选择上述路径，支持从基础到复杂的逐级升级，确保任务得到最合适的处理。

## 🚀 数据库和向量存储支持

本项目支持多种数据库和向量存储方案，满足不同部署需求：

- **PineconeStore**：云端向量数据库，适合大规模、高性能检索。
- **Neon Postgres**：基于Postgres的云数据库，支持向量扩展。
- **UpstashVectorStore**：基于Redis的云向量存储，支持快速访问。
- **Qdrant**：本地向量数据库，作为后备和本地开发环境使用。
- **Redis**：标准Redis数据库，作为后备数据库支持。

### 环境变量配置示例

请在项目根目录创建或更新`.env.local`文件，添加：

```bash
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
NEON_CONNECTION_STRING=your-neon-connection-string
UPSTASH_VECTOR_URL=your-upstash-vector-url
UPSTASH_VECTOR_TOKEN=your-upstash-vector-token
QDRANT_URL=your-qdrant-url
REDIS_URL=your-redis-url
REDIS_TOKEN=your-redis-token
```

确保在部署环境（如Vercel）中也配置相应环境变量。

## 🔧 新增工具集成说明

### Tavily 搜索工具

- 依赖包：`@langchain/tavily`
- 环境变量配置：
  ```bash
  TAVILY_API_KEY=your-tavily-api-key
  ```
- 功能：为AI代理提供实时、准确的搜索结果，支持多参数配置。
- 使用示例：在聊天API中根据路由调用`TavilySearch`工具进行搜索。

### WebBrowser 工具

- 依赖包：`langchain/tools/webbrowser`，需安装`cheerio`和`axios`
- 环境变量配置：
  ```bash
  OPENAI_API_KEY=your-openai-api-key
  ```
- 功能：允许代理访问网页并提取信息，支持网页摘要和基于向量存储的相关内容检索。
- 使用示例：在聊天API中根据路由调用`WebBrowser`工具访问网页并返回摘要。

### 依赖安装

```bash
yarn add @langchain/tavily cheerio axios
```

## 🚀 快速开始

1. 安装依赖
2. 配置环境变量
3. 启动项目，使用聊天接口时根据路由自动调用对应工具

## 🙏 致谢

感谢 [LangChain](https://langchain.com) 和 [Vercel](https://vercel.com) 团队提供的优秀工具和平台。

---
