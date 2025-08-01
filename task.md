# 智能路由修改计划
根据根目录下的langflowjs.md（文件庞大注意节省token去阅读）

## 1. 智能路由整体流程
- 分析 SmartRouterComponent 的核心逻辑，包括输入预处理、规则分析、LLM增强、置信度判断及重试机制。
- 理解 SmartRouterComponent 输出的路由结构及接口。
- 梳理 ModelSelectorComponent 的模型选择策略，包括轮询、加权、负载均衡、回退和A/B测试。
- 理解 AgentPromptComponent 的提示词构建，结合路由上下文、记忆、工具结果和文档。
- 分析 EnhancedConditionalRouter 的路由匹配策略，支持多种匹配方式、置信度阈值、记忆加权和阻塞逻辑。
- 明确四组件间数据流和调用关系，形成整体管道。

## 2. 补充功能设计
- 设计记忆支持方案，支持多种记忆格式，集成到路由决策和提示词构建。
- 设计路由回退逻辑，基于置信度阈值和重试，逐步升级路由模式。
- 设计语言检测和多语言支持，确保中文用户使用中文交互。
- 设计环境适配，支持 Vercel 部署和 LangChain.js 兼容。

## 3. 模型选择集成与回退
- 多模型配置，支持启用状态、权重、提供商。
- 设计多种选择策略，含性能统计和动态调整。
- 设计回退机制，确保模型不可用时自动切换。

## 4. 代理提示集成与上下文
- 提示词模板管理，支持基础和动态适应。
- 集成路由上下文、记忆、工具结果、文档。
- 支持多语言提示词优化，特别中文。
- 支持 LangChain.js 兼容格式和流式输出。

## 5. 条件路由匹配与阻塞
- 多匹配策略：精确、元数据优先、置信度感知、智能灵活、LangChain.js兼容。
- 置信度阈值和记忆加权，动态调整匹配。
- 阻塞和放行逻辑，基于匹配结果控制消息流。
- 支持重试和任务重指派。
- 支持 Vercel 和 LangChain.js 兼容。

## 6. 单元测试计划
- SmartRouterComponent 输入输出测试，覆盖规则和LLM分析、置信度判断、重试。
- ModelSelectorComponent 策略测试，覆盖所有选择和回退。
- AgentPromptComponent 提示词构建测试，覆盖多语言和上下文。
- EnhancedConditionalRouter 匹配和阻塞测试，覆盖多场景。
- 集成测试，验证四组件协同和数据流。

## 7. 文档更新计划
- 补充组件使用说明，详细接口和配置。
- 说明整体架构和数据流。
- 介绍补充功能设计和使用。
- 提供示例配置和应用场景。
- 更新部署和兼容说明，含 Vercel 和 LangChain.js。

## 额外
已获取 langflowjs.md 中大量组件代码，主要包括：

OptimizedSmartRoutingFunction：智能路由组件，包含路由分析、LLM增强分析、规则分析、路由决策输出等，支持多种路由模式（basic, enhanced, rag, agent），并有记忆和重指派机制。
OptimizedEnhancedConditionalRouter：条件路由组件，支持多种匹配策略、记忆支持、重指派检测、路由匹配和阻塞逻辑。
AgentPromptComponent：智能代理提示词组件，支持记忆、工具、文档上下文，动态生成提示词，兼容多种格式。
CustomLanguageModelComponent：主语言模型组件，支持多模型选择、负载均衡、降级、A/B测试，支持多种模型提供商，支持路由参数调整，兼容LCEL和LangChain.js。
其他辅助方法和配置。
任务是基于这些导出组件代码，实现当前项目缺失的功能和回退逻辑。需要先分析当前项目中相关代码，找出缺失部分。
