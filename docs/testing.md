# 测试指南

本指南介绍本项目的测试相关内容，包括测试框架、测试目录结构、测试运行方式及示例说明，帮助开发者快速上手和维护测试。

## 测试框架

本项目使用 [Jest](https://jestjs.io/) 作为主要的测试框架，支持单元测试和集成测试。Jest 提供了丰富的断言库和模拟功能，方便对各模块进行全面测试。

## 测试目录结构

- `app/ai_sdk/__tests__/`：包含 AI SDK 相关组件和功能的测试用例。
- `app/api/chat/retrieval_agents/__tests__/`：聊天检索代理相关的测试。
- `app/components/models/__tests__/`：模型相关组件的测试。
- `app/components/routing/__tests__/`：路由相关组件的测试。

测试文件一般以 `.test.ts` 或 `.test.tsx` 结尾，方便 Jest 自动识别。

## 运行测试

确保已安装依赖后，可以通过以下命令运行所有测试：

```bash
npm run test
# 或
yarn test
```

运行时，Jest 会自动查找测试文件并执行，支持 watch 模式和覆盖率报告。

## 编写测试

测试用例应覆盖核心业务逻辑和关键组件，示例：

```ts
import { render, screen } from '@testing-library/react';
import AgentPromptComponent from '../../components/models/agent-prompt-component';

test('renders agent prompt component', () => {
  render(<AgentPromptComponent />);
  const element = screen.getByText(/agent prompt/i);
  expect(element).toBeInTheDocument();
});
```

## 测试示例

以下是一个调用 `/api/chat` 接口的 curl 命令示例，用于快速验证接口是否正常：

```bash
curl -X POST https://langchain-git-build-inoribea-projects.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好","sessionId":"test-session"}'
```

## 其他说明

- 请确保在提交代码前运行测试，保证代码质量。
- 新增功能应配套相应测试用例。
- 测试覆盖率报告可通过 `npm run test -- --coverage` 查看。

---

感谢您对测试工作的支持和配合！
# 本地使用 curl 调试 v1 端口接口指南

该项目的 `/api/v1/chat/completions` 是一个 OpenAI 兼容的接口入口，实际请求会代理到底层 `/api/chat/route` 等实际处理接口。接口请求格式和实际处理接口请求格式存在差异。

## 如何用 curl 调试 `/api/v1/chat/completions`

示例请求命令（假设本地服务运行在 3000 端口，API Key 为 `your_api_key`）：

```bash
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "你好，帮我写个测试示例。"}
    ],
    "stream": false
  }'
```

> 注意：该接口请求体使用的是 OpenAI 兼容格式，即`messages`数组。

## 关于内部代理与请求体转换

项目实现中，`/api/v1/chat/completions` 仅为代理入口，内部会将请求转换后调用 `/api/chat/route` 接口。后者要求请求体格式为：

- `message`（字符串类型）为用户消息内容
- `sessionId`（可选）会话标识

为方便调试，可使用项目中提供的 Node.js 脚本 `scripts/convert_v1_to_chat_route_request.js`，它可以将 v1 格式请求体转换为 `/api/chat/route` 接口所需格式。

### 使用示例

```bash
node scripts/convert_v1_to_chat_route_request.js
```

该脚本会输出转换后的请求体格式。

## 备注

- 确保本地服务已启动且监听 3000 端口或相应端口
- 请求头需带有效API Key，支持两种写法：
  - `Authorization: Bearer your_api_key`
  - `X-API-Key: your_api_key`

通过以上方式，你可以在本地调试和验证 v1 端口接口的行为。
