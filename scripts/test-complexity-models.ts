/**
 * 复杂度模型列表环境变量配置测试脚本
 * 测试从环境变量读取的高中低复杂度模型优先级列表
 */

import { routeRequest } from '../utils/unified-router';

interface TestCase {
  name: string;
  messages: Array<{ role: string; content: string }>;
  expectedComplexity: 'low' | 'medium' | 'high';
  description: string;
}

const testCases: TestCase[] = [
  {
    name: '低复杂度任务',
    messages: [
      { role: 'user', content: '你好' }
    ],
    expectedComplexity: 'low',
    description: '简单问候，应该使用低复杂度模型列表'
  },
  {
    name: '中等复杂度任务',
    messages: [
      { role: 'user', content: '请帮我写一个Python函数来计算斐波那契数列' }
    ],
    expectedComplexity: 'medium',
    description: '中等编程任务，应该使用中等复杂度模型列表'
  },
  {
    name: '高复杂度任务',
    messages: [
      { role: 'user', content: '请详细分析并设计一个完整的分布式微服务架构，包括服务拆分、数据一致性、负载均衡、容错机制等全面方案' }
    ],
    expectedComplexity: 'high',
    description: '复杂系统设计，应该使用高复杂度模型列表'
  }
];

function getEnvComplexityModels() {
  return {
    high: process.env.COMPLEXITY_HIGH_MODELS || '',
    medium: process.env.COMPLEXITY_MEDIUM_MODELS || '',
    low: process.env.COMPLEXITY_LOW_MODELS || ''
  };
}

function parseModelList(envVar: string): string[] {
  if (!envVar.trim()) return [];
  return envVar.split(',').map(model => model.trim()).filter(model => model);
}

export async function testComplexityModels(): Promise<void> {
  console.log('🧪 测试复杂度模型列表环境变量配置...\n');

  const envModels = getEnvComplexityModels();
  console.log('📋 当前环境变量配置:');
  console.log(`  高复杂度模型: ${envModels.high || '(未设置，使用默认)'}`);
  console.log(`  中复杂度模型: ${envModels.medium || '(未设置，使用默认)'}`);
  console.log(`  低复杂度模型: ${envModels.low || '(未设置，使用默认)'}`);
  console.log('');

  const modelLists = {
    high: parseModelList(envModels.high),
    medium: parseModelList(envModels.medium),
    low: parseModelList(envModels.low)
  };

  console.log('📊 解析后的模型列表:');
  console.log(`  高复杂度: [${modelLists.high.join(', ') || '使用默认'}]`);
  console.log(`  中复杂度: [${modelLists.medium.join(', ') || '使用默认'}]`);
  console.log(`  低复杂度: [${modelLists.low.join(', ') || '使用默认'}]`);
  console.log('');

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`📋 测试: ${testCase.name}`);
    console.log(`📝 描述: ${testCase.description}`);
    let preview = testCase.messages[0].content;
    if (preview.length > 80) {
      preview = preview.substring(0, 80) + '...';
    }
    console.log(`📝 输入: ${preview}`);

    try {
      const decision = await routeRequest({ messages: testCase.messages });
      const selectedModel = decision.selectedModel;
      const expectedModelList = modelLists[testCase.expectedComplexity];

      console.log(`🎯 选择模型: ${selectedModel}`);
      console.log(`🔍 路由策略: ${decision.metadata.routingStrategy}`);
      console.log(`📊 置信度: ${decision.confidence.toFixed(2)}`);
      console.log(`💭 推理: ${decision.reasoning}`);

      let testPassed = false;
      if (expectedModelList.length > 0) {
        testPassed = expectedModelList.includes(selectedModel);
        console.log(`📋 期望模型列表: [${expectedModelList.join(', ')}]`);
      } else {
        testPassed = true;
        console.log(`📋 使用默认模型配置`);
      }
      console.log(`✅ 测试结果: ${testPassed ? '通过' : '失败'}`);

      if (testPassed) {
        passedTests++;
      }
    } catch (err) {
      console.log(`❌ 测试失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log('─'.repeat(80));
  }

  console.log(`\n📊 测试总结:`);
  console.log(`✅ 通过: ${passedTests}/${totalTests}`);
  console.log(`❌ 失败: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  console.log('\n💡 环境变量配置建议:');
  console.log('请在 .env.local 文件中添加以下配置:');
  console.log('```');
  console.log('COMPLEXITY_HIGH_MODELS="claude-sonnet-4-all,gpt-5-all,deepseek-reasoner,hunyuan-t1-latest"');
  console.log('COMPLEXITY_MEDIUM_MODELS="gpt-5-all,gemini-flash,qwen-turbo,hunyuan-turbos-latest,claude-sonnet-4-all"');
  console.log('COMPLEXITY_LOW_MODELS="gemini-flash,qwen-turbo,hunyuan-turbos-latest,gpt-5-all"');
  console.log('```');
}

if (require.main === module) {
  testComplexityModels().catch(console.error);
}