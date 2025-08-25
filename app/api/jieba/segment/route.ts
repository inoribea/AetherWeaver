import { NextRequest, NextResponse } from 'next/server';
import { localSegment } from './tokenizer';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: 'Invalid input text' }, { status: 400 });
    }

    const tokens = localSegment(text);

    return NextResponse.json({ result: tokens });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}