# v1 版本决策逻辑说明

本文档详细介绍了项目 v1 版本中的智能决策逻辑及相关环境变量配置，帮助用户理解和配置系统的智能路由和模型选择机制。

## 决策逻辑概述

v1 版本采用统一的智能路由请求构造机制，结合多维度模型切换意图检测和统一路由器决策，实现高效、准确的模型选择：

- **模型切换意图检测**：通过解析用户输入，自动识别是否存在模型切换请求，支持用户显式或隐式指定模型。
- **统一路由请求构造**：将用户请求转换为统一格式，包含消息、用户意图、上下文信息、工具列表等。
- **智能路由器决策**：调用统一路由器，根据任务类型、复杂度、模型能力等多维度评分，选择最合适的模型。
- **置信度与策略反馈**：路由器返回模型选择结果、置信度及决策策略，供后续调用和监控使用。
- **流式响应支持**：支持OpenAI兼容的流式响应，提升交互体验。

## 相关环境变量

| 变量名              | 说明                         | 是否必需 | 示例值                          |
|---------------------|------------------------------|----------|--------------------------------|
| GOOGLE_API_KEY       | Google Gemini API 密钥        | 是       | your-google-api-key             |
| OPENAI_API_KEY       | OpenAI API 密钥               | 是       | your-openai-api-key             |
| DEEPSEEK_API_KEY     | DeepSeek API 密钥（中文友好） | 是       | your-deepseek-api-key           |
| CLAUDE_API_KEY       | Claude API 密钥               | 是       | your-claude-api-key             |
| CLAUDE_BASE_URL      | Claude API 基础 URL           | 是       | https://api.anthropic.com       |
| LANGFUSE_API_URL     | LangFuse 监控服务地址         | 否       | https://api.langfuse.com        |
| LANGFUSE_API_KEY     | LangFuse API 密钥             | 否       | your-langfuse-api-key           |
| TAVILY_API_KEY       | 网络搜索服务 API 密钥         | 否       | your-tavily-api-key             |
| SUPABASE_URL        | RAG 检索数据库地址            | 否       | your-supabase-url               |

## 使用建议

- 确保至少配置一个主要模型的API密钥，保证系统正常运行。
- 根据业务需求配置可选环境变量，启用监控、检索和搜索功能。
- 结合统一路由器的日志和监控，调整模型配置和路由策略，优化性能和成本。

---
