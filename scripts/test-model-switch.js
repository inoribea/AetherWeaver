const { detectModelSwitchRequest } = require('../utils/openai-compat');

// 测试模型切换检测
const testCases = [
  "让GPT来回答",
  "用Claude处理",
  "切换到deepseek",
  "换成qwen",
  "要GPT4",
  "希望用sonnet",
  "让gemini分析",
  "用reasoner来解决",
  "switch to claude",
  "use gpt"
];

console.log('🧪 测试模型切换检测功能...\n');

testCases.forEach((testCase, index) => {
  const result = detectModelSwitchRequest(testCase);
  console.log(`${index + 1}. "${testCase}" -> ${result || '未检测到'}`);
});

console.log('\n✅ 测试完成！');
