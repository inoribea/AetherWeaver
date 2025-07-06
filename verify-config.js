const fs = require('fs');

try {
  const config = JSON.parse(fs.readFileSync('models-config.json', 'utf-8'));
  
  console.log('🎯 配置验证结果');
  console.log('================');
  console.log('默认模型:', config.selection_strategy.default_model);
  console.log('降级链:', config.selection_strategy.fallback_chain.join(' -> '));
  console.log('速度优化:', config.selection_strategy.speed_optimization);
  console.log('质量优化:', config.selection_strategy.quality_optimization);
  console.log('');
  
  console.log('gemini-flash-lite 配置:');
  const geminiLite = config.models['gemini-flash-lite'];
  console.log('- 速度评分:', geminiLite.speed_rating);
  console.log('- 质量评分:', geminiLite.quality_rating);
  console.log('- 成本 (per 1k tokens):', geminiLite.cost_per_1k_tokens);
  console.log('');
  
  console.log('各任务的首选模型:');
  for (const [task, rule] of Object.entries(config.routing_rules)) {
    console.log(`- ${task}: ${rule.preferred_models[0]}`);
  }
  
  console.log('');
  console.log('✅ 配置验证完成');
  
} catch (error) {
  console.error('❌ 配置验证失败:', error.message);
}