#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function addModel() {
  console.log('🤖 智能模型添加工具');
  console.log('================');
  
  try {
    // 读取现有配置
    const configPath = path.join(process.cwd(), 'models-config.json');
    let config;
    
    try {
      const configData = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configData);
    } catch (error) {
      console.error('❌ 无法读取配置文件:', error.message);
      process.exit(1);
    }
    
    // 收集模型信息
    console.log('\n📝 请输入模型信息:');
    
    const modelName = await question('模型名称 (例如: gpt-4o-mini): ');
    if (!modelName) {
      console.log('❌ 模型名称不能为空');
      process.exit(1);
    }
    
    if (config.models[modelName]) {
      const overwrite = await question(`⚠️  模型 ${modelName} 已存在，是否覆盖? (y/N): `);
      if (overwrite.toLowerCase() !== 'y') {
        console.log('❌ 取消添加');
        process.exit(0);
      }
    }
    
    console.log('\n🔧 模型类型:');
    console.log('1. OpenAI Compatible');
    console.log('2. DeepSeek');
    console.log('3. Alibaba Tongyi');
    console.log('4. Google Gemini');
    
    const typeChoice = await question('选择类型 (1-4): ');
    const typeMap = {
      '1': 'openai_compatible',
      '2': 'deepseek',
      '3': 'alibaba_tongyi',
      '4': 'google_gemini'
    };
    
    const modelType = typeMap[typeChoice];
    if (!modelType) {
      console.log('❌ 无效的类型选择');
      process.exit(1);
    }
    
    const apiKey = await question('API Key 环境变量名 (例如: OPENAI_API_KEY): ');
    const modelId = await question('模型ID (例如: gpt-4o-mini): ');
    const baseURL = await question('Base URL (可选，直接回车跳过): ');
    
    console.log('\n⚙️  模型参数:');
    const temperature = await question('Temperature (0.0-2.0, 默认0.7): ') || '0.7';
    const costPer1k = await question('成本每1K tokens (例如: 0.001): ') || '0.001';
    const speedRating = await question('速度评分 (1-10, 默认5): ') || '5';
    const qualityRating = await question('质量评分 (1-10, 默认5): ') || '5';
    
    console.log('\n🎯 模型能力 (输入 y 启用，其他跳过):');
    const capabilities = {};
    const capabilityList = [
      'vision', 'reasoning', 'tool_calling', 'search', 'chinese',
      'structured_output', 'agents', 'code_generation', 'creative_writing',
      'mathematical_computation', 'web_search'
    ];
    
    for (const capability of capabilityList) {
      const enabled = await question(`${capability}: `);
      capabilities[capability] = enabled.toLowerCase() === 'y';
    }
    
    console.log('\n📊 优先级设置 (1-10, 默认5):');
    const priority = {};
    const destinations = [
      'vision_processing', 'complex_reasoning', 'creative_writing',
      'code_generation', 'mathematical_computation', 'web_search',
      'document_retrieval', 'structured_analysis', 'agent_execution',
      'chinese_conversation', 'simple_chat'
    ];
    
    for (const destination of destinations) {
      const prio = await question(`${destination}: `) || '5';
      priority[destination] = parseInt(prio);
    }
    
    // 构建模型配置
    const modelConfig = {
      type: modelType,
      config: {
        apiKey,
        model: modelId,
        temperature: parseFloat(temperature),
        ...(baseURL && { baseURL })
      },
      capabilities,
      priority,
      cost_per_1k_tokens: parseFloat(costPer1k),
      speed_rating: parseInt(speedRating),
      quality_rating: parseInt(qualityRating)
    };
    
    // 添加到配置
    config.models[modelName] = modelConfig;
    
    // 保存配置
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('\n✅ 模型添加成功!');
    console.log(`📄 配置已保存到: ${configPath}`);
    console.log(`🚀 模型 ${modelName} 现在可以使用了`);
    
    // 显示配置摘要
    console.log('\n📋 配置摘要:');
    console.log(`- 名称: ${modelName}`);
    console.log(`- 类型: ${modelType}`);
    console.log(`- 成本: $${costPer1k}/1K tokens`);
    console.log(`- 速度: ${speedRating}/10`);
    console.log(`- 质量: ${qualityRating}/10`);
    console.log(`- 能力: ${Object.entries(capabilities).filter(([_, enabled]) => enabled).map(([cap, _]) => cap).join(', ')}`);
    
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  addModel();
}

module.exports = { addModel };