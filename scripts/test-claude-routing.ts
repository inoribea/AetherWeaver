/**
 * Claude模型复杂度阈值路由测试脚本
 * 测试Claude模型是否只处理高复杂度任务
 */

import { routeRequest } from '../utils/unified-router';

// 测试用例
const testCases = [
  {
    name: '低复杂度任务 - 简单问候',
    messages: [
      { role: 'user', content: '你好' }
    ],
    expectedComplexity: 'low',
    shouldUseClaude: false
  },
  {
    name: '中等复杂度任务 - 一般问题',
    messages: [
      { role: 'user', content: '请帮我写一个简单的Python函数来计算两个数的和' }
    ],
    expectedComplexity: 'medium',
    shouldUseClaude: false
  },
  {
    name: '高复杂度任务 - 复杂推理',
    messages: [
      { role: 'user', content: '请详细分析并解释量子计算的基本原理，包括量子叠加、量子纠缠和量子测量的概念，并说明它们如何在量子算法中发挥作用。同时，请比较量子计算与经典计算的优势和局限性。' }
    ],
    expectedComplexity: 'high',
    shouldUseClaude: true
  },
  {
    name: '高复杂度任务 - 创作任务',
    messages: [
      { role: 'user', content: '请创作一个完整的科幻小说故事，包含复杂的世界观设定、多层次的人物关系、深刻的哲学思考，以及引人入胜的情节发展。故事应该探讨人工智能与人类意识的关系。' }
    ],
    expectedComplexity: 'high',
    shouldUseClaude: true
  },
  {
    name: '高复杂度任务 - 系统设计',
    messages: [
      { role: 'user', content: '请设计一个分布式微服务架构，包括服务拆分策略、数据一致性保证、负载均衡、容错机制、监控告警等完整方案，并提供详细的技术选型和实现方案。' }
    ],
    expectedComplexity: 'high',
    shouldUseClaude: true
  },
  {
    name: '明确指定Claude - 应该使用Claude',
    messages: [
      { role: 'user', content: '让Claude来帮我写一个简单的hello world程序' }
    ],
    expectedComplexity: 'low',
    shouldUseClaude: true // 明确指定应该使用Claude
  }
];

async function runTest() {
  console.log('🧪 开始测试Claude模型复杂度阈值路由...\n');

  let passedTests = 0;
  const totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`📋 测试: ${testCase.name}`);
    console.log(`📝 输入: ${testCase.messages[0].content.substring(0, 100)}${testCase.messages[0].content.length > 100 ? '...' : ''}`);

    try {
      const decision = await routeRequest({
        messages: testCase.messages
      });

      const usedClaude = decision.selectedModel === 'claude-sonnet-4-all';
      const testPassed = usedClaude === testCase.shouldUseClaude;

      console.log(`🎯 选择模型: ${decision.selectedModel}`);
      console.log(`🔍 路由策略: ${decision.metadata.routingStrategy}`);
      console.log(`📊 置信度: ${decision.confidence.toFixed(2)}`);
      console.log(`💭 推理: ${decision.reasoning}`);
      console.log(`✅ 测试结果: ${testPassed ? '通过' : '失败'}`);

      if (!testPassed) {
        console.log(`❌ 预期使用Claude: ${testCase.shouldUseClaude}, 实际使用: ${usedClaude}`);
      }

      if (testPassed) {
        passedTests++;
      }

    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log(`❌ 测试失败: ${error.message}`);
      } else {
        console.log(`❌ 测试失败: Unknown error`);
      }
    }

    console.log('─'.repeat(80));
  }

  console.log('\n📊 测试总结:');
  console.log(`✅ 通过: ${passedTests}/${totalTests}`);
  console.log(`❌ 失败: ${totalTests - passedTests}/${totalTests}`);
  console.log(`📈 成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过！Claude模型复杂度阈值路由功能正常！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查路由逻辑。');
  }
}

// 运行测试
if (require.main === module) {
  runTest().catch(console.error);
}

export { runTest, testCases };