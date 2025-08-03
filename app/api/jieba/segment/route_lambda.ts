import { NextRequest, NextResponse } from 'next/server';
import { segmentViaLambda } from '../lambdaClient';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: 'Invalid input text' }, { status: 400 });
    }

    const result = await segmentViaLambda(text);

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}