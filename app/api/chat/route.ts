/* eslint-disable no-console */
import { NextRequest } from 'next/server';
import { HumanMessage } from '@langchain/core/messages';

import { OptimizedEnhancedRouter } from '../../components/routing/optimizedEnhancedRouter';
import { ModelSelectorComponent } from '../../components/models/model-selector';
import { createBasicChain } from '@/chains/basic-chain';
import { createRAGChain } from '@/chains/rag-chain';

import { TavilySearch } from '@langchain/tavily';
import { WebBrowser } from 'langchain/tools/webbrowser';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

import { SmartRouterComponent } from '../../components/routing/smart-router';

export async function POST(req: NextRequest) {
  try {
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
    const route = routingResult.route as
      | "basic"
      | "enhanced"
      | "rag"
      | "agent"
      | "tavily"
      | "webbrowser";
    let result;
    switch (route) {
      case 'basic':
      case 'enhanced':
      case 'agent': {
        const chain = createBasicChain();
        result = await chain.invoke(message);
        break;
      }
      case 'rag': {
        const chain = createRAGChain();
        // rag chain 需要 context_documents 参数，暂时传空数组，后续根据需求完善
        result = await chain.invoke({ input: message, context_documents: [] });
        break;
      }
      case 'tavily': {
        // 使用Tavily工具
        if (typeof tavilyTool.invoke === 'function') {
          result = await tavilyTool.invoke({ query: message });
        } else {
          throw new Error('TavilySearch工具不支持invoke方法');
        }
        break;
      }
      case 'webbrowser': {
        // 使用WebBrowser工具
        if (typeof webBrowserTool.invoke === 'function') {
          result = await webBrowserTool.invoke({ url: message });
        } else {
          throw new Error('WebBrowser工具不支持invoke方法');
        }
        break;
      }
      default: {
        // 默认使用basic链
        const chain = createBasicChain();
        result = await chain.invoke(message);
        break;
      }
    }

    // 6. 返回结果
    return new Response(
      JSON.stringify({
        response: result?.content ?? result,
        routing: {
          route: routingResult.route,
          confidence: routingResult.confidence ?? 1,
          model: modelConfig.model,
        },
        metadata: {
          langchainjs_compatible: true,
          vercel_ready: true,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('POST /api/chat error:', error);

    return new Response(
      JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'Please try again later',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

// 处理OPTIONS请求 (CORS预检)
export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
