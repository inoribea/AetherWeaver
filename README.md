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

# 选项4: Claude (顶尖复杂任务)
CLAUDE_API_KEY="your-claude-api-key"
CLAUDE_BASE_URL="https://api.anthropic.com"
```

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 开始使用！

## 📚 主要功能模块说明

### 统一智能路由系统
支持多种智能路由策略，包括明确指定路由、视觉任务路由、推理任务路由、中文创作路由和复杂度阈值路由，自动选择最合适的模型。

### 智能降级机制
当首选模型不可用时，自动降级到备选模型，保证系统稳定性和高可用性。

### 智能结构化输出
支持自动选择最适合结构化输出的模型，方便数据提取和格式化。

### 智能代理
支持复杂多步骤任务的智能代理执行，提升任务处理能力。

### RAG 检索
集成向量数据库支持知识库问答和智能检索代理。

## 📄 接口规范与集成说明

### LangFuse 性能监控集成
- 集成LangFuse性能监控工具，监控接口调用和模型性能。
- 关键代码位置：`app/api/v1/chat/completions/route.ts`。
- 监控客户端封装：`utils/langfuseClient.ts`。
- 需配置环境变量：`LANGFUSE_API_URL`、`LANGFUSE_API_KEY`。

### LCEL接口规范
- 所有组件实现统一的LCEL接口，支持同步、异步、流式和批量调用。
- 统一环境变量加载方式，保证配置一致性。
- 详细接口方法签名和返回类型规范见 `docs/LCEL_Interface_Integration.md`。

### 记忆检索接口设计
- 请求参数和响应结果接口设计，支持流式和完整消息响应。
- 相关实现位于 `app/api/chat/retrieval_agents/route.ts`。

## 🔧 开发和调试

### 开发脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
npm run add-model    # 添加新模型
npm run test-router  # 测试路由系统
npm run models:list  # 查看可用模型
```

### 调试技巧

1. 查看控制台输出的详细路由信息
2. 使用 `npm run test-router` 验证路由准确性
3. 使用 `npm run models:list` 检查模型可用性

## 🚀 部署

### Vercel 部署

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

### Docker 部署

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

### 环境变量配置

```bash
# 必需的模型 API 密钥（至少一个）
GOOGLE_API_KEY="your-google-api-key"
OPENAI_API_KEY="your-openai-api-key"
DEEPSEEK_API_KEY="your-deepseek-api-key"

# Claude 独立配置（顶尖复杂任务处理）
CLAUDE_API_KEY="your-claude-api-key"
CLAUDE_BASE_URL="https://api.anthropic.com"

# 可选功能
TAVILY_API_KEY="your-tavily-api-key"  # 网络搜索
SUPABASE_URL="your-supabase-url"      # RAG 检索
LANGCHAIN_API_KEY="your-langsmith-key" # 追踪监控
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程

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
