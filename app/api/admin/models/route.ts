import { NextRequest, NextResponse } from 'next/server';
import { intelligentRouter } from '@/utils/intelligent-router';
import fs from 'fs';
import path from 'path';

// GET - 获取当前模型配置
export async function GET() {
  try {
    const configPath = path.join(process.cwd(), 'models-config.json');
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    // 添加模型状态信息
    const availableModels = intelligentRouter.getAvailableModels();
    const configWithStatus = {
      ...config,
      modelStatus: Object.keys(config.models).reduce((acc, modelName) => {
        acc[modelName] = {
          available: availableModels.includes(modelName),
          capabilities: intelligentRouter.getModelCapabilities(modelName)
        };
        return acc;
      }, {} as Record<string, any>)
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
    
    // 重新加载路由器配置
    intelligentRouter.reloadConfig();
    
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
    
    // 运行时添加模型
    intelligentRouter.addModel(modelName, modelConfig);
    
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
    
    // 重新加载配置
    intelligentRouter.reloadConfig();
    
    return NextResponse.json({ success: true, message: `Model ${modelName} deleted successfully` });
  } catch (error) {
    console.error('Failed to delete model:', error);
    return NextResponse.json({ error: 'Failed to delete model' }, { status: 500 });
  }
}