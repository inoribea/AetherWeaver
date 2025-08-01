# Vercel 部署指南

本指南介绍如何在 Vercel 平台上部署本项目，重点说明环境变量配置及动态路由模型映射的支持。

## 部署步骤

1. **连接 GitHub 仓库**  
   登录 Vercel，选择“New Project”，连接本项目的 GitHub 仓库。

2. **配置环境变量**  
   在 Vercel 项目设置中，添加以下环境变量：

   | 变量名                          | 说明                                   | 示例值                          |
   |---------------------------------|--------------------------------------|--------------------------------|
   | GOOGLE_API_KEY                   | Google Gemini API 密钥                  | your-google-api-key             |
   | OPENAI_API_KEY                  | OpenAI API 密钥                         | your-openai-api-key             |
   | DEEPSEEK_API_KEY                | DeepSeek API 密钥（中文友好）             | your-deepseek-api-key           |
   | CLAUDE_API_KEY                  | Claude API 密钥                         | your-claude-api-key             |
   | CLAUDE_BASE_URL                 | Claude API 基础 URL                     | https://api.anthropic.com       |
   | LANGFUSE_API_URL                | LangFuse 监控服务地址                   | https://api.langfuse.com        |
   | LANGFUSE_API_KEY                | LangFuse API 密钥                       | your-langfuse-api-key           |
   | TAVILY_API_KEY                  | 网络搜索服务 API 密钥                   | your-tavily-api-key             |
   | SUPABASE_URL                   | RAG 检索数据库地址                      | your-supabase-url               |
   | QDRANT_URL                      | Qdrant 向量数据库地址                   | http://localhost:6333            |
   | VERCEL_APP_URL                 | Vercel 应用的访问 URL                    | https://your-vercel-app.vercel.app |
   | VERCEL_ENV                     | Vercel 部署环境（如 production, preview, development）| production                     |
   | VERCEL_REGION                  | Vercel 部署区域                         | cdg1                           |
   | VERCEL_FUNCTION_TIMEOUT        | Vercel 函数执行超时时间（秒）             | 30                             |

3. **动态路由模型映射配置**  
   本项目支持通过环境变量动态配置决策路由的模型映射和复杂模型决策四路径对应模型选项，主要环境变量包括：

   - `LANGFLOW_ROUTER_ROUTE_SIMILARITIES`：JSON格式，定义四路径（basic, enhanced, rag, agent）对应的关键词数组，用于路由匹配。
   - `LANGFLOW_ROUTER_MATCHING_STRATEGIES`：JSON格式，配置匹配策略参数。
   - `LANGFLOW_ROUTER_CONFIDENCE_ADJUSTMENTS`：JSON格式，调整置信度相关参数。
   - `LANGFLOW_ROUTER_MEMORY_SUPPORT`：JSON格式，配置记忆支持相关参数。
   - `LANGFLOW_ROUTER_LANGCHAINJS_COMPATIBILITY`：JSON格式，配置LangChainJS兼容性参数。
   - `LANGFLOW_ROUTER_LCEL_CONFIGURATION`：JSON格式，配置LCEL相关参数。

   示例：

   ```json
   {
     "basic": ["simple", "easy", "quick", "fast"],
     "enhanced": ["complex", "advanced", "detailed", "deep", "sophisticated"],
     "rag": ["search", "retrieve", "document", "knowledge", "lookup"],
     "agent": ["tool", "execute", "action", "api"]
   }
   ```

4. **部署项目**  
   配置完成后，点击“Deploy”按钮，Vercel 会自动构建并部署项目。

5. **访问服务**  
   部署完成后，访问 Vercel 提供的域名即可使用智能路由系统。

## 相关说明

- 环境变量支持热更新，修改后无需重启即可生效。
- 建议结合监控日志调整路由模型映射和匹配策略，优化性能和成本。
- 确保所有必需API密钥正确配置，避免服务异常。

---
