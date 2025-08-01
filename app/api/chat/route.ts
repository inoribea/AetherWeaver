import { NextRequest } from 'next/server';
import { HumanMessage } from '@langchain/core/messages';
import { SmartRouterComponent } from '@/components/routing/smart-router';
import { ModelSelectorComponent } from '@/components/models/model-selector';
import { createBasicChain } from '@/chains/basic-chain';
import { createRAGChain } from '@/chains/rag-chain';
import { wrapWithErrorHandling } from '@/utils/errorHandler';

// 新增导入
import { TavilySearch } from '@langchain/tavily';
import { WebBrowser } from 'langchain/tools/webbrowser';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

export async function POST(req: NextRequest) {
  return wrapWithErrorHandling(
    'POST /api/chat',
    async () => {
      const { message, sessionId } = await req.json();

      // 1. 智能路由决策
      const router = new SmartRouterComponent({
        analysis_mode: 'hybrid',
        confidence_threshold: 0.6,
      });

      const routingResult = await router.invoke(new HumanMessage(message));

      // 2. 模型选择
      const modelSelector = new ModelSelectorComponent(
        [
          { provider: 'OpenAI', name: 'gpt-4o', enabled: true, weight: 0.7 },
          { provider: 'Anthropic', name: 'claude-3-haiku', enabled: true, weight: 0.3 },
        ],
        'weighted'
      );

      const modelConfig = await modelSelector.invoke(routingResult);

      // 3. 创建模型和嵌入实例，用于工具
      const llm = new ChatOpenAI({ model: modelConfig.model || 'gpt-4o-mini', temperature: 0 });
      const embeddings = new OpenAIEmbeddings();

      // 4. 实例化TavilySearch和WebBrowser工具，使用环境变量配置API Key
      const tavilyApiKey = process.env.TAVILY_API_KEY || '';
      const tavilyTool = new TavilySearch({
        maxResults: 5,
        topic: 'general',
        apiKey: tavilyApiKey,
      });

      const webBrowserTool = new WebBrowser({ model: llm, embeddings });

      // 5. 选择对应的链或工具
      let result;
      switch (routingResult.route) {
        case 'basic':
          {
            const chain = createBasicChain();
            result = await chain.invoke({
              input: message,
              context_documents: '',
              routing_context: routingResult,
            });
          }
          break;
        case 'rag':
          {
            const chain = createRAGChain();
            result = await chain.invoke({
              input: message,
              context_documents: '',
              routing_context: routingResult,
            });
          }
          break;
        case 'tavily':
          {
            // 使用Tavily搜索工具
            result = await tavilyTool.invoke({ query: message });
          }
          break;
        case 'webbrowser':
          {
            // 使用WebBrowser工具，传入URL和查询内容，示例只传URL，空字符串表示摘要
            result = await webBrowserTool.invoke(`${message},""`);
          }
          break;
        default:
          {
            const chain = createBasicChain();
            result = await chain.invoke({
              input: message,
              context_documents: '',
              routing_context: routingResult,
            });
          }
          break;
      }

      // 6. 返回结果
      return new Response(
        JSON.stringify({
          response: result.content || result,
          routing: {
            route: routingResult.route,
            confidence: routingResult.confidence,
            model: modelConfig.model,
          },
          metadata: {
            langchainjs_compatible: true,
            vercel_ready: true,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    },
    {
      fallback: async () => {
        // 全局回退逻辑：返回统一错误响应
        return new Response(
          JSON.stringify({
            error: 'Service temporarily unavailable',
            message: 'Please try again later',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      },
      interfaceName: 'POST /api/chat',
    }
  );
}
