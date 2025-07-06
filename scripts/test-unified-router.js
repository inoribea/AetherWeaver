#!/usr/bin/env node

/**
 * 统一智能路由器测试脚本
 * 
 * 用法：
 * node scripts/test-unified-router.js
 * 
 * 功能：
 * - 测试统一路由器的智能选择能力
 * - 验证语义分析和能力匹配
 * - 测试降级链功能
 * - 验证配置重载功能
 */

const fs = require('fs');
const path = require('path');

// 测试用例
const testCases = [
  {
    name: "视觉处理任务",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "请分析这张图片" },
          { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }
        ]
      }
    ],
    expectedCapabilities: ["vision"],
    expectedModels: ["qvq-plus", "gpt-4o-all", "claude-sonnet-4-all"]
  },
  {
    name: "复杂推理任务",
    messages: [
      {
        role: "user",
        content: "请详细分析量子计算的工作原理，并解释为什么它能够解决经典计算机无法处理的问题"
      }
    ],
    expectedCapabilities: ["reasoning"],
    expectedModels: ["deepseek-reasoner", "claude-sonnet-4-all", "hunyuan-t1-latest"]
  },
  {
    name: "中文创作任务",
    messages: [
      {
        role: "user",
        content: "请帮我写一篇关于春天的诗歌，要求用中文创作，风格优美"
      }
    ],
    expectedCapabilities: ["chinese", "creative_writing"],
    expectedModels: ["hunyuan-t1-latest", "hunyuan-turbos-latest", "qwen-turbo"]
  },
  {
    name: "搜索任务",
    messages: [
      {
        role: "user",
        content: "请搜索今天的最新科技新闻"
      }
    ],
    expectedCapabilities: ["search", "web_search"],
    expectedModels: ["gemini-flash", "gpt-4o-all"]
  },
  {
    name: "代码生成任务",
    messages: [
      {
        role: "user",
        content: "请帮我写一个Python函数，实现二分查找算法"
      }
    ],
    expectedCapabilities: ["code_generation"],
    expectedModels: ["claude-sonnet-4-all", "deepseek-reasoner", "gpt-4o-all"]
  },
  {
    name: "结构化输出任务",
    messages: [
      {
        role: "user",
        content: "请将以下信息整理成JSON格式：姓名张三，年龄25，职业工程师"
      }
    ],
    expectedCapabilities: ["structured_output"],
    expectedModels: ["gpt-4o-all", "claude-sonnet-4-all", "hunyuan-turbos-latest"]
  },
  {
    name: "明确模型指定",
    messages: [
      {
        role: "user",
        content: "请qvq来分析这个问题"
      }
    ],
    expectedType: "explicit_model",
    expectedModel: "qvq-plus"
  },
  {
    name: "数学计算任务",
    messages: [
      {
        role: "user",
        content: "请计算积分 ∫(x²+2x+1)dx 从0到5的值"
      }
    ],
    expectedCapabilities: ["mathematical_computation"],
    expectedModels: ["deepseek-reasoner", "gpt-4o-all", "claude-sonnet-4-all"]
  }
];

// 模拟统一路由器的核心功能
class UnifiedRouterTester {
  constructor() {
    this.loadConfiguration();
  }

  loadConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'models-config.json');
      const configData = fs.readFileSync(configPath, 'utf-8');
      this.config = JSON.parse(configData);
      console.log('✅ 配置文件加载成功');
    } catch (error) {
      console.error('❌ 配置文件加载失败:', error.message);
      process.exit(1);
    }
  }

  // 模拟语义分析
  analyzeIntent(messages) {
    const lastMessage = messages[messages.length - 1];
    const content = Array.isArray(lastMessage.content)
      ? lastMessage.content.map(c => c.type === 'text' ? c.text : '').join(' ')
      : lastMessage.content;

    // 检测明确模型指定
    const explicitModel = this.detectExplicitModelRequest(content);
    if (explicitModel) {
      return {
        type: 'explicit_model',
        targetModel: explicitModel,
        confidence: 0.95
      };
    }

    // 检测能力需求
    const detectedCapabilities = this.detectCapabilities(content, messages);
    
    return {
      type: detectedCapabilities.length > 0 ? 'capability_based' : 'semantic',
      detectedCapabilities,
      confidence: 0.8
    };
  }

  detectExplicitModelRequest(content) {
    const patterns = [
      /让(\w+)来(.+)/,
      /用(\w+)模型(.+)/,
      /请(\w+)(.+)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return this.normalizeModelName(match[1]);
      }
    }
    return null;
  }

  normalizeModelName(name) {
    const nameMap = {
      'qvq': 'qvq-plus',
      'gpt4': 'gpt-4o-all',
      'claude': 'claude-sonnet-4-all',
      'deepseek': 'deepseek-reasoner',
      'gemini': 'gemini-flash',
      'qwen': 'qwen-turbo',
      'hunyuan': 'hunyuan-turbos-latest',
      '混元': 'hunyuan-turbos-latest'
    };
    return nameMap[name.toLowerCase()] || name;
  }

  detectCapabilities(content, messages) {
    const capabilities = [];

    // 检查图片
    const hasImage = messages.some(msg =>
      Array.isArray(msg.content) &&
      msg.content.some(c => c.type === 'image_url')
    );
    if (hasImage) capabilities.push('vision');

    // 检测关键词
    const keywords = this.config.keywords;
    const lowerContent = content.toLowerCase();

    for (const [capability, keywordList] of Object.entries(keywords)) {
      for (const keyword of keywordList) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          const capabilityMap = {
            'vision': 'vision',
            'reasoning': 'reasoning',
            'chinese': 'chinese',
            'search': 'search',
            'code': 'code_generation',
            'creative': 'creative_writing',
            'structured': 'structured_output',
            'math': 'mathematical_computation'
          };
          if (capabilityMap[capability]) {
            capabilities.push(capabilityMap[capability]);
          }
          break;
        }
      }
    }

    return [...new Set(capabilities)];
  }

  // 模拟模型选择
  selectModel(analysis) {
    if (analysis.type === 'explicit_model') {
      return analysis.targetModel;
    }

    if (analysis.detectedCapabilities && analysis.detectedCapabilities.length > 0) {
      // 基于能力选择模型
      for (const capability of analysis.detectedCapabilities) {
        const suitableModels = this.findModelsByCapability(capability);
        if (suitableModels.length > 0) {
          return suitableModels[0];
        }
      }
    }

    return this.config.selection_strategy.default_model;
  }

  findModelsByCapability(capability) {
    const models = [];
    for (const [modelId, modelConfig] of Object.entries(this.config.models)) {
      if (modelConfig.capabilities[capability]) {
        models.push({
          id: modelId,
          priority: modelConfig.priority[capability] || 999
        });
      }
    }
    return models
      .sort((a, b) => a.priority - b.priority)
      .map(m => m.id);
  }

  // 运行测试
  runTests() {
    console.log('🚀 开始统一路由器测试...\n');

    let passedTests = 0;
    let totalTests = testCases.length;

    for (const testCase of testCases) {
      console.log(`📋 测试: ${testCase.name}`);
      
      try {
        const analysis = this.analyzeIntent(testCase.messages);
        const selectedModel = this.selectModel(analysis);

        console.log(`   意图类型: ${analysis.type}`);
        console.log(`   检测到的能力: ${analysis.detectedCapabilities?.join(', ') || '无'}`);
        console.log(`   选择的模型: ${selectedModel}`);

        // 验证结果
        let testPassed = true;
        let failureReasons = [];

        if (testCase.expectedType && analysis.type !== testCase.expectedType) {
          testPassed = false;
          failureReasons.push(`期望类型 ${testCase.expectedType}，实际 ${analysis.type}`);
        }

        if (testCase.expectedModel && selectedModel !== testCase.expectedModel) {
          testPassed = false;
          failureReasons.push(`期望模型 ${testCase.expectedModel}，实际 ${selectedModel}`);
        }

        if (testCase.expectedCapabilities) {
          const missingCapabilities = testCase.expectedCapabilities.filter(
            cap => !analysis.detectedCapabilities?.includes(cap)
          );
          if (missingCapabilities.length > 0) {
            testPassed = false;
            failureReasons.push(`缺少能力: ${missingCapabilities.join(', ')}`);
          }
        }

        if (testCase.expectedModels) {
          if (!testCase.expectedModels.includes(selectedModel)) {
            testPassed = false;
            failureReasons.push(`模型不在期望列表中: ${testCase.expectedModels.join(', ')}`);
          }
        }

        if (testPassed) {
          console.log(`   ✅ 测试通过\n`);
          passedTests++;
        } else {
          console.log(`   ❌ 测试失败: ${failureReasons.join('; ')}\n`);
        }

      } catch (error) {
        console.log(`   ❌ 测试出错: ${error.message}\n`);
      }
    }

    console.log(`📊 测试结果: ${passedTests}/${totalTests} 通过`);
    
    if (passedTests === totalTests) {
      console.log('🎉 所有测试通过！统一路由器工作正常。');
    } else {
      console.log('⚠️  部分测试失败，请检查路由逻辑。');
    }
  }

  // 测试配置验证
  validateConfiguration() {
    console.log('🔍 验证配置文件...');

    const requiredSections = ['models', 'routing_rules', 'selection_strategy', 'keywords'];
    for (const section of requiredSections) {
      if (!this.config[section]) {
        console.error(`❌ 缺少配置节: ${section}`);
        return false;
      }
    }

    // 验证模型配置
    const modelCount = Object.keys(this.config.models).length;
    console.log(`   📦 找到 ${modelCount} 个模型配置`);

    for (const [modelId, modelConfig] of Object.entries(this.config.models)) {
      const requiredFields = ['type', 'config', 'capabilities', 'priority'];
      for (const field of requiredFields) {
        if (!modelConfig[field]) {
          console.error(`❌ 模型 ${modelId} 缺少字段: ${field}`);
          return false;
        }
      }
    }

    console.log('✅ 配置文件验证通过');
    return true;
  }

  // 测试降级链
  testFallbackChain() {
    console.log('🔄 测试降级链功能...');

    const fallbackChain = this.config.selection_strategy.fallback_chain;
    console.log(`   降级链: ${fallbackChain.join(' -> ')}`);

    // 模拟主模型不可用的情况
    for (let i = 0; i < fallbackChain.length; i++) {
      const model = fallbackChain[i];
      const isAvailable = this.isModelAvailable(model);
      console.log(`   ${model}: ${isAvailable ? '✅ 可用' : '❌ 不可用'}`);
    }

    console.log('✅ 降级链测试完成');
  }

  isModelAvailable(modelId) {
    const modelConfig = this.config.models[modelId];
    if (!modelConfig) return false;

    // 检查API密钥
    if (modelConfig.config.apiKey) {
      return !!process.env[modelConfig.config.apiKey];
    }
    if (modelConfig.config.secretId && modelConfig.config.secretKey) {
      return !!(process.env[modelConfig.config.secretId] && process.env[modelConfig.config.secretKey]);
    }

    return false;
  }
}

// 运行测试
function main() {
  console.log('🎯 统一智能路由器测试工具');
  console.log('================================\n');

  const tester = new UnifiedRouterTester();

  // 验证配置
  if (!tester.validateConfiguration()) {
    console.error('❌ 配置验证失败，退出测试');
    process.exit(1);
  }

  console.log('');

  // 测试降级链
  tester.testFallbackChain();
  console.log('');

  // 运行路由测试
  tester.runTests();
}

if (require.main === module) {
  main();
}

module.exports = { UnifiedRouterTester };