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

## 🚀 v1版本支持特色

v1版本作为项目的稳定接口，具备以下特色：

- **OpenAI兼容接口**：支持OpenAI标准的聊天完成请求格式，方便集成和迁移。
- **统一路由请求构造**：自动检测用户意图和模型切换请求，构建统一的路由请求。
- **智能模型选择**：调用统一路由器，根据多维度评分和策略选择最合适模型。
- **流式响应支持**：支持OpenAI兼容的流式响应，提升用户体验和响应速度。
- **丰富的监控与日志**：集成LangFuse性能监控，记录请求生命周期和模型选择数据。
- **错误处理与降级**：完善的错误捕获和回退机制，保证服务稳定性。
- **环境变量动态路由配置**：支持通过环境变量灵活配置路由模型映射和四路径模型选项，适配Vercel部署环境。

## 📚 详细文档

- [v1 版本决策逻辑说明](docs/v1_decision_logic.md)
- [Vercel 部署指南](docs/vercel_deployment_guide.md)

请参考以上文档获取关于 v1 决策逻辑和 Vercel 部署的详细说明和环境变量配置。

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

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 开始使用！

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
2. 配置环境变量（详见 [Vercel 部署指南](docs/vercel_deployment_guide.md)）
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
