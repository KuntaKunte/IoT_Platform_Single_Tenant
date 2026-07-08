import request from 'supertest';
import app from '../src/app.js';

describe('metrics endpoint', () => {
  it('exposes real Prometheus-format metrics including HTTP and process metrics', async () => {
    // Generate some real traffic first so the histogram has at least one sample.
    await request(app).get('/health');
    await request(app).get('/health');

    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('http_request_duration_seconds');
    expect(response.text).toContain('process_resident_memory_bytes');
    expect(response.text).toMatch(/http_request_duration_seconds_count\{[^}]*route="\/health"[^}]*\} \d+/);
  });
});
