import { POST } from '../route';
import { NextRequest } from 'next/server';

function makeRequest(body: any) {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Integration tests for /api/chat', () => {
  it('should return 200 with valid string message', async () => {
    const req = makeRequest({ message: 'Hello world', sessionId: 'test-session' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('response');
    expect(typeof data.response).toBe('string');
  });

  it('should return 200 with message object', async () => {
    const req = makeRequest({ message: { content: 'Hello object' }, sessionId: 'test-session' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('response');
  });

  it('should handle missing message gracefully', async () => {
    const req = makeRequest({ sessionId: 'test-session' });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should return 503 for invalid message type', async () => {
    const req = makeRequest({ message: 12345, sessionId: 'test-session' });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });
});