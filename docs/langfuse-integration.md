# LangFuse 性能监控集成说明

## 目的
本项目集成了LangFuse性能监控工具，用于监控接口调用和模型性能，提升系统的可观测性和调试能力。

## 集成方式
- 通过HTTP API调用LangFuse服务，发送关键事件数据。
- 在`app/api/v1/chat/completions/route.ts`中关键位置插入监控事件发送代码。
- 事件包括请求开始、模型选择、内部API调用耗时等。

## 环境变量配置
- `LANGFUSE_API_URL`：LangFuse服务的API地址。
- `LANGFUSE_API_KEY`：访问LangFuse服务的API密钥。

请确保在部署环境（如Vercel）中正确配置以上环境变量。

## 代码位置
- 监控客户端封装在`utils/langfuseClient.ts`。
- 主要监控逻辑在`app/api/v1/chat/completions/route.ts`的`POST`函数中。

## 使用说明
- 监控事件自动发送，无需额外调用。
- 可通过LangFuse控制台查看性能数据和调用链路。

## 注意事项
- 确保网络环境允许访问LangFuse API。
- 保护好API密钥，避免泄露。