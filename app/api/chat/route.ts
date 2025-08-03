import { NextRequest } from 'next/server';
import { HumanMessage } from '@langchain/core/messages';

import { OptimizedEnhancedRouter } from '../../components/routing/optimizedEnhancedRouter';
import { createBasicChain } from '../../../src/chains/basic-chain';
import { createRAGChain } from '../../../src/chains/rag-chain';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

import { SmartRouterComponent } from '../../components/routing/smart-router';
import { ModelManager } from '../../admin/models/ModelManager';

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    const safeMessageContent =
      typeof message === "string" ? message :
      message && typeof message.content === "string" ? message.content :
      "";

    // 智能路由决策
    const router = new SmartRouterComponent({
      analysis_mode: 'hybrid',
      confidence_threshold: 0.6,
    });

    const routingResult = await router.invoke(new HumanMessage(safeMessageContent));

    // 模型选择
    const modelManager = await ModelManager.getCurrentModel();

    // 创建模型和嵌入实例
    const llm = new ChatOpenAI({
      modelName: modelManager.model || 'gpt-4o',
      temperature: 0,
      openAIApiKey: modelManager.apiKey,
    });
    const embeddings = new OpenAIEmbeddings();

    // 初始化工具（这里省略）

    // 选择对应的链或工具
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
        result = await chain.invoke({ input: safeMessageContent });
        break;
      }
      case 'rag': {
        const chain = createRAGChain();
        result = await chain.invoke({ input: safeMessageContent, context_documents: [] });
        break;
      }
      // 其他情况省略
      default: {
        const chain = createBasicChain();
        result = await chain.invoke({ input: safeMessageContent });
        break;
      }
    }

    return new Response(
      JSON.stringify({
        response: result?.content ?? result,
        routing: {
          route: routingResult.route,
          confidence: routingResult.confidence ?? 1,
          model: modelManager.model,
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
