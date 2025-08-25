# Chat API 使用文档

## 概述
本文档介绍 `/api/chat` 及兼容 OpenAI 的 `/api/v1/chat/completions` 接口的调用说明，帮助开发者正确使用和集成聊天服务。

---

## 接口说明

### 1. POST /api/chat (原生接口)

#### 请求体
- `message`: `string` - 聊天消息。
- `sessionId`: `string` (可选) - 用户会话标识符。

#### 返回值
- `response`: `string` - 生成的聊天回复。
- `routing`: `object` - 路由决策信息，包含实际调用模型及置信度。

### 2. POST /api/v1/chat/completions (OpenAI 兼容接口)

#### 请求体
- `model`: `string` - 指定使用的模型名称。
- `messages`: `array` - OpenAI 格式的消息数组。
- `stream`: `boolean` (可选) - 是否启用流式响应，默认为 `false`。

#### 返回值
- 标准的 OpenAI `ChatCompletion` 或 `Stream` 对象。

---

## 关键模块

### 智能路由 (Smart Router)
- 负责路由决策，根据用户输入和预设规则，将请求导向最合适的模型或处理链。
- 支持 `rule_based` 和 `llm_enhanced` 两种分析模式，通过 `ANALYSIS_MODE` 环境变量配置。

### 模型管理器 (ModelManager)
- 负责管理和加载 `models-config.json` 中定义的所有模型配置。
- 支持通过环境变量覆盖特定任务的模型池。

---

## 使用示例

### 调用原生接口
```bash
curl -X POST https://your-domain/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好","sessionId":"user-123"}'
```

### 调用 OpenAI 兼容接口
```bash
curl -X POST https://your-domain/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "gpt-5-mini",
    "messages": [{"role": "user", "content": "你好！"}],
    "stream": false
  }'
```
