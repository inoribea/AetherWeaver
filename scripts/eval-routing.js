// scripts/eval-routing.js
// Offline routing evaluation. Compares keyword-based routing vs first-model vs random.
// Usage: node scripts/eval-routing.js [--runs N]
// Output: scripts/eval-results.json

const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'models-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const keywords = config.keywords || {};
const models = Object.keys(config.models);

const testQueries = [
  { content: '请分析这张图片的内容', expected: 'vision' },
  { content: 'Analyze this photo and describe what you see', expected: 'vision' },
  { content: '证明勾股定理的详细步骤', expected: 'reasoning' },
  { content: 'Explain why the sky is blue using physics', expected: 'reasoning' },
  { content: '写一首关于春天的诗', expected: 'chinese' },
  { content: '用中文解释量子计算的基本原理', expected: 'chinese' },
  { content: 'Write a Python function to implement quicksort', expected: 'code' },
  { content: '调试这段代码：function add(a,b) { return a-b }', expected: 'code' },
  { content: '写一个关于AI觉醒的短篇故事', expected: 'creative' },
  { content: 'Write a poem about the ocean', expected: 'creative' },
  { content: '搜索最新的AI新闻', expected: 'search' },
  { content: 'Search for the latest TypeScript features', expected: 'search' },
  { content: '用JSON格式输出用户信息', expected: 'structured' },
  { content: '提取这段文本中的关键信息并以表格形式呈现', expected: 'structured' },
  { content: 'Hello, how are you today?', expected: 'default' },
  { content: '计算 234 * 567 的结果', expected: 'math' },
];

function keywordStrategy(content) {
  const text = content.toLowerCase();
  const intents = [];
  for (const [category, words] of Object.entries(keywords)) {
    const matchCount = words.filter(w => text.includes(w.toLowerCase())).length;
    if (matchCount > 0) {
      intents.push({ category, score: matchCount / words.length });
    }
  }
  intents.sort((a, b) => b.score - a.score);
  return intents.length > 0 ? intents[0].category : 'default';
}

function firstModelStrategy() {
  return models[0] || 'gemini-flash-lite';
}

function randomStrategy() {
  return models[Math.floor(Math.random() * models.length)];
}

const categoryToRule = {
  vision: 'vision_tasks',
  reasoning: 'reasoning_tasks',
  chinese: 'chinese_tasks',
  code: 'code_tasks',
  creative: 'creative_tasks',
  search: 'search_tasks',
  structured: 'structured_output',
  math: 'reasoning_tasks',
  default: 'basic',
};

const runs = parseInt(process.argv[3] || '1', 10);
const results = [];

for (const query of testQueries) {
  const detected = keywordStrategy(query.content);
  const rule = categoryToRule[detected] || 'basic';
  const preferred = config.routing_rules?.[rule]?.preferred_models || [];
  for (let i = 0; i < runs; i++) {
    results.push({
      query: query.content.substring(0, 60),
      expectedCategory: query.expected,
      detectedCategory: detected,
      match: detected === query.expected,
      routingRule: rule,
      preferredModels: preferred,
      firstModel: firstModelStrategy(),
      randomModel: randomStrategy(),
    });
  }
}

const total = results.length;
const correct = results.filter(r => r.match).length;
const accuracy = total > 0 ? (correct / total * 100).toFixed(1) : 0;

const byCategory = {};
for (const r of results) {
  const cat = r.expectedCategory;
  byCategory[cat] = byCategory[cat] || { total: 0, correct: 0 };
  byCategory[cat].total++;
  if (r.match) byCategory[cat].correct++;
}

const categoryAccuracy = {};
for (const [cat, stats] of Object.entries(byCategory)) {
  categoryAccuracy[cat] = {
    accuracy: (stats.correct / stats.total * 100).toFixed(1) + '%',
    samples: stats.total,
  };
}

function countModels(key) {
  const dist = {};
  for (const r of results) {
    const model = typeof r[key] === 'string' ? r[key] : (r[key][0] || 'unknown');
    dist[model] = (dist[model] || 0) + 1;
  }
  return dist;
}

const report = {
  evaluatedAt: new Date().toISOString(),
  totalQueries: total,
  runsPerQuery: runs,
  accuracy: accuracy + '%',
  byCategory: categoryAccuracy,
  modelDistribution: {
    keywordPreferred: countModels('preferredModels'),
    firstModel: countModels('firstModel'),
    random: countModels('randomModel'),
  },
  results: results.slice(0, 20),
};

const outputPath = path.join(process.cwd(), 'scripts', 'eval-results.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log('PASS: Eval complete: ' + correct + '/' + total + ' correct (' + accuracy + '%)');
console.log('Report saved to: ' + outputPath);
console.log('Category accuracy:', JSON.stringify(categoryAccuracy, null, 2));