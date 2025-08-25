# v1 智能路由决策逻辑

## 概述
本文档详细介绍 v1 版本中的智能路由决策逻辑及相关环境变量配置，帮助用户理解和配置系统的路由和模型选择机制。

---

## 决策流程
1.  **意图检测**: 解析用户输入，识别模型切换、工具调用等特殊意图。
2.  **统一请求构造**: 将请求标准化，送入智能路由器。
3.  **智能路由决策**:
    - **`rule_based` 模式**: 基于关键字和正则表达式的快速规则匹配。
    - **`llm_enhanced` 模式**: 在规则分析后，调用一个轻量级 LLM 对请求进行二次分析，以实现更精准的路由。
4.  **模型选择**: 根据路由结果，从预设的模型池 (`models-config.json` 或环境变量) 中选择最优模型。
5.  **响应生成**: 调用目标模型并返回结果。

---

## 关键环境变量

### 路由模式配置
- **`ANALYSIS_MODE`**: 控制路由分析模式。
  - `rule_based` (默认): 高性能的规则匹配。
  - `llm_enhanced`: 更智能但有额外开销的 LLM 增强模式。

- **`ROUTING_MODEL_NAME`**: 当 `ANALYSIS_MODE` 设置为 `llm_enhanced` 时，用于路由决策的 LLM 名称。

- **`ROUTING_PROMPT`**: 当 `ANALYSIS_MODE` 设置为 `llm_enhanced` 时，用于路由决策的 Prompt 模板。

### 对话历史支持
- **`LANGFLOW_ROUTER_MEMORY_SUPPORT`**: 控制路由是否考虑对话历史。
  - `true` (默认): 启用。
  - `false`: 禁用。
  - 也可配置为 JSON 字符串以支持更复杂的内存策略。

---

## 模型支持
系统支持多种 LLM，包括 OpenAI、Deepseek、Google Gemini、Claude 等，通过相应的 API Key 环境变量启用。

确保至少配置一个模型的 API Key 以保证系统正常运行。