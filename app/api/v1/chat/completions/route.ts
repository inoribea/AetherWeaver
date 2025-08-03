import { NextRequest, NextResponse } from 'next/server';
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
  detectModelSwitchRequest,
  detectIntentFromRequest,
  selectBestModelForAuto
} from '@/utils/openai-compat';
import { routeRequest as route } from '@/utils/unified-router';
import { handleApiKeyValidation } from './helpers';
import { routeRequest, RoutingRequest } from '@/utils/unified-router';
import { wrapWithErrorHandling } from '@/utils/errorHandler';
import { sendEvent } from '@/utils/langfuseClient';

// OpenAI兼容的聊天完成端点
export async function POST(req: NextRequest) {
  return wrapWithErrorHandling("v1_chat_completions_POST", async () => {
    sendEvent({ event: 'request_start', properties: { endpoint: 'v1_chat_completions_POST' }, timestamp: new Date().toISOString() });

    // API密钥验证
    const authResponse = await handleApiKeyValidation(req);
    if (authResponse) {
      return authResponse;
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

    // 缓存用户消息内容，避免重复解析
    const userMessage = body.messages[body.messages.length - 1];
    const userContent = Array.isArray(userMessage.content)
      ? userMessage.content.map(c => typeof c === 'string' ? c : c.text).join('')
      : userMessage.content;

    // 先检测模型切换意图
    const detectedModel = detectModelSwitchRequest(userContent);
    console.log(`🔍 检测到的模型切换意图: ${detectedModel}`);
    console.log(`📝 用户消息: "${userContent}"`);

    // 统一路由请求构造，优先使用检测到的模型
    const routingRequest: RoutingRequest = {
      messages: body.messages,
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

    sendEvent({ event: 'model_selected', properties: { model: routingDecision.selectedModel, confidence: routingDecision.confidence }, timestamp: new Date().toISOString() });

    console.log(`🎯 统一路由器决策:`);
    console.log(`  - 选择模型: ${routingDecision.selectedModel}`);
    console.log(`  - 置信度: ${routingDecision.confidence}`);
    console.log(`  - 策略: ${routingDecision.metadata.routingStrategy}`);
    console.log(`  - 推理: ${routingDecision.reasoning}`);

    // 更新请求中的模型
    body.model = routingDecision.selectedModel;

    // 转换为LangChain格式
    const langchainRequest = convertOpenAIToLangChain(body);

    // 合并调用 detectIntentFromRequest，传入缓存的 body，避免重复解析
    const targetEndpoint = await detectIntentFromRequest(body);
    console.log(`[Smart Router] Routing to endpoint: ${targetEndpoint}`);
    console.log(`[Smart Router] Selected Model: ${body.model}`);

    // 构建内部请求
    const baseUrl = new URL(req.url).origin;
    const internalUrl = new URL(targetEndpoint, baseUrl);
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

    const startTime = Date.now();
    // 调用内部API
    const internalResponse = await fetch(internalRequest);
    const durationMs = Date.now() - startTime;
    sendEvent({ event: 'internal_api_call', properties: { status: internalResponse.status, durationMs }, timestamp: new Date().toISOString() });
    
    if (!internalResponse.ok) {
      const errorText = await internalResponse.text();
      console.error(`Internal API error: ${internalResponse.status}, Response: ${errorText}`);
      return new Response(
        JSON.stringify({
          error: {
            message: `Internal server error: ${internalResponse.status} - ${errorText}`,
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
        console.error('Failed to get response reader');
        return new Response(
          JSON.stringify({
            error: {
              message: 'Failed to get response reader',
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
            // 明确类型处理 unknown 错误
            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
              errorMessage = error.message;
            } else if (typeof error === 'string') {
              errorMessage = error;
            } else if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
              errorMessage = (error as any).message;
            }
            // 优雅降级：发送错误信息块，避免中断流
            const errorChunk = createOpenAIResponse(
              JSON.stringify({
                error: {
                  message: 'Streaming error occurred: ' + errorMessage,
                  type: 'server_error',
                  code: 'streaming_error'
                }
              }),
              actualModel,
              false,
              true
            );
            controller.enqueue(encoder.encode(formatStreamChunk(errorChunk)));
            controller.enqueue(encoder.encode(createStreamEnd()));
            controller.close();
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
  }, {
    interfaceName: "v1_chat_completions_POST",
    fallback: async () => {
      // 回退逻辑示例：返回标准错误响应，提示服务暂不可用
      return new Response(
        JSON.stringify({
          error: {
            message: 'Service temporarily unavailable, please try again later.',
            type: 'server_error',
            code: 'service_unavailable'
          }
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  });
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
