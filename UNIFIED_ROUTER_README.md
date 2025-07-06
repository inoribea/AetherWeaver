# 统一智能路由架构 (Unified Intelligent Router)

## 概述

统一智能路由架构是一个先进的AI模型路由系统，能够根据用户请求的语义内容、所需能力和上下文信息，智能地选择最合适的AI模型来处理任务。

## 🚀 核心特性

### 1. 智能路由策略
- **速度优先路由**: 默认优先选择 `gemini-flash-lite` 获得最快响应
- **语义分析路由**: 基于自然语言理解，分析用户意图
- **能力匹配路由**: 根据任务需求匹配具备相应能力的模型
- **明确指定路由**: 支持用户明确指定使用特定模型
- **降级链路由**: 当首选模型不可用时，自动降级到备选模型

### 2. 多维度模型评估
- **速度优化**: 系统默认开启速度优化，优先选择响应最快的模型
- **能力评估**: 视觉、推理、工具调用、结构化输出等
- **性能评估**: 速度、质量、成本综合考虑
- **可用性检测**: 实时检测模型服务状态
- **优先级排序**: 基于任务类型的模型优先级

### 3. 动态配置管理
- **热重载**: 支持运行时重新加载配置
- **动态注册**: 支持运行时添加新模型
- **配置验证**: 自动验证配置文件完整性
- **状态监控**: 实时监控模型状态和性能

## 📋 架构组件

### 核心模块

```
utils/unified-router.ts
├── UnifiedRouter (主路由器接口)
├── ModelRegistry (模型注册中心)
├── SemanticRouter (语义路由引擎)
├── FallbackChain (智能降级链)
└── IntelligentRouterUnified (统一路由器实现)
```

### 配置文件

```
models-config.json
├── models (模型定义)
├── routing_rules (路由规则)
├── selection_strategy (选择策略)
└── keywords (关键词映射)
```

## 🛠️ 使用方法

### 基本使用

```typescript
import { routeRequest, RoutingRequest } from '@/utils/unified-router';

// 构建路由请求
const request: RoutingRequest = {
  messages: [
    { role: 'user', content: '请分析这张图片' }
  ],
  capabilities: {
    vision: true
  }
};

// 执行智能路由
const decision = await routeRequest(request);
console.log(`选择的模型: ${decision.selectedModel}`);
console.log(`决策理由: ${decision.reasoning}`);
```

### 高级配置

```typescript
import { intelligentRouter } from '@/utils/unified-router';

// 注册新模型
intelligentRouter.registerModel({
  id: 'custom-model',
  type: 'openai_compatible',
  config: {
    apiKey: 'CUSTOM_API_KEY',
    baseURL: 'https://api.custom.com',
    model: 'custom-model-v1',
    temperature: 0.7
  },
  capabilities: {
    vision: true,
    reasoning: true
  },
  priority: {
    vision_processing: 1
  },
  cost_per_1k_tokens: 0.001,
  speed_rating: 9,
  quality_rating: 8
});

// 重新加载配置
await intelligentRouter.reloadConfiguration();
```

## 🎯 路由策略详解

### 1. 明确模型指定

当用户明确指定模型时，系统会直接使用指定的模型：

```
用户输入: "让Claude来分析这个问题"
路由结果: claude-sonnet-4-all
置信度: 0.95
```

### 2. 能力匹配路由

根据检测到的任务能力需求选择模型：

```
任务类型: 图片分析
需要能力: vision
候选模型: gpt-4o-all, qvq-plus, claude-sonnet-4-all
选择结果: gpt-4o-all (视觉任务首选)

任务类型: 一般对话
需要能力: 无特殊要求
选择结果: gemini-flash-lite (速度最快)
```

### 3. 语义分析路由

基于内容语义分析选择最合适的模型：

```
用户输入: "请详细分析量子计算原理"
检测意图: 复杂推理
选择模型: deepseek-reasoner
```

### 4. 降级链路由

当首选模型不可用时，自动降级：

```
首选模型: qvq-plus (不可用)
降级链: gpt-4o-all -> claude-sonnet-4-all -> gemini-flash
最终选择: gpt-4o-all
```

## 📊 支持的模型类型

### 🚀 速度优先模型
- `gemini-flash-lite`: **默认首选模型**，速度最快(10/10)，成本最低，适合大多数场景

### 🎯 视觉处理模型 (优先级排序)
1. `gpt-4o-all`: 视觉任务首选，全能模型
2. `qvq-plus`: 阿里通义视觉问答模型
3. `claude-sonnet-4-all`: 高质量视觉分析兜底

### 🧠 专业推理模型
- `deepseek-reasoner`: 专业推理模型，擅长复杂逻辑分析
- `hunyuan-t1-latest`: 腾讯混元推理模型

### 🌏 中文优化模型
- `qwen-turbo`: 阿里通义千问模型
- `hunyuan-turbos-latest`: 腾讯混元标准模型

### 🔍 搜索增强模型
- `gpt4.1`: 支持网络搜索的增强模型
- `gemini-flash`: Google Gemini 快速模型

## 🔧 配置说明

### 模型配置

```json
{
  "models": {
    "model-id": {
      "type": "openai_compatible",
      "config": {
        "apiKey": "API_KEY_ENV_VAR",
        "baseURL": "https://api.example.com",
        "model": "model-name",
        "temperature": 0.7
      },
      "capabilities": {
        "vision": true,
        "reasoning": true,
        "tool_calling": true,
        "structured_output": true
      },
      "priority": {
        "vision_processing": 1,
        "complex_reasoning": 2
      },
      "cost_per_1k_tokens": 0.005,
      "speed_rating": 8,
      "quality_rating": 9
    }
  }
}
```

### 路由规则

```json
{
  "routing_rules": {
    "vision_tasks": {
      "conditions": ["has_image", "vision_keywords"],
      "preferred_models": ["qvq-plus", "gpt-4o-all"],
      "fallback_models": ["gpt-4o-all"]
    }
  }
}
```

## 🧪 配置验证

### 验证配置

```bash
# 验证当前配置
node verify-config.js
```

### 配置验证输出示例

```
🎯 配置验证结果
================
默认模型: gemini-flash-lite
降级链: gemini-flash-lite -> gpt4.1 -> qwen-turbo -> deepseek-reasoner -> claude-sonnet-4-all
速度优化: true
质量优化: false

gemini-flash-lite 配置:
- 速度评分: 10
- 质量评分: 6
- 成本 (per 1k tokens): 0.00005

各任务的首选模型:
- vision_tasks: gpt-4o-all
- reasoning_tasks: gemini-flash-lite
- chinese_tasks: gemini-flash-lite
- search_tasks: gemini-flash-lite
- code_tasks: gemini-flash-lite
- creative_tasks: gemini-flash-lite
- structured_output: gemini-flash-lite
```

## 🔄 API 集成

### OpenAI 兼容 API

```bash
# 使用 auto 模型进行智能路由
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      {"role": "user", "content": "请分析这个复杂的数学问题"}
    ]
  }'
```

### 管理 API

```bash
# 重新加载模型配置
curl -X POST http://localhost:3000/api/admin/models/reload \
  -H "X-API-Key: your-admin-key"

# 获取模型状态
curl -X GET http://localhost:3000/api/admin/models \
  -H "X-API-Key: your-admin-key"
```

## 📈 性能优化

### 1. 缓存策略
- 模型可用性缓存
- 路由决策缓存
- 配置文件缓存

### 2. 负载均衡
- 基于模型负载的智能分发
- 成本优化路由
- 速度优化路由

### 3. 监控指标
- 路由决策时间
- 模型响应时间
- 成功率统计
- 成本分析

## 🛡️ 错误处理

### 降级机制
1. 主模型不可用 → 降级到备选模型
2. 路由决策失败 → 使用默认模型
3. 配置加载失败 → 使用内置配置

### 错误日志
```
❌ 路由决策失败: 模型 xyz 不可用
🔄 降级到模型: gpt-4o-all
✅ 请求处理成功
```

## 🔮 未来计划

### 短期目标
- [ ] 增加更多模型支持
- [ ] 优化路由算法
- [ ] 增强监控功能
- [ ] 性能基准测试

### 长期目标
- [ ] 机器学习路由优化
- [ ] 多模态任务路由
- [ ] 分布式路由架构
- [ ] 自适应学习能力

## 📚 相关文档

- [API 文档](./API_DOCS.md)
- [配置指南](./CONFIG_GUIDE.md)
- [故障排除](./TROUBLESHOOTING.md)
- [开发指南](./DEVELOPMENT.md)

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

## 📞 支持

如有问题或建议，请：
- 创建 GitHub Issue
- 发送邮件至 support@example.com
- 加入我们的 Discord 社区

---

**统一智能路由架构** - 让AI模型选择更智能，让用户体验更流畅！