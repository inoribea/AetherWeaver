# Vercel 部署与环境变量配置指南

本指南专注于在 Vercel 平台上部署本项目时，环境变量的细节配置和管理。

## 1. 重要环境变量

- `VERCEL_REGION`  
  指定部署区域，常见区域如 `iad`（弗吉尼亚），`sfo`（旧金山）等  
  **示例：** `VERCEL_REGION=iad`

- `VERCEL_FUNCTION_TIMEOUT`  
  函数最大执行时间，单位秒，默认30秒  
  **示例：** `VERCEL_FUNCTION_TIMEOUT=30`

- `VERCEL_ENV`  
  当前部署环境标识，如：`production` / `preview` / `development`  
  **示例：** `VERCEL_ENV=production`

- `VERCEL_APP_NAME`  
  应用命名，有助于环境区分和日志识别  
  **示例：** `VERCEL_APP_NAME=langchain-vercel-app`

## 2. API Key管理

建议通过 Vercel Dashboard 的 Environment Variables 页面统一设置所有 API Keys，比如：

- `OPENAI_API_KEY`  
- `LANGCHAIN_API_KEY`  
- `TAVILY_API_KEY`  
- 其他第三方服务API Key

## 3. JSON 配置字符串环境变量

复杂配置，比如智能路由配置`LANGFLOW_SMART_ROUTING_CONFIG`等，建议以字符串形式上传，保持JSON格式正确。

## 4. 安全及注意事项

- 严格保密所有密钥，不要硬编码到代码库。  
- 使用 Vercel 的加密存储功能。  
- 确保配置的变量与本地`.env`文件保持同步，避免部署异常。

---

请根据本指南配置环境变量，确保项目部署运行稳定。