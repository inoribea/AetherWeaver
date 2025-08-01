import { NextRequest, NextResponse } from 'next/server';
import { SmartRouterComponent } from '@/src/components/routing/smart-router';
import { ModelSelectorComponent } from '@/src/components/models/model-selector';
import { HumanMessage } from '@langchain/core/messages';
import { createBasicChain } from '@/src/chains/basic-chain';
import { createEnhancedChain } from '@/src/chains/enhanced-chain';
import { createRAGChain } from '@/src/chains/rag-chain';
import { createAgentChain } from '@/src/chains/agent-chain';

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();
    
    // 1. 智能路由决策
    const router = new SmartRouterComponent({
      analysis_mode: 'hybrid',
      confidence_threshold: 0.6
    });
    
    const routingResult = await router.invoke(new HumanMessage(message));
    
    // 2. 模型选择
    const modelSelector = new ModelSelectorComponent(
      [
        { provider: 'OpenAI', name: 'gpt-4o', enabled: true, weight: 0.7 },
        { provider: 'Anthropic', name: 'claude-3-haiku', enabled: true, weight: 0.3 }
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
      case 'enhanced':
        chain = createEnhancedChain();
        break;
      case 'rag':
        chain = createRAGChain();
        break;
      case 'agent':
        chain = createAgentChain();
        break;
      default:
        chain = createBasicChain();
    }
    
    // 4. 执行链
    const result = await chain.invoke({
      input: message,
      context_documents: "", // 如果是RAG模式，这里会有检索到的文档
      routing_context: routingResult
    });
    
    return NextResponse.json({
      response: result.content,
      routing: {
        route: routingResult.route,
        confidence: routingResult.confidence,
        model: modelConfig.model
      },
      metadata: {
        langchainjs_compatible: true,
        vercel_ready: true
      }
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
