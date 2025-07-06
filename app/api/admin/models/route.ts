import { NextRequest, NextResponse } from 'next/server';
import {
  intelligentRouter as unifiedRouter,
  getAvailableModels,
  analyzeModelCapabilities,
  reloadModelConfiguration
} from '@/utils/unified-router';
import fs from 'fs';
import path from 'path';

// GET - 获取当前模型配置
export async function GET() {
  try {
    const configPath = path.join(process.cwd(), 'models-config.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    // 使用统一路由器添加模型状态信息
    const availableModels = getAvailableModels();
    const configWithStatus = {
      ...config,
      modelStatus: Object.keys(config.models).reduce((acc, modelName) => {
        const modelInfo = availableModels.find(m => m.id === modelName);
        acc[modelName] = {
          available: modelInfo?.available || false,
          capabilities: analyzeModelCapabilities(modelName),
          cost_per_1k_tokens: modelInfo?.cost_per_1k_tokens || 0,
          speed_rating: modelInfo?.speed_rating || 0,
          quality_rating: modelInfo?.quality_rating || 0
        };
        return acc;
      }, {} as Record<string, any>),
      routerInfo: {
        type: 'unified-router',
        version: '1.0.0',
        features: ['semantic-routing', 'capability-matching', 'fallback-chains', 'dynamic-registration'],
        totalModels: availableModels.length,
        availableModels: availableModels.filter(m => m.available).length
      }
    };
    
    return NextResponse.json(configWithStatus);
  } catch (error) {
    console.error('Failed to load models config:', error);
    return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 });
  }
}

// POST - 保存模型配置
export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    const configPath = path.join(process.cwd(), 'models-config.json');
    
    // 验证配置格式
    if (!config.models || !config.routing_rules || !config.selection_strategy) {
      return NextResponse.json({ error: 'Invalid configuration format' }, { status: 400 });
    }
    
    // 保存配置文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    // 重新加载统一路由器配置
    await reloadModelConfiguration();
    
    return NextResponse.json({ success: true, message: 'Configuration saved successfully' });
  } catch (error) {
    console.error('Failed to save models config:', error);
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
  }
}

// PUT - 添加或更新单个模型
export async function PUT(request: NextRequest) {
  try {
    const { modelName, modelConfig } = await request.json();
    
    if (!modelName || !modelConfig) {
      return NextResponse.json({ error: 'Model name and config are required' }, { status: 400 });
    }
    
    // 运行时添加模型到统一路由器
    unifiedRouter.registerModel({
      id: modelName,
      ...modelConfig
    });
    
    // 保存到配置文件
    const configPath = path.join(process.cwd(), 'models-config.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    config.models[modelName] = modelConfig;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    return NextResponse.json({ success: true, message: `Model ${modelName} added successfully` });
  } catch (error) {
    console.error('Failed to add model:', error);
    return NextResponse.json({ error: 'Failed to add model' }, { status: 500 });
  }
}

// DELETE - 删除模型
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelName = searchParams.get('model');
    
    if (!modelName) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }
    
    const configPath = path.join(process.cwd(), 'models-config.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    if (!config.models[modelName]) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    
    delete config.models[modelName];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    // 重新加载统一路由器配置
    await reloadModelConfiguration();
    
    return NextResponse.json({ success: true, message: `Model ${modelName} deleted successfully` });
  } catch (error) {
    console.error('Failed to delete model:', error);
    return NextResponse.json({ error: 'Failed to delete model' }, { status: 500 });
  }
}