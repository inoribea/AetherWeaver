import { NextRequest } from 'next/server';
import { 
  validateApiKey, 
  extractApiKey, 
  isAuthEnabled, 
  createAuthResponse 
} from '@/utils/auth';
import {
  OpenAICompletionRequest,
  convertOpenAIToLangChain,
  createOpenAIResponse,
  formatStreamChunk,
  createStreamEnd,
  detectIntentFromRequest,
  detectModelSwitchRequest,
  selectBestModelForAuto
} from '@/utils/openai-compat';
import { routeRequest, RoutingRequest } from '@/utils/unified-router';

// OpenAI兼容的聊天完成端点
export async function POST(req: NextRequest) {
  try {
    console.log('OpenAI Compatible API request received');

    // API密钥验证
    if (isAuthEnabled()) {
      const apiKey = extractApiKey(req);
      const keyInfo = validateApiKey(apiKey);
      
      if (!keyInfo.isValid) {
        console.log('Invalid API key provided:', apiKey?.substring(0, 10) + '...');
        return createAuthResponse('Invalid API key provided');
      }
      
      console.log(`Valid API key used: ${keyInfo.isAdmin ? 'Admin' : 'User'} key`);
    }

    // 解析请求体
    const body: OpenAICompletionRequest = await req.json();
    
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Messages array is required and cannot be empty',
            type: 'invalid_request_error',
            code: 'missing_messages'
          }
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`OpenAI API - Model: ${body.model}, Messages: ${body.messages.length}, Stream: ${body.stream}`);

    // 🚀 使用统一智能路由器进行模型选择
    // 首先检测用户消息中的模型切换意图
    const userMessage = body.messages[body.messages.length - 1];
    const userContent = Array.isArray(userMessage.content)
      ? userMessage.content.map(c => typeof c === 'string' ? c : c.text).join('')
      : userMessage.content;
    const detectedModel = detectModelSwitchRequest(userContent);
    
    console.log(`🔍 检测到的模型切换意图: ${detectedModel}`);
    console.log(`📝 用户消息: "${userContent}"`);
    
    const routingRequest: RoutingRequest = {
      messages: body.messages,
      // 优先使用检测到的模型，如果没有检测到且不是auto模型，则使用原始模型
      userIntent: detectedModel || (body.model !== 'auto' ? body.model : undefined),
      context: {
        taskType: 'chat',
        language: 'auto'
      },
      tools: body.tools,
      temperature: body.temperature,
      stream: body.stream
    };
    
    console.log(`📦 路由请求 userIntent: ${routingRequest.userIntent}`);

    // 调用统一路由器进行智能选择
    const routingDecision = await routeRequest(routingRequest);
    
    console.log(`🎯 统一路由器决策:`);
    console.log(`  - 选择模型: ${routingDecision.selectedModel}`);
    console.log(`  - 置信度: ${routingDecision.confidence}`);
    console.log(`  - 策略: ${routingDecision.metadata.routingStrategy}`);
    console.log(`  - 推理: ${routingDecision.reasoning}`);
    
    // 更新请求中的模型
    body.model = routingDecision.selectedModel;
    
    // 转换为LangChain格式
    const langchainRequest = convertOpenAIToLangChain(body);
    
    // 智能路由 - 根据请求内容选择合适的端点
    const targetEndpoint = await detectIntentFromRequest(body);
    console.log(`Routing to endpoint: ${targetEndpoint}`);

    // 构建内部请求
    const internalUrl = new URL(targetEndpoint, req.url);
    const internalRequest = new Request(internalUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenAI-Compat': 'true', // 添加标识，让内部API知道这是来自OpenAI兼容层的请求
        // 传递原始请求的一些头信息
        'X-Forwarded-For': req.headers.get('X-Forwarded-For') || '',
        'User-Agent': req.headers.get('User-Agent') || '',
      },
      body: JSON.stringify(langchainRequest)
    });

    // 调用内部API
    const internalResponse = await fetch(internalRequest);
    
    if (!internalResponse.ok) {
      console.error(`Internal API error: ${internalResponse.status}`);
      return new Response(
        JSON.stringify({
          error: {
            message: 'Internal server error',
            type: 'server_error',
            code: 'internal_error'
          }
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // 获取模型信息 - 使用统一路由器选择的模型
    const actualModel = routingDecision.selectedModel;
    console.log(`🎯 Final model used: ${actualModel}`);

    // 处理流式响应
    if (body.stream !== false) {
      console.log('Streaming OpenAI compatible response');
      
      const encoder = new TextEncoder();
      const reader = internalResponse.body?.getReader();
      
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            let buffer = '';
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                // 处理剩余的buffer
                if (buffer.trim()) {
                  const openaiChunk = createOpenAIResponse(buffer, actualModel, false, true);
                  controller.enqueue(encoder.encode(formatStreamChunk(openaiChunk)));
                }
                
                // 发送最后的完成块
                const finalChunk = createOpenAIResponse('', actualModel, true, true);
                controller.enqueue(encoder.encode(formatStreamChunk(finalChunk)));
                controller.enqueue(encoder.encode(createStreamEnd()));
                break;
              }
              
              // 解码数据块
              const chunk = new TextDecoder().decode(value);
              buffer += chunk;
              
              // 处理可能的部分数据
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // 保留最后一个可能不完整的行
              
              for (const line of lines) {
                if (line.trim()) {
                  // 统一处理所有模型的流式响应
                  const openaiChunk = createOpenAIResponse(line + '\n', actualModel, false, true);
                  controller.enqueue(encoder.encode(formatStreamChunk(openaiChunk)));
                }
              }
            }
            
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    } else {
      // 非流式响应
      console.log('Non-streaming OpenAI compatible response');
      
      const responseText = await internalResponse.text();
      const openaiResponse = createOpenAIResponse(responseText, actualModel, true, false);
      
      return new Response(JSON.stringify(openaiResponse), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

  } catch (error) {
    console.error('OpenAI Compatible API error:', error);
    
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          type: 'server_error',
          code: 'internal_error'
        }
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
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
    }
  });
}
