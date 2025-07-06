import { NextResponse } from 'next/server';
import { intelligentRouter } from '@/utils/intelligent-router';

// POST - 重新加载路由器配置
export async function POST() {
  try {
    intelligentRouter.reloadConfig();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Router configuration reloaded successfully',
      availableModels: intelligentRouter.getAvailableModels(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to reload router config:', error);
    return NextResponse.json({ 
      error: 'Failed to reload configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}