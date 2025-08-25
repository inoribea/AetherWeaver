# Chat API 使用文档

## 概述
本文档介绍 `/api/chat` 接口的调用说明及相关模块功能，帮助开发者正确使用和集成聊天服务。

---

## 接口说明

### POST /api/chat

#### 请求体
- `message`: `string` 或者形如 `{ content: string }` 对象，聊天消息
- `sessionId`：可选，用户会话标识符

#### 返回值
- `response`: 生成的聊天回复字符串
- `routing`: 路由决策信息，包含实际调用模型及置信度
- `metadata`: 额外状态信息

#### 错误码
- `503`: 服务暂不可用，可能因请求参数无效或系统错误

---

## 输入校验规范
- `message` 字段必须是字符串，或者包含 `content` 字符串属性的对象。
- 系统内置参数校验，防止无效输入导致服务器错误。
- 推荐调用方严格按照上述格式构造请求体。

---

## 关键模块

### SmartRouterComponent
- 负责路由决策，将消息导向最合适的处理链。
- 接口：`invoke(BaseMessage): SmartRoutingResult`
- 输入需包含符合规范的消息对象。

### ModelManager
- 负责管理和获取当前使用的模型配置。
- 提供异步接口获取当前模型参数。

---

## 测试说明
- 已覆盖接口异常输入测试，保证健壮性。
- 支持多种消息格式输入。
- 支持接口集成测试环境。

---

## 使用示例

```bash
curl -X POST https://yourdomain/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好","sessionId":"abc123"}'
```

响应示例：

```json
{
  "response": "你好！有什么可以帮您的？",
  "routing": {
    "route": "basic",
    "confidence": 0.9,
    "model": "gpt-5"
  },
  "metadata": {
    "langchainjs_compatible": true,
    "vercel_ready": true
  }
}
```

---

## 未来建议
- 增加客户端参数校验方案
- 持续完善测试覆盖

