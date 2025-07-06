import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, extractApiKey, isAuthEnabled, createAuthResponse } from '@/utils/auth';
import { reloadModelConfiguration, getAvailableModels } from '@/utils/unified-router';

// POST - 重新加载路由器配置
export async function POST(req: NextRequest) {
  try {
    console.log('Model reload request received');

    // API密钥验证
    if (isAuthEnabled()) {
      const apiKey = extractApiKey(req);
      const keyInfo = validateApiKey(apiKey);
      
      if (!keyInfo.isValid) {
        console.log('Invalid API key provided for model reload');
        return createAuthResponse('Invalid API key provided');
      }
      
      if (!keyInfo.isAdmin) {
        console.log('Non-admin key used for model reload');
        return createAuthResponse('Admin privileges required');
      }
      
      console.log('Valid admin API key used for model reload');
    }

    // 使用统一路由器重新加载模型配置
    await reloadModelConfiguration();
    
    // 获取重新加载后的模型列表
    const availableModels = getAvailableModels();
    
    console.log('Models reloaded successfully via unified router');
    
    return NextResponse.json({
      success: true,
      message: 'Router configuration reloaded successfully via unified router',
      availableModels: availableModels,
      modelCount: availableModels.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to reload router config:', error);
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        type: 'server_error',
        code: 'reload_error'
      }
    }, { status: 500 });
  }
}