/**
 * 将 /api/v1/chat/completions 格式的请求体转换成 /api/chat/route 的请求体格式
 * 示例用法：
 *   node convert_v1_to_chat_route_request.js
 */

function convertV1ToChatRouteRequest(v1RequestBody) {
  if (!v1RequestBody.messages || !Array.isArray(v1RequestBody.messages) || v1RequestBody.messages.length === 0) {
    throw new Error('Invalid v1 request body: missing messages array');
  }

  // 取最后一条消息内容作为 message 字段
  const lastMessage = v1RequestBody.messages[v1RequestBody.messages.length - 1];
  let messageContent = '';

  if (typeof lastMessage.content === 'string') {
    messageContent = lastMessage.content;
  } else if (Array.isArray(lastMessage.content)) {
    messageContent = lastMessage.content.map(c => (typeof c === 'string' ? c : c.text || '')).join('');
  } else {
    messageContent = lastMessage.content?.text || '';
  }

  return {
    message: messageContent,
    sessionId: v1RequestBody.sessionId || null, // 如果有会话ID可以传入
  };
}

// 示例测试
const exampleV1Request = {
  model: 'gpt-5-mini',
  messages: [
    { role: 'user', content: '你好，帮我写个测试示例。' }
  ],
  stream: false
};

try {
  const chatRouteRequest = convertV1ToChatRouteRequest(exampleV1Request);
  console.log('Converted /api/chat/route request body:\n', JSON.stringify(chatRouteRequest, null, 2));
} catch (err) {
  console.error('转换失败:', err.message);
}