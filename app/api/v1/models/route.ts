import { NextRequest } from 'next/server';
import { 
  validateApiKey, 
  extractApiKey, 
  isAuthEnabled, 
  createAuthResponse 
} from '@/utils/auth';
import { getSupportedModels } from '@/utils/openai-compat';

// OpenAI兼容的模型列表端点
export async function GET(req: NextRequest) {
  try {
    console.log('OpenAI Compatible Models API request received');

    // API密钥验证
    if (isAuthEnabled()) {
      const apiKey = extractApiKey(req);
      const keyInfo = validateApiKey(apiKey);
      
      if (!keyInfo.isValid) {
        console.log('Invalid API key provided for models endpoint');
        return createAuthResponse('Invalid API key provided');
      }
      
      console.log(`Valid API key used for models endpoint: ${keyInfo.isAdmin ? 'Admin' : 'User'} key`);
    }

    // 获取支持的模型列表 - 使用统一路由器
    const models = getSupportedModels();
    
    console.log(`Found ${models.length} supported models`);
    console.log('Available models:', models.map(m => m.id).join(', '));
    
    const response = {
      object: 'list',
      data: models
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      }
    });

  } catch (error) {
    console.error('Models API error:', error);
    
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    }
  });
}
