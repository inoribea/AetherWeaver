// 模拟 detectModelSwitchRequest 函数进行测试
function detectModelSwitchRequest(content) {
  const lowerContent = content.toLowerCase();
  
  // 扩展的模型切换关键词
  const switchKeywords = [
    '切换到', '使用', '换成', '改用', '换到', '用',
    '让', '请', '要', '想要', '希望',
    '换个', '来个', '要个', '用个',
    'switch to', 'use', 'change to', 'with'
  ];
  
  // 检查是否包含切换关键词
  const hasSwitchKeyword = switchKeywords.some(keyword => lowerContent.includes(keyword));
  
  if (hasSwitchKeyword) {
    // 模型名称映射（包括常用别名）
    const modelMappings = {
      // GPT 4.1 系列 - 修正：gpt4.1 应该映射到自己
      'gpt4.1': 'gpt4.1',
      'gpt-4.1': 'gpt4.1',
      '4.1': 'gpt4.1',
      
      // GPT 4o 系列
      'gpt-4o': 'gpt-4o-all',
      'gpt4o': 'gpt-4o-all',
      'gpt4': 'gpt-4o-all',
      'gpt': 'gpt-4o-all',
      '4o': 'gpt-4o-all',
      
      // Claude 系列
      'claude': 'claude-sonnet-4-all',
      'sonnet': 'claude-sonnet-4-all',
      
      // DeepSeek 系列
      'deepseek': 'deepseek-reasoner',
      'reasoner': 'deepseek-reasoner',
      
      // Qwen 系列
      'qwen': 'qwen-turbo',
      'qvq': 'qvq-plus',
      
      // Gemini 系列
      'gemini': 'gemini-flash-lite',
      'flash': 'gemini-flash-lite',
      'lite': 'gemini-flash-lite',
      
      // 混元系列
      'hunyuan': 'hunyuan-turbos-latest',
      '混元': 'hunyuan-turbos-latest',
      't1': 'hunyuan-t1-latest',
      
      // 其他模型
      'o4': 'o4-mini',
      'mini': 'o4-mini'
    };
    
    // 检查"高级模型"等形容词请求
    const qualityKeywords = [
      '高级', '更好', '强', '厉害', '顶级', '最好',
      'better', 'advanced', 'premium', 'top', 'best'
    ];
    
    const hasQualityKeyword = qualityKeywords.some(keyword => lowerContent.includes(keyword));
    
    if (hasQualityKeyword) {
      // 智能选择高质量模型
      const highQualityModels = [
        'claude-sonnet-4-all',  // quality_rating: 10
        'gpt4.1',               // quality_rating: 10
        'gpt-4o-all',           // quality_rating: 9
        'hunyuan-t1-latest',    // quality_rating: 9
        'deepseek-reasoner'     // quality_rating: 9
      ];
      
      // 返回最高质量的模型
      return highQualityModels[0]; // claude-sonnet-4-all
    }
    
    // 检查所有可能的模型名称
    for (const [alias, modelName] of Object.entries(modelMappings)) {
      if (lowerContent.includes(alias)) {
        return modelName;
      }
    }
    
    // 直接匹配完整模型名称
    const fullModelRegex = /(gpt4\.1|gpt-4o-all|claude-sonnet-4-all|o4-mini|deepseek-chat|deepseek-reasoner|qwen-turbo|gemini-flash-lite|gemini-flash|hunyuan-turbos-latest|hunyuan-t1-latest|qvq-plus)/g;
    const match = fullModelRegex.exec(lowerContent);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

console.log('🧪 测试模型切换检测修复效果\n');

// 测试用例
const testCases = [
  // 基本模型切换
  { input: '换成gpt4.1', expected: 'gpt4.1' },
  { input: '使用gpt-4.1', expected: 'gpt4.1' },
  { input: '要4.1', expected: 'gpt4.1' },
  
  // GPT 4o 系列
  { input: '换成gpt4o', expected: 'gpt-4o-all' },
  { input: '用gpt-4o', expected: 'gpt-4o-all' },
  { input: '要4o', expected: 'gpt-4o-all' },
  
  // 高级模型请求
  { input: '换个高级的模型', expected: 'claude-sonnet-4-all' },
  { input: '要个更好的', expected: 'claude-sonnet-4-all' },
  { input: '来个厉害的', expected: 'claude-sonnet-4-all' },
  { input: '用个顶级的', expected: 'claude-sonnet-4-all' },
  
  // 其他模型
  { input: '换成claude', expected: 'claude-sonnet-4-all' },
  { input: '用deepseek', expected: 'deepseek-reasoner' },
  { input: '要qwen', expected: 'qwen-turbo' },
  { input: '换成gemini', expected: 'gemini-flash-lite' },
  
  // 复杂句式
  { input: '我觉得你胜任不了这个工作，换个高级的模型来', expected: 'claude-sonnet-4-all' },
  { input: '你解决不了，换成gpt4.1', expected: 'gpt4.1' },
  
  // 不应该匹配的情况
  { input: '今天天气不错', expected: null },
  { input: '帮我写个程序', expected: null }
];

console.log('测试结果：\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = detectModelSwitchRequest(testCase.input);
  const isCorrect = result === testCase.expected;
  
  console.log(`${index + 1}. "${testCase.input}"`);
  console.log(`   期望: ${testCase.expected}`);
  console.log(`   实际: ${result}`);
  console.log(`   结果: ${isCorrect ? '✅ 通过' : '❌ 失败'}\n`);
  
  if (isCorrect) {
    passed++;
  } else {
    failed++;
  }
});

console.log(`\n📊 测试总结:`);
console.log(`✅ 通过: ${passed}/${testCases.length}`);
console.log(`❌ 失败: ${failed}/${testCases.length}`);
console.log(`📈 成功率: ${Math.round((passed / testCases.length) * 100)}%`);

if (failed === 0) {
  console.log('\n🎉 所有测试通过！模型切换检测修复成功！');
} else {
  console.log('\n⚠️  有测试失败，需要进一步调试。');
}