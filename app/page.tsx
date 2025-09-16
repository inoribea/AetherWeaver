import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";
import { getDefaultOpenAICompatProvider } from "@/utils/openaiProvider";

export default function Home() {
  const provider = getDefaultOpenAICompatProvider();

  const EnvNotice = !provider ? (
    <div className="mb-6">
      <GuideInfoBox>
        <ul>
          <li className="text-l">
            ⚠️
            <span className="ml-2">
              未检测到可用的 OpenAI 兼容提供商。请按 <code>.env.example</code> 配置环境变量，或在 Vercel 控制台添加：
            </span>
          </li>
          <li className="text-l">
            <span className="ml-7 block">
              方式一（推荐，通用前缀法）：
            </span>
            <pre className="ml-7 mt-2 bg-secondary/50 p-3 rounded text-sm overflow-auto">
{`OPENAI_COMPAT_PROVIDER=O3
O3_API_KEY=your_o3_key
O3_BASE_URL=https://api.o3.fan/v1`}
            </pre>
          </li>
          <li className="text-l">
            <span className="ml-7 block">
              方式二（官方 OpenAI）：
            </span>
            <pre className="ml-7 mt-2 bg-secondary/50 p-3 rounded text-sm overflow-auto">
{`OPENAI_API_KEY=sk-xxxxxxxx
# OPENAI_BASE_URL 可省略（默认官方域名）`}
            </pre>
          </li>
          <li className="text-l">
            <span className="ml-7">
              也可通过路由覆盖仅让部分路由使用第三方真实模型名（见 models-config.json）：
            </span>
            <pre className="ml-7 mt-2 bg-secondary/50 p-3 rounded text-sm overflow-auto">
{`BASIC_MODELS=Qwen/Qwen3-235B-A22B-search
STRUCTURED_OUTPUT_MODELS=Qwen/Qwen3-235B-A22B-search`}
            </pre>
          </li>
          <li className="text-l">
            <span className="ml-7">
              详情见 <code>docs/vercel-guide.md</code> 与 <code>.env.example</code>。
            </span>
          </li>
        </ul>
      </GuideInfoBox>
    </div>
  ) : null;

  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          🤝
          <span className="ml-2">
            This template showcases a simple chatbot using{" "}
            <a href="https://js.langchain.com/" target="_blank">
              LangChain.js
            </a>{" "}
            and the Vercel{" "}
            <a href="https://sdk.vercel.ai/docs" target="_blank">
              AI SDK
            </a>{" "}
            in a{" "}
            <a href="https://nextjs.org/" target="_blank">
              Next.js
            </a>{" "}
            project.
          </span>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the prompt and model logic for this use-case in{" "}
            <code>app/api/chat/route.ts</code>.
          </span>
        </li>
        <li>
          🏴‍☠️
          <span className="ml-2">
            By default, the bot is pretending to be a pirate, but you can change
            the prompt to whatever you want!
          </span>
        </li>
        <li className="hidden text-l md:block">
          🎨
          <span className="ml-2">
            The main frontend logic is found in <code>app/page.tsx</code>.
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Try asking e.g. <code>What is it like to be a pirate?</code> below!
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );
  return (
    <>
      {EnvNotice}
      <ChatWindow
        endpoint="api/chat"
        emoji="🏴‍☠️"
        placeholder="I'm an LLM pretending to be a pirate! Ask me about the pirate life!"
        emptyStateComponent={InfoCard}
      />
    </>
  );
}
