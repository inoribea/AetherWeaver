#!/usr/bin/env node

const { intelligentRouter } = require('../utils/intelligent-router');

// 测试用例
const testCases = [
  {
    name: '图像分析',
    input: '请分析这张图片中的内容',
    hasImage: true,
    expectedDestination: 'vision_processing'
  },
  {
    name: '复杂推理',
    input: '如果一个人每天走10000步，一年能走多少公里？请详细分析计算过程',
    hasImage: false,
    expectedDestination: 'complex_reasoning'
  },
  {
    name: '代码生成',
    input: '用Python写一个快速排序算法',
    hasImage: false,
    expectedDestination: 'code_generation'
  },
  {
    name: '中文对话',
    input: '你好，请用中文和我聊天',
    hasImage: false,
    expectedDestination: 'chinese_conversation'
  },
  {
    name: '网络搜索',
    input: '最新的AI技术发展趋势是什么？',
    hasImage: false,
    expectedDestination: 'web_search'
  },
  {
    name: '数学计算',
    input: '计算积分 ∫(x²+2x+1)dx',
    hasImage: false,
    expectedDestination: 'mathematical_computation'
  },
  {
    name: '结构化分析',
    input: '请将以下文本转换为JSON格式',
    hasImage: false,
    expectedDestination: 'structured_analysis'
  },
  {
    name: '创意写作',
    input: '写一个关于未来世界的科幻故事',
    hasImage: false,
    expectedDestination: 'creative_writing'
  },
  {
    name: '简单聊天',
    input: '今天天气不错',
    hasImage: false,
    expectedDestination: 'simple_chat'
  }
];

async function testRouter() {
  console.log('🧪 智能路由器测试');
  console.log('==================');
  
  try {
    // 获取可用模型
    const availableModels = intelligentRouter.getAvailableModels();
    console.log(`\n📋 可用模型: ${availableModels.join(', ')}`);
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    console.log('\n🔍 开始测试路由决策...\n');
    
    for (const testCase of testCases) {
      console.log(`📝 测试: ${testCase.name}`);
      console.log(`   输入: "${testCase.input}"`);
      console.log(`   图像: ${testCase.hasImage ? '是' : '否'}`);
      
      try {
        const result = intelligentRouter.route(testCase.input, testCase.hasImage);
        
        console.log(`   🎯 目标: ${result.destination}`);
        console.log(`   🤖 模型: ${result.selectedModel}`);
        console.log(`   📊 置信度: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   💭 推理: ${result.reasoning}`);
        
        // 检查是否符合预期
        const passed = result.destination === testCase.expectedDestination;
        if (passed) {
          console.log(`   ✅ 通过`);
          passedTests++;
        } else {
          console.log(`   ❌ 失败 (期望: ${testCase.expectedDestination})`);
        }
        
        // 显示备选方案
        if (result.alternatives && result.alternatives.length > 0) {
          console.log(`   🔄 备选方案:`);
          result.alternatives.forEach((alt, index) => {
            console.log(`      ${index + 1}. ${alt.model} (分数: ${alt.score.toFixed(2)})`);
          });
        }
        
      } catch (error) {
        console.log(`   ❌ 错误: ${error.message}`);
      }
      
      console.log('');
    }
    
    // 测试结果总结
    console.log('📊 测试结果总结');
    console.log('================');
    console.log(`✅ 通过: ${passedTests}/${totalTests} (${(passedTests/totalTests*100).toFixed(1)}%)`);
    console.log(`❌ 失败: ${totalTests - passedTests}/${totalTests}`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 所有测试通过！智能路由系统工作正常');
    } else {
      console.log('\n⚠️  部分测试失败，请检查路由规则配置');
    }
    
    // 性能测试
    console.log('\n⚡ 性能测试');
    console.log('===========');
    const startTime = Date.now();
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      intelligentRouter.route('这是一个性能测试', false);
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    
    console.log(`🏃 平均路由时间: ${avgTime.toFixed(2)}ms`);
    console.log(`🚀 每秒可处理: ${Math.round(1000 / avgTime)} 个请求`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testRouter();
}

module.exports = { testRouter };