import { NextRequest } from 'next/server';

export interface ApiKeyInfo {
  key: string;
  isAdmin: boolean;
  isValid: boolean;
}

export function validateApiKey(apiKey: string | null): ApiKeyInfo {
  if (!apiKey) {
    return { key: '', isAdmin: false, isValid: false };
  }

  // 检查管理员密钥
  const adminKey = process.env.LANGCHAIN_ADMIN_KEY;
  if (adminKey && apiKey === adminKey) {
    return { key: apiKey, isAdmin: true, isValid: true };
  }

  // 检查普通API密钥 - 支持多种配置方式
  const validKeys = getValidApiKeys();
  const isValid = validKeys.includes(apiKey);

  return { key: apiKey, isAdmin: false, isValid };
}

function getValidApiKeys(): string[] {
  const keys: string[] = [];

  // 方式1: 逗号分隔的多个密钥
  const multiKeys = process.env.LANGCHAIN_API_KEYS;
  if (multiKeys) {
    keys.push(...multiKeys.split(',').map(key => key.trim()));
  }

  // 方式2: 编号的单独密钥
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`LANGCHAIN_API_KEY_${i}`];
    if (key) {
      keys.push(key);
    }
  }

  // 方式3: 单个默认密钥
  const singleKey = process.env.LANGCHAIN_API_KEY;
  if (singleKey) {
    keys.push(singleKey);
  }

  // 过滤空值并去重
  return [...new Set(keys.filter(key => key && key.length > 0))];
}

export function extractApiKey(request: NextRequest): string | null {
  // 从Authorization头获取
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 从自定义头获取
  const apiKeyHeader = request.headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

export function isAuthEnabled(): boolean {
  const enableAuth = process.env.ENABLE_API_AUTH;
  return enableAuth !== 'false'; // 默认开启，只有显式设置为false才关闭
}

export function createAuthResponse(message: string = 'Unauthorized') {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer'
      }
    }
  );
}
