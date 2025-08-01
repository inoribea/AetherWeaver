import { NextRequest } from 'next/server';
import { HumanMessage } from '@langchain/core/messages';
import { SmartRouterComponent } from '@/components/routing/smart-router';
import { ModelSelectorComponent } from '@/components/models/model-selector';
import { createBasicChain } from '@/chains/basic-chain';
import { createRAGChain } from '@/chains/rag-chain';
import { wrapWithErrorHandling } from '@/utils/errorHandler';

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

      // 3. 选择对应的链
      let chain;
      switch (routingResult.route) {
        case 'basic':
          chain = createBasicChain();
          break;
        case 'rag':
          chain = createRAGChain();
          break;
        default:
          chain = createBasicChain();
      }

      // 4. 执行链
      try {
        const result = await chain.invoke({
          input: message,
          context_documents: '', // 如果是RAG模式，这里会有检索到的文档
          routing_context: routingResult,
        });

        return new Response(
          JSON.stringify({
            response: result.content,
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
      } catch (chainError) {
        console.error('Chain invoke error:', chainError);

        // 回退逻辑示例：尝试使用基础链作为回退
        try {
          const fallbackChain = createBasicChain();
          const fallbackResult = await fallbackChain.invoke({
            input: message,
            context_documents: '',
            routing_context: routingResult,
          });

          console.info('Fallback chain executed successfully.');
          return new Response(
            JSON.stringify({
              response: fallbackResult.content,
              routing: {
                route: 'basic-fallback',
                confidence: routingResult.confidence,
                model: modelConfig.model,
              },
              metadata: {
                langchainjs_compatible: true,
                vercel_ready: true,
                fallback: true,
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
          return new Response(
            JSON.stringify({
              error: 'Internal server error',
              message: 'All models are currently unavailable',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
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
