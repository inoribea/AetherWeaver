/* eslint-disable no-console */
import { NextRequest, NextResponse } from 'next/server';
import { HumanMessage } from '@langchain/core/messages';
import { SmartRouterComponent } from '@/components/routing/smart-router';
import { ModelSelectorComponent } from '@/components/models/model-selector';
import { createBasicChain } from '@/chains/basic-chain';
import { createRAGChain } from '@/chains/rag-chain';
import { wrapWithErrorHandling } from '@/utils/errorHandler';

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
          { provider: 'Anthropic', name: 'claude-3', enabled: true, weight: 0.3 },
        ],
        'weighted'
      );

      const modelConfig = await modelSelector.invoke(routingResult);

      // 3. 创建模型和嵌入实例，用于工具
      const llm = new ChatOpenAI({
        modelName: modelConfig.model || 'gpt-4o',
        temperature: 0,
      });
      const embeddings = new OpenAIEmbeddings();

      // 4. 实例化Tavily和WebBrowser工具，使用环境变量配置API Key
      const tavilyTool = new TavilySearch({
        maxResults: 5,
        topic: 'general',
      });

      const webBrowserTool = new WebBrowser({
        model: llm,
        embeddings,
      });

      // 5. 选择对应的链或工具
      let result;
      if (
        ['basic', 'enhanced', 'rag', 'agent'].includes(routingResult.route)
      ) {
        switch (routingResult.route) {
          case 'basic':
          case 'enhanced':
          case 'agent': {
            const chain = createBasicChain();
            result = await chain.invoke(message);
            break;
          }
          case 'rag': {
            const chain = createRAGChain();
            result = await chain.invoke(message);
            break;
          }
          default: {
            const chain = createBasicChain();
            result = await chain.invoke(message);
            break;
          }
        }
      } else if (routingResult.route === 'tavily') {
        // 使用Tavily工具调用invoke方法
        result = await tavilyTool.invoke({ query: message });
      } else if (routingResult.route === 'webbrowser') {
        // 使用WebBrowser工具调用invoke方法
        result = await webBrowserTool.invoke({ url: message, summary: '' });
      } else {
        // 默认使用basic链
        const chain = createBasicChain();
        result = await chain.invoke(message);
      }

      // 6. 返回结果
      return new Response(
        JSON.stringify({
          response: result?.content ?? result,
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
    }
  );
}
