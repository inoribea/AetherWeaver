# LCEL接口整合文档

## 1. LCEL接口实现概述

本项目中主要组件均实现了LCEL接口，支持以下核心方法：

- `invoke(input: any, config?: Record<string, any>): Promise<LCELMessage>`
- `ainvoke(input: any, config?: Record<string, any>): Promise<LCELMessage>`
- `stream(input: any, config?: Record<string, any>): AsyncGenerator<LCELMessage>`
- `astream(input: any, config?: Record<string, any>): AsyncGenerator<LCELMessage>`
- `batch(inputs: any[], config?: Record<string, any>): Promise<LCELMessage[]>`
- `abatch(inputs: any[], config?: Record<string, any>): Promise<LCELMessage[]>`

其中，`invoke`为同步调用接口，`ainvoke`为异步调用接口，`stream`和`astream`为流式输出接口，`batch`和`abatch`为批量调用接口。

## 2. 统一环境变量调用方式

所有组件统一调用`utils/envConfig.ts`中的`loadEnvConfig`函数加载环境变量，支持Vercel和本地环境：

```ts
function loadEnvConfig(vercelMode: boolean, configKey: string, defaultConfig: Record<string, any>): Record<string, any>
```

- `vercelMode`：是否为Vercel环境
- `configKey`：环境变量中配置的JSON字符串键名
- `defaultConfig`：默认配置对象

该函数返回合并后的配置对象，确保环境变量调用一致。

## 3. 接口方法签名和返回类型规范

### LCELMessage接口

```ts
interface LCELMessage {
  text: string;
  metadata?: Record<string, any>;
}
```

### LCELComponent接口

```ts
interface LCELComponent {
  invoke(input: any, config?: Record<string, any>): Promise<LCELMessage>;
  ainvoke(input: any, config?: Record<string, any>): Promise<LCELMessage>;
  stream(input: any, config?: Record<string, any>): AsyncGenerator<LCELMessage>;
  astream(input: any, config?: Record<string, any>): AsyncGenerator<LCELMessage>;
  batch(inputs: any[], config?: Record<string, any>): Promise<LCELMessage[]>;
  abatch(inputs: any[], config?: Record<string, any>): Promise<LCELMessage[]>;
}
```

所有组件均遵循该接口规范，实现对应方法，保证接口一致性。

## 4. 测试用例覆盖情况

- 各组件均有对应的Jest测试文件，位于`__tests__`目录下。
- 测试覆盖了所有接口方法，包括同步、异步、流式和批量调用。
- 测试验证了返回结果的结构和内容，确保接口功能正确性和稳定性。
- 典型测试用例包括：
  - 单条输入的invoke和ainvoke调用
  - 流式接口stream和astream的正确产出
  - 批量接口batch和abatch的多输入处理
  - 异常输入的错误处理和状态反馈

## 5. 维护和扩展建议

- 新增组件应遵循LCELComponent接口规范，实现所有核心方法。
- 环境变量配置应统一通过`loadEnvConfig`加载，避免分散配置。
- 测试用例应覆盖所有接口方法，确保接口行为一致。
- 定期检查接口实现和测试覆盖，保证系统稳定性。

---

文档维护人：开发团队  
日期：2025-08-01