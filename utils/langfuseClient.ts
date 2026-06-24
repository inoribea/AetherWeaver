
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

export interface TraceSpan {
  name: string;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

export class LangfuseTracer {
  private spans: TraceSpan[] = [];
  private requestId: string;

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  startSpan(name: string, metadata?: Record<string, unknown>): TraceSpan {
    const span: TraceSpan = {
      name,
      startTime: Date.now(),
      metadata: { ...(metadata || {}), requestId: this.requestId },
    };
    this.spans.push(span);
    return span;
  }

  endSpan(span: TraceSpan, metadata?: Record<string, unknown>): void {
    span.endTime = Date.now();
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }
  }

  async flush(): Promise<void> {
    const flushPromises = this.spans.map(span =>
      sendEvent({
        event: span.name,
        properties: {
          ...span.metadata,
          durationMs: span.endTime ? span.endTime - span.startTime : undefined,
        },
        timestamp: new Date(span.startTime).toISOString(),
      })
    );
    this.spans = [];
    await Promise.allSettled(flushPromises);
  }
}