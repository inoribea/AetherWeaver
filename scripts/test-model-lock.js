// 测试模型锁定机制
const testModelLock = async () => {
  const baseUrl = 'http://localhost:3000/api/chat';
  
  console.log('🧪 测试模型锁定机制...\n');
  
  // 测试1: 用户明确指定模型（优先级1）
  console.log('测试1: 用户明确指定模型（优先级1）');
  const test1 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '你好' }],
      model: 'deepseek-chat',
      currentModel: 'gpt-4o-all'
    })
  });
  
  if (test1.ok) {
    const selectedModel = test1.headers.get('x-selected-model');
    console.log(`✅ 选中的模型: ${selectedModel}`);
    console.log(`预期: deepseek-chat (用户指定优先级最高)`);
    console.log(`结果: ${selectedModel === 'deepseek-chat' ? '✅ 通过' : '❌ 失败'}\n`);
  } else {
    console.log('❌ 请求失败\n');
  }
  
  // 测试2: 会话锁定模型（优先级2）
  console.log('测试2: 会话锁定模型（优先级2）');
  const test2 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '你好' }],
      model: 'auto',
      currentModel: 'claude-sonnet-4-all'
    })
  });
  
  if (test2.ok) {
    const selectedModel = test2.headers.get('x-selected-model');
    console.log(`✅ 选中的模型: ${selectedModel}`);
    console.log(`预期: claude-sonnet-4-all (会话锁定)`);
    console.log(`结果: ${selectedModel === 'claude-sonnet-4-all' ? '✅ 通过' : '❌ 失败'}\n`);
  } else {
    console.log('❌ 请求失败\n');
  }
  
  // 测试3: 自动路由（优先级3）
  console.log('测试3: 自动路由（优先级3）');
  const test3 = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '你好' }],
      model: 'auto'
    })
  });
  
  if (test3.ok) {
    const selectedModel = test3.headers.get('x-selected-model');
    console.log(`✅ 选中的模型: ${selectedModel}`);
    console.log(`预期: 自动路由选择的模型`);
    console.log(`结果: ${selectedModel ? '✅ 通过' : '❌ 失败'}\n`);
  } else {
    console.log('❌ 请求失败\n');
  }
  
  console.log('🎉 模型锁定机制测试完成！');
};

// 运行测试
testModelLock().catch(console.error);