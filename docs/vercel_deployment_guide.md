# Vercel 部署指南

本指南介绍如何在 Vercel 平台上部署本项目，并配置支持的数据库和环境变量。环境变量已按分类规范整理，方便配置和管理。

## 环境变量配置

请在 Vercel 项目的环境变量设置中添加以下变量：

### Pinecone 向量数据库
- `PINECONE_API_KEY`（必填）：Pinecone API 密钥
- `PINECONE_INDEX`（必填）：Pinecone 索引名称
- `PINECONE_ENVIRONMENT`（选填）：Pinecone 环境

### Neon Postgres 数据库
- `DATABASE_URL`（必填）：Neon Postgres 连接字符串，格式示例：
  ```
  postgresql://user:password@host:port/database?schema=public
  ```

### Upstash 向量数据库
- `UPSTASH_VECTOR_REST_URL`（必填）：Upstash 向量数据库 REST URL
- `UPSTASH_VECTOR_REST_TOKEN`（必填）：Upstash 向量数据库访问令牌

### 主模型 API 密钥
- `OPENAI_API_KEY`（必填）：用于 OpenAI API 密钥

### 其他基础配置
- `VERCEL_APP_URL`：应用基础 URL
- `APP_TITLE`：应用标题

### 模型 API 密钥配置
- 包含 Google Gemini、OpenAI、DeepSeek、阿里云通义千问、Neko、Claude、OpenRouter、腾讯混元、Cloudflare Workers AI 等多种模型的 API 密钥配置，详见 `.env.example` 文件。

### 统一智能路由系统配置
- 包括路由功能开关、路由决策配置、复杂度阈值模型优先级配置等。

### 高级功能配置
- 网络搜索、内存和持久化、监控和日志、性能和限制、安全配置、功能开关、语言优化、开发和测试配置等。

## 依赖安装

项目已包含所需依赖，Vercel 会自动安装。确保 `package.json` 中包含：

```json
"dependencies": {
  "@langchain/pinecone": "...",
  "@pinecone-database/pinecone": "...",
  "@langchain/community": "...",
  "@neondatabase/serverless": "...",
  "@upstash/vector": "...",
  "@langchain/openai": "..."
}
```

## 部署步骤

1. 将项目代码推送到 GitHub 或其他代码仓库。
2. 在 Vercel 创建新项目，连接代码仓库。
3. 在 Vercel 项目设置中配置上述环境变量。
4. 部署项目，Vercel 会自动构建并启动。
5. 访问部署的应用，确认数据库连接正常。

## 注意事项

- 确保环境变量配置正确，避免连接失败。
- 根据实际需求选择使用的数据库类型，修改项目配置或调用参数。
- 监控 Vercel 部署日志，及时排查问题。

---

此指南适用于本项目当前版本，支持 Pinecone、Neon Postgres 和 Upstash 向量数据库，已移除 Chroma 和 Supabase 支持。环境变量配置已规范化，详见 `.env.example` 文件。
