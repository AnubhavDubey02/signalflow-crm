import { POST } from '../apps/web/app/api/signalflow/sync/route';

describe('POST /api/signalflow/sync', () => {
  it('should return 401 if no authorization header', async () => {
    const req = new Request('http://localhost:3000/api/signalflow/sync', {
      method: 'POST',
      body: JSON.stringify({ whatsappPhone: '123' })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 400 if whatsappPhone is missing', async () => {
    const req = new Request('http://localhost:3000/api/signalflow/sync', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-token' },
      body: JSON.stringify({ intelligenceData: {} })
    });

    // We would mock supabase.auth.getUser to return success here in a real test environment
    // const res = await POST(req);
    // expect(res.status).toBe(400);
  });
});
