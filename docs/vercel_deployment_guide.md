# Vercel 部署与环境变量配置指南

本文档详细介绍如何在 Vercel 平台部署本项目，配置环境变量，以及如何通过环境变量灵活调整决策路由模型映射和复杂模型决策的四路径模型选项。

---

## 一、项目部署指南

### 1. 部署准备

- 将项目代码推送到 GitHub 或其他代码仓库。
- 在 Vercel 创建新项目，连接代码仓库。

### 2. 依赖安装

项目已包含所需依赖，Vercel 会自动安装。确保 `package.json` 中包含以下依赖：

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

### 3. 部署步骤

1. 在 Vercel 项目设置中配置环境变量（详见各自环境变量配置）。
2. 部署项目，Vercel 会自动构建并启动。
3. 访问部署的应用，确认数据库连接正常。

### 4. 注意事项

- 确保环境变量配置正确，避免连接失败。
- 根据实际需求选择使用的数据库类型，修改项目配置或调用参数。
- 监控 Vercel 部署日志，及时排查问题。

---

## 二、普通 Chat 路径部署环境变量配置指南

请在 Vercel 项目环境变量设置中添加以下变量，适用于普通聊天接口（非 v1 路径）：

- OPENAI_API_KEY="your-openai-api-key"
- GOOGLE_API_KEY="your-google-api-key"
- DEEPSEEK_API_KEY="your-deepseek-api-key"
- DASHSCOPE_API_KEY="your-dashscope-api-key"
- NEKO_API_KEY="your-neko-api-key"
- NEKO_BASE_URL="your-neko-base-url"
- CLAUDE_API_KEY="your-claude-api-key"
- CLAUDE_BASE_URL="https://api.anthropic.com"
- O3_API_KEY="your-o3-api-key"
- O3_BASE_URL="your-o3-base-url"
- OPENROUTER_API_KEY="your-openrouter-api-key"
- OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
- TENCENT_HUNYUAN_SECRET_ID="your-tencent-secret-id"
- TENCENT_HUNYUAN_SECRET_KEY="your-tencent-secret-key"

高级功能及路由配置可参考 `.env.example` 文件，普通路由默认使用SmartRouterComponent和ModelManager控制模型选择。

---

## 三、v1 路径部署环境变量配置指南

v1 路径独立使用统一智能路由器，模型配置和决策逻辑依赖于 `models-config.json` 配置和统一路由器代码，相关环境变量如下：

- LANGCHAIN_API_KEYS="your_api_key_1,your_api_key_2"    # 多个API Key 用逗号分隔
- LANGCHAIN_API_KEY="your_default_api_key"                # 单个默认API Key
- LANGCHAIN_API_KEY_1="your_api_key_1"                    # 编号API Key 1
- LANGCHAIN_API_KEY_2="your_api_key_2"                    # 编号API Key 2
- ENABLE_API_AUTH="true"                                   # 是否启用API认证
- LANGCHAIN_ADMIN_KEY="your_admin_api_key"                 # 管理员Key
- OPENAI_API_KEY="your-openai-api-key"
- OPENAI_BASE_URL="https://url/v1"                         # 自定义OpenAI Base URL
- LANGFLOW_ROUTER_MODEL_NAME="gpt-4.1-nano"                # 统一路由器默认模型名

其他第三方API Key同普通chat一致配置。

### 路由功能开关及配置

- ENABLE_UNIFIED_ROUTING="true"              # 启用统一路由器
- ENABLE_INTELLIGENT_ROUTING="true"          # 启用智能路由决策
- ENABLE_MODEL_SWITCHING="true"               # 启用模型切换
- ENABLE_PERFORMANCE_MONITORING="true"       # 性能监控
- ROUTING_CONFIDENCE_THRESHOLD="0.7"         # 路由置信度阈值
- ROUTING_FALLBACK_MODEL="gpt-4o-all"         # 回退模型
- ROUTING_CACHE_TTL="300"                      # 路由缓存时间（秒）

### 分路由模型复杂度分类

- COMPLEXITY_HIGH_MODELS="claude-sonnet-4-all,gpt-4o-all,deepseek-reasoner,hunyuan-t1-latest"
- COMPLEXITY_MEDIUM_MODELS="gpt-4o-all,gemini-flash,qwen-turbo,hunyuan-turbos-latest,claude-sonnet-4-all"
- COMPLEXITY_LOW_MODELS="gemini-flash,qwen-turbo,hunyuan-turbos-latest,gpt-4o-all"

### 模型选择权重

- MODEL_SELECTION_CAPABILITY_WEIGHT="0.4"
- MODEL_SELECTION_COST_WEIGHT="0.3"
- MODEL_SELECTION_PERFORMANCE_WEIGHT="0.3"

---

## 四、配置 JSON 环境变量示例

示例：自定义 OpenAI Base URL 配置变量

- 变量名：`CUSTOM_LANGUAGE_COMPONENT_CONFIG`
- 变量值（单行 JSON 字符串）：

```json
{"openAI":{"baseUrl":"https://custom-openai.example.com/v1","apiKey":"your_openai_api_key"}}
```

---

## 五、环境变量配置管理建议

- 建议拆分复杂 JSON 配置为多个单独环境变量，便于调整和管理。
- 配置加载遵循合并覆盖规则，Vercel 环境注入专有参数。
- 确保格式合法，避免运行时加载失败。

---

## 六、总结

本指南拆分普通 Chat 路径与 v1 路径的环境变量配置，方便根据业务需求灵活调整和使用。v1路劲使用统一路由器进行智能模型调度，普通路径依赖传统模型管理组件。两者环境变量配置可共存也可分开管理。

---
