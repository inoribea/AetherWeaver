export interface JiebaLambdaRequest {
  text: string;
}

export interface JiebaLambdaResponse {
  result?: string[];
  error?: string;
}

const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const JIEBA_LAMBDA_URL = `${NEXT_PUBLIC_APP_URL}/api/jieba/segment`;

export async function segmentViaLambda(text: string): Promise<string[]> {
  const payload: JiebaLambdaRequest = { text };

  const response = await fetch(JIEBA_LAMBDA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Lambda request failed: ${response.statusText}`);
  }

  const data: JiebaLambdaResponse = await response.json();

  if (data.error) {
    throw new Error(`Lambda response error: ${data.error}`);
  }

  if (!data.result) {
    throw new Error('Lambda response missing result');
  }

  return data.result;
}