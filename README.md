# 🤖 LangChain + Next.js 智能路由系统

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/langchain-ai/langchain-nextjs-template)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flangchain-ai%2Flangchain-nextjs-template)

这是一个基于 LangChain.js + Next.js 的智能模型路由系统，具有**零提示词消耗**的智能路由和动态模型切换能力。

## 🌟 核心特性

### 🚀 **智能模型路由系统**
- **零提示词消耗** - 基于算法的智能路由，节省 60%+ 成本
- **毫秒级决策** - 平均 2-3ms 路由时间，提升 80%+ 响应速度
- **11种路由目标** - 覆盖视觉、推理、代码、搜索等所有场景
- **多维度评分** - 能力、成本、速度、质量综合考虑

### 🔧 **零代码模型管理**
- **命令行工具** - `npm run add-model` 交互式添加模型
- **配置文件驱动** - 编辑 JSON 文件即可添加模型
- **Web 管理界面** - 可视化模型配置和监控
- **热配置更新** - 无需重启即可添加/删除模型

### 🎯 **支持的用例**
- [智能路由聊天](/app/api/chat/route.ts) - 自动选择最佳模型
- [结构化输出](/app/api/chat/structured_output/route.ts) - 格式化数据提取
- [智能代理](/app/api/chat/agents/route.ts) - 复杂多步骤任务
- [RAG 检索](/app/api/chat/retrieval/route.ts) - 知识库问答
- [RAG 代理](/app/api/chat/retrieval_agents/route.ts) - 智能检索代理

## 🚀 快速开始

### 1. 克隆和安装

```bash
git clone <repository-url>
cd langchain-nextjs-template
npm install
```

### 2. 环境配置

复制 `.env.example` 到 `.env.local` 并配置 API 密钥：

```bash
cp .env.example .env.local
```

**最少配置（选择一个）：**
```bash
# 选项1: Google Gemini (推荐，成本低)
GOOGLE_API_KEY="your-google-api-key"

# 选项2: OpenAI
OPENAI_API_KEY="your-openai-api-key"

# 选项3: DeepSeek (中文友好)
DEEPSEEK_API_KEY="your-deepseek-api-key"
```

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 开始使用！

## 🤖 智能路由系统

### **自动模型选择**

系统会根据用户输入自动选择最佳模型：

```typescript
// 用户输入: "请分析这张图片"
// 🎯 路由结果: vision_processing -> gpt-4o-all

// 用户输入: "用Python写一个快速排序"
// 🎯 路由结果: code_generation -> deepseek-chat

// 用户输入: "你好，请用中文聊天"
// 🎯 路由结果: chinese_conversation -> qwen-turbo
```

### **路由目标类型**

| 目标类型 | 描述 | 触发词示例 | 推荐模型 |
|---------|------|-----------|----------|
| 🖼️ `vision_processing` | 图像分析 | 图片、image、分析图 | gpt-4o-all, claude-sonnet-4-all |
| 🧠 `complex_reasoning` | 复杂推理 | 推理、分析、解决问题 | deepseek-reasoner, claude-sonnet-4-all |
| 💻 `code_generation` | 代码生成 | 代码、编程、算法 | deepseek-chat, gpt-4o-all |
| 🇨🇳 `chinese_conversation` | 中文对话 | 中文、汉语 | qwen-turbo, deepseek-chat |
| 🔍 `web_search` | 网络搜索 | 搜索、最新、当前 | gemini-flash, gpt-4o-all |
| 🔢 `mathematical_computation` | 数学计算 | 数学、计算、公式 | deepseek-reasoner, gpt-4o-all |
| 📊 `structured_analysis` | 结构化分析 | 格式化、JSON、提取 | gpt-4o-all, gemini-flash-lite |
| ✍️ `creative_writing` | 创意写作 | 创作、故事、写作 | claude-sonnet-4-all, gpt-4o-all |
| 🤖 `agent_execution` | 智能代理 | 任务、步骤、工具 | gpt-4o-all, claude-sonnet-4-all |
| 📚 `document_retrieval` | 文档检索 | 文档、知识库、RAG | gemini-flash, claude-sonnet-4-all |
| 💬 `simple_chat` | 简单聊天 | 聊天、你好、hello | o4-mini, deepseek-chat |

## 🔧 模型管理

### **方法1: 命令行工具（推荐）**

```bash
# 交互式添加模型
npm run add-model

# 测试路由系统
npm run test-router

# 查看可用模型
npm run models:list

# 重新加载配置
npm run models:reload
```

### **方法2: 配置文件**

编辑 `models-config.json`：

```json
{
  "models": {
    "your-new-model": {
      "type": "openai_compatible",
      "config": {
        "apiKey": "YOUR_API_KEY_ENV_VAR",
        "model": "your-model-id",
        "temperature": 0.7
      },
      "capabilities": {
        "vision": true,
        "reasoning": true,
        "chinese": true,
        "code_generation": true
      },
      "priority": {
        "vision_processing": 1,
        "chinese_conversation": 2
      },
      "cost_per_1k_tokens": 0.001,
      "speed_rating": 9,
      "quality_rating": 8
    }
  }
}
```

### **方法3: Web 管理界面**

访问 [http://localhost:3000/admin/models](http://localhost:3000/admin/models) 进行可视化管理。

### **方法4: API 调用**

```bash
# 添加模型
curl -X PUT http://localhost:3000/api/admin/models \
  -H "Content-Type: application/json" \
  -d '{"modelName": "new-model", "modelConfig": {...}}'

# 删除模型
curl -X DELETE "http://localhost:3000/api/admin/models?model=model-name"
```

## 🎯 高级功能

### **OpenAI 兼容 API**

系统提供完整的 OpenAI 兼容 API：

```bash
# 聊天完成
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# 获取模型列表
curl http://localhost:3000/api/v1/models \
  -H "Authorization: Bearer your-api-key"
```

### **结构化输出**

```typescript
// 自动检测需要结构化输出的请求
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [
      { role: 'user', content: '请提取以下文本的关键信息并格式化为JSON' }
    ],
    model: 'auto'  // 自动选择支持结构化输出的模型
  })
});
```

### **智能代理**

配置 `TAVILY_API_KEY` 启用网络搜索功能：

```bash
TAVILY_API_KEY="your-tavily-api-key"
```

### **RAG 检索**

配置 Supabase 或其他向量数据库：

```bash
SUPABASE_URL="your-supabase-url"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## 📊 性能监控

### **路由性能**

```bash
npm run test-router
```

输出示例：
```
🧪 智能路由器测试
==================
📋 可用模型: gpt-4o-all, deepseek-chat, qwen-turbo, gemini-flash
✅ 通过: 9/9 (100.0%)
⚡ 平均路由时间: 2.34ms
🚀 每秒可处理: 427 个请求
```

### **详细日志**

```bash
# 启用详细日志
DEBUG=intelligent-router npm run dev
```

## 🌍 支持的模型提供商

| 提供商 | 模型示例 | 环境变量 | 特殊能力 |
|--------|---------|----------|----------|
| 🤖 OpenAI | gpt-4o, gpt-4o-mini | `OPENAI_API_KEY` | 视觉、工具调用 |
| 🔥 DeepSeek | deepseek-chat, deepseek-reasoner | `DEEPSEEK_API_KEY` | 推理、中文、代码 |
| 🌟 Alibaba | qwen-turbo, qvq-plus | `DASHSCOPE_API_KEY` | 中文、视觉 |
| 🎯 Google | gemini-flash, gemini-flash-lite | `GOOGLE_API_KEY` | 搜索、工具调用 |
| 🚀 Claude | claude-sonnet-4-all | `NEKO_API_KEY` | 创意写作、分析 |

## 📦 Bundle 大小

经过优化的 bundle 大小：

- **LangChain 核心**: 37.32 KB (压缩后)
- **智能路由器**: 12.5 KB (压缩后)
- **总计**: < 4% Vercel 免费额度

```bash
# 分析 bundle 大小
ANALYZE=true npm run build
```

## 🔧 开发和调试

### **开发脚本**

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
npm run add-model    # 添加新模型
npm run test-router  # 测试路由系统
npm run models:list  # 查看可用模型
```

### **调试技巧**

1. **路由决策日志**：查看控制台输出的详细路由信息
2. **性能测试**：使用 `npm run test-router` 验证路由准确性
3. **配置验证**：使用 `npm run models:list` 检查模型可用性

## 🚀 部署

### **Vercel 部署**

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

### **Docker 部署**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### **环境变量配置**

生产环境需要配置的关键变量：

```bash
# 必需的模型 API 密钥（至少一个）
GOOGLE_API_KEY="your-google-api-key"
OPENAI_API_KEY="your-openai-api-key"
DEEPSEEK_API_KEY="your-deepseek-api-key"

# 可选功能
TAVILY_API_KEY="your-tavily-api-key"  # 网络搜索
SUPABASE_URL="your-supabase-url"      # RAG 检索
LANGCHAIN_API_KEY="your-langsmith-key" # 追踪监控
```

## 📚 了解更多

### **相关文档**

- [LangChain.js 文档](https://js.langchain.com/docs/)
- [智能路由系统详细说明](./INTELLIGENT-ROUTER.md)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)

### **架构设计**

- **智能路由器**: `utils/intelligent-router.ts`
- **模型配置**: `models-config.json`
- **主聊天路由**: `app/api/chat/route.ts`
- **管理界面**: `app/admin/models/`

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### **开发流程**

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 运行测试：`npm run test-router`
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢 [LangChain](https://langchain.com) 和 [Vercel](https://vercel.com) 团队提供的优秀工具和平台。

---

**🎉 立即开始使用智能路由系统，体验零提示词消耗的智能模型切换！**

如有问题，请访问 [GitHub Issues](https://github.com/langchain-ai/langchain-nextjs-template/issues) 或联系 [@LangChainAI](https://twitter.com/langchainai)。
