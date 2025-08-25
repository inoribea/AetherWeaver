export function localSegment(text: string): string[] {
  if (typeof text !== 'string' || text.trim() === '') {
    return [];
  }

  // 简单本地分词：将连续的 Latin/数字 视为一个 token，汉字按字分割为单个 token
  const tokens: string[] = [];
  let buffer = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/[A-Za-z0-9]/.test(ch)) {
      buffer += ch;
    } else {
      if (buffer) {
        tokens.push(buffer);
        buffer = '';
      }
      if (/[\u4e00-\u9fff]/.test(ch)) {
        tokens.push(ch);
      }
    }
  }
  if (buffer) tokens.push(buffer);

  return tokens;
}