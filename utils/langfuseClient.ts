import fetch from 'node-fetch';

const LANGFUSE_API_URL = process.env.LANGFUSE_API_URL || '';
const LANGFUSE_API_KEY = process.env.LANGFUSE_API_KEY || '';

if (!LANGFUSE_API_URL || !LANGFUSE_API_KEY) {
  console.warn('LangFuse API URL or API KEY is not set in environment variables.');
}

interface EventData {
  event: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

export async function sendEvent(eventData: EventData) {
  if (!LANGFUSE_API_URL || !LANGFUSE_API_KEY) {
    return;
  }

  try {
    await fetch(LANGFUSE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LANGFUSE_API_KEY}`,
      },
      body: JSON.stringify(eventData),
    });
  } catch (error) {
    console.error('Failed to send event to LangFuse:', error);
  }
}