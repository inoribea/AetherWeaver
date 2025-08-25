import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: 'Invalid input text' }, { status: 400 });
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

    return NextResponse.json({ result: tokens });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}