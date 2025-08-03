# 项目说明与部署指南

## 1. 项目简介

本项目基于 LangChain.js 和 Next.js 构建，集成了统一智能路由系统，支持多模型动态切换、语义分析和能力匹配，具备零提示词消耗、高性能决策和多种任务处理路径。

## 2. 关键特性

- 多层次智能路由决策，结合规则和LLM强化判断
- 支持多模型配置和动态路由
- 支持向量数据库（Pinecone、Neon、Upstash、Qdrant等）
- 内置多种工具集成，支持复杂任务处理  
- 灵活环境变量配置，支持 Vercel 多环境部署

## 3. 部署指导

### 3.1 普通 Chat 路径部署

普通 Chat 路径使用 SmartRouterComponent 和 ModelManager 管理模型，环境变量配置见 `.env.example` 文件普通 Chat 部分。支持主流模型API Key的配置。

### 3.2 v1 路径部署

v1 路径依赖统一智能路由器，基于 `models-config.json` 及统一路由代码进行模型注册和选择。环境变量集中管理多API Key、路由功能开关及路由策略相关配置，支持复杂多模型调度。

详见 `docs/vercel_deployment_guide.md` 和 `.env.example` 文件中 v1 路径部分说明。

## 4. 环境变量说明

项目支持拆分配置，普通 Chat 路径与 v1 路径环境变量独立管理，方便运维和版本控制。

## 5. 参考文档

- Vercel 部署指南 `docs/vercel_deployment_guide.md`
- 环境变量示例 `.env.example`
- 统一路由器实现 `utils/unified-router.ts`
- Chat 路由实现 `app/api/chat/route.ts`
- v1 路由实现 `app/api/v1/chat/completions/route.ts`

## 6. 感谢

感谢 LangChain 社区和 Vercel 平台带来的强大支持。

---

更多内容请查看项目内详细文档。
