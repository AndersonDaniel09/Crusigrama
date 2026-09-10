const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('responde 200 con status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('crucigrama-backend');
  });

  it('incluye timestamp válido', async () => {
    const res = await request(app).get('/health');
    const ts = new Date(res.body.timestamp);
    expect(ts instanceof Date && !isNaN(ts)).toBe(true);
  });

  it('responde 404 para rutas inexistentes', async () => {
    const res = await request(app).get('/ruta-que-no-existe');
    expect(res.status).toBe(404);
  });
});
