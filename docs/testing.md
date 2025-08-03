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