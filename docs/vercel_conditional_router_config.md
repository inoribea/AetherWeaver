# 在 Vercel 环境中通过环境变量 LANGFLOW_CONDITIONAL_ROUTER_CONFIG 配置决策路由

本文档说明如何在 Vercel 部署环境中，通过设置环境变量 `LANGFLOW_CONDITIONAL_ROUTER_CONFIG` 来配置和调整 LangFlow 决策路由的模型映射及复杂模型决策的四路径模型选项。

---

## 1. 环境变量作用

`LANGFLOW_CONDITIONAL_ROUTER_CONFIG` 是一个 JSON 格式的字符串，用于覆盖默认的决策路由配置，主要包括：

- **matching_strategies**：定义多种路由匹配策略及其参数，影响模型如何匹配路由。
- **route_similarities**：定义路由名称与相似词的映射，用于模糊匹配和回退匹配。
- **confidence_adjustments**：置信度调整参数，如重新分配惩罚、回退提升等。
- **memory_support**：记忆相关的支持配置。
- **langchainjs_compatibility**：LangChain.js 兼容性相关配置。
- **lcel_configuration**：LCEL 相关的可运行接口配置。

---

## 2. 配置示例

以下是一个示例配置 JSON，适合直接作为 `LANGFLOW_CONDITIONAL_ROUTER_CONFIG` 环境变量的值（需转义为单行字符串）：

```json
{
  "matching_strategies": {
    "exact_match": { "strict": true, "fallback": false },
    "metadata_priority": { "prefer_metadata": true, "text_fallback": true },
    "confidence_aware": { "threshold_required": true, "dynamic_threshold": false },
    "smart_flexible": { "multi_level": true, "adaptive": true },
    "langchainjs_compatible": { "runnable_interface": true, "flatten_output": true }
  },
  "route_similarities": {
    "basic": ["simple", "easy", "quick", "fast"],
    "enhanced": ["complex", "advanced", "detailed", "deep", "sophisticated"],
    "rag": ["search", "retrieve", "document", "knowledge", "lookup"],
    "agent": ["tool", "execute", "action", "api", "compute"]
  },
  "confidence_adjustments": {
    "reassignment_penalty": 0.2,
    "fallback_boost": 0.1,
    "memory_boost": 0.15
  },
  "memory_support": {
    "langflow_chat_memory": true,
    "custom_memory": true,
    "boost_factor": 0.1
  },
  "langchainjs_compatibility": {
    "export_format": true,
    "flatten_metadata": true,
    "runnable_interface": true,
    "async_support": true,
    "streaming_support": true
  },
  "lcel_configuration": {
    "enable_runnable": true,
    "enable_passthrough": true,
    "enable_lambda": true,
    "enable_parallel": true
  }
}
```

---

## 3. 使用说明

### 3.1 设置环境变量

在 Vercel 项目设置中，添加环境变量：

- **名称**：`LANGFLOW_CONDITIONAL_ROUTER_CONFIG`
- **值**：将上述 JSON 配置转为单行字符串（或使用 Vercel 支持的多行 JSON 格式）

例如：

```bash
export LANGFLOW_CONDITIONAL_ROUTER_CONFIG='{"matching_strategies":{"exact_match":{"strict":true,"fallback":false}, ... }}'
```

### 3.2 配置生效

应用启动时，路由组件会自动加载该环境变量配置，覆盖默认配置，实现：

- 自定义模型匹配策略参数
- 调整路由名称与相似词映射，优化模糊匹配
- 调整置信度阈值和惩罚/提升参数
- 启用或禁用记忆支持和 LangChain.js 兼容性选项
- 配置 LCEL 相关的可运行接口选项

### 3.3 复杂模型决策四路径模型选项

路由匹配策略支持以下四种主要策略：

- `exact_match`：严格匹配路由名称
- `metadata_priority`：优先使用元数据匹配，支持文本回退
- `confidence_aware`：基于置信度阈值进行匹配
- `smart_flexible`（默认）：多层次自适应匹配
- `langchainjs_compatible`：兼容 LangChain.js 的运行接口格式

通过调整 `matching_strategies` 中对应策略的参数，可以灵活控制模型决策行为。

---

## 4. 参考链接

- [LangFlow 条件路由组件文档](https://docs.langflow.org/components-logic#conditional-router-if-else-component)

---

## 5. 注意事项

- 配置 JSON 必须合法，避免语法错误导致加载失败。
- 调整置信度阈值时，注意平衡匹配准确率和召回率。
- 记忆支持和 LangChain.js 兼容性配置需根据实际业务需求启用。
- 该环境变量配置仅在 Vercel 部署环境中生效，开发环境可通过代码默认配置调试。

---


---

## 6. 拆分环境变量配置说明

为了简化配置管理，支持将决策路由的配置拆分为多个独立的环境变量，每个环境变量负责配置一部分内容，方便灵活调整和维护。

### 拆分的环境变量名称及对应配置字段

| 环境变量名称                              | 配置字段                  | 说明                             |
|-----------------------------------------|---------------------------|----------------------------------|
| `LANGFLOW_ROUTER_MATCHING_STRATEGIES`   | matchingStrategies        | 路由匹配策略及参数               |
| `LANGFLOW_ROUTER_ROUTE_SIMILARITIES`    | routeSimilarities         | 路由名称与相似词映射             |
| `LANGFLOW_ROUTER_CONFIDENCE_ADJUSTMENTS`| confidenceAdjustments     | 置信度调整参数                   |
| `LANGFLOW_ROUTER_MEMORY_SUPPORT`        | memorySupport             | 记忆相关支持配置                 |
| `LANGFLOW_ROUTER_LANGCHAINJS_COMPATIBILITY` | langchainjsCompatibility | LangChain.js 兼容性配置          |
| `LANGFLOW_ROUTER_LCEL_CONFIGURATION`    | lcelConfiguration        | LCEL 相关可运行接口配置          |

### 配置示例

假设需要单独配置记忆支持和匹配策略，可以在 Vercel 环境变量中设置：

```bash
export LANGFLOW_ROUTER_MEMORY_SUPPORT='{
  "langflowChatMemory": true,
  "customMemory": true,
  "boostFactor": 0.2
}'

export LANGFLOW_ROUTER_MATCHING_STRATEGIES='{
  "exact_match": { "strict": true, "fallback": false },
  "smart_flexible": { "multiLevel": true, "adaptive": true }
}'
```

### 配置加载顺序

- 系统会优先加载拆分的多个环境变量，逐个合并覆盖默认配置。
- 兼容旧的单一大环境变量 `LANGFLOW_CONDITIONAL_ROUTER_CONFIG`，优先级最低。
- 这样既保证了向后兼容，也支持更灵活的拆分配置。

### 使用建议

- 推荐将配置拆分为多个小环境变量，便于单独调整和版本管理。
- 保持 JSON 格式合法，避免语法错误导致加载失败。
- 根据业务需求灵活启用或禁用各部分配置。

---

以上内容补充了拆分环境变量配置的使用说明，方便用户在 Vercel 环境中更灵活地管理决策路由配置。
以上即为通过环境变量 `LANGFLOW_CONDITIONAL_ROUTER_CONFIG` 配置和调整决策路由模型映射及复杂模型决策四路径模型选项的说明文档。