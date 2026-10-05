import http from 'node:http';
import { StorageClient, StorageUnknownError, StorageApiError } from '@supabase/storage-js';
import {
  isValidShareId, storageErrorInfo, classifyStorageError,
  isRowExpired, decideAppReport, decideCompetitorReport,
} from '../utils/reportLookup.js';

const HOUR = 3600 * 1000;
const now = Date.parse('2026-10-05T00:00:00Z');
const expirationMs = 24 * 365 * HOUR;
const jsonRes = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
// What storage-js 2.x download() hands back for an HTTP error (noResolveJson).
const downloadError = (res) => new StorageUnknownError('{}', res);

describe('reportLookup', () => {
  it('validates md5 share ids', () => {
    expect(isValidShareId('a76a6ea3f499160cdfe174330a02969d')).to.equal(true);
    expect(isValidShareId('doesnotexist123')).to.equal(false);
    expect(isValidShareId('../etc/passwd')).to.equal(false);
    expect(isValidShareId(undefined)).to.equal(false);
  });

  describe('storage errors', () => {
    it('missing object (HTTP 400, legacy storage-api) is not_found', async () => {
      const e = downloadError(jsonRes(400, { statusCode: '404', error: 'not_found', message: 'Object not found' }));
      expect(classifyStorageError(await storageErrorInfo(e))).to.equal('not_found');
    });
    it('missing object (HTTP 404) is not_found', async () => {
      const e = downloadError(jsonRes(404, { statusCode: '404', error: 'not_found', message: 'Object not found' }));
      expect(classifyStorageError(await storageErrorInfo(e))).to.equal('not_found');
    });
    it('StorageApiError with status works too', async () => {
      expect(classifyStorageError(await storageErrorInfo(new StorageApiError('Object not found', 400)))).to.equal('not_found');
    });
    it('5xx / 429 / bare 400 / bucket missing / network are transient', async () => {
      const cases = [
        downloadError(jsonRes(500, { statusCode: '500', error: 'internal', message: 'Internal Server Error' })),
        downloadError(jsonRes(503, { message: 'Service Unavailable' })),
        downloadError(jsonRes(429, { message: 'Too many requests' })),
        downloadError(new Response('<html>bad gateway</html>', { status: 400 })),
        downloadError(jsonRes(400, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' })),
        downloadError(new TypeError('fetch failed')),
      ];
      for (const e of cases) expect(classifyStorageError(await storageErrorInfo(e))).to.equal('error');
    });
  });

  it('row expiry ignores NULL/invalid timestamps (legacy rows)', () => {
    expect(isRowExpired(null, now, expirationMs)).to.equal(false);
    expect(isRowExpired('garbage', now, expirationMs)).to.equal(false);
    expect(isRowExpired(now - 2 * expirationMs, now, expirationMs)).to.equal(true);
    expect(isRowExpired(new Date(now - HOUR).toISOString(), now, expirationMs)).to.equal(false);
  });

  describe('decideAppReport', () => {
    const d = (o) => decideAppReport({ now, expirationMs, ...o });
    const old = now - 2 * expirationMs;
    it('serves when storage has it', () => {
      expect(d({ storage: 'ok', row: 'present', timestamp: now - HOUR }).serve).to.equal(true);
      expect(d({ storage: 'ok', row: 'absent' }).serve).to.equal(true);
      expect(d({ storage: 'ok', row: 'error' }).serve).to.equal(true);
      expect(d({ storage: 'ok', row: 'present', timestamp: null }).serve).to.equal(true);
    });
    it('410 expired only for a real old timestamp', () => {
      const r = d({ storage: 'ok', row: 'present', timestamp: old });
      expect(r.status).to.equal(410); expect(r.body.code).to.equal('expired');
      expect(d({ storage: 'not_found', row: 'present', timestamp: old }).body.code).to.equal('expired');
    });
    it('404 not_found only when storage AND db agree it is gone', () => {
      const r = d({ storage: 'not_found', row: 'absent' });
      expect(r.status).to.equal(404); expect(r.body.code).to.equal('not_found');
      expect(d({ storage: 'not_found', row: 'present', timestamp: now }).body.code).to.equal('not_found');
    });
    it('503 unavailable when anything is uncertain', () => {
      for (const o of [{ storage: 'error', row: 'absent' }, { storage: 'error', row: 'present', timestamp: old }, { storage: 'not_found', row: 'error' }]) {
        const r = d(o); expect(r.status).to.equal(503); expect(r.body.code).to.equal('unavailable');
      }
    });
  });

  describe('decideCompetitorReport', () => {
    const d = (o) => decideCompetitorReport({ now, expirationMs, ...o });
    it('maps db outcomes', () => {
      expect(d({ row: 'present', timestamp: now }).serve).to.equal(true);
      expect(d({ row: 'present', timestamp: null }).serve).to.equal(true);
      expect(d({ row: 'present', timestamp: now - 2 * expirationMs }).body.code).to.equal('expired');
      expect(d({ row: 'absent' }).status).to.equal(404);
      expect(d({ row: 'absent' }).body.code).to.equal('not_found');
      expect(d({ row: 'error' }).status).to.equal(503);
    });
  });

  it('real storage-js download() errors classify correctly (mock storage server)', async () => {
    const replies = {
      '/object/reports/missing.zip': [400, { statusCode: '404', error: 'not_found', message: 'Object not found' }],
      '/object/reports/boom.zip': [502, { message: 'Bad gateway' }],
    };
    const server = http.createServer((req, res) => {
      const [status, body] = replies[req.url] || [500, {}];
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    try {
      const client = new StorageClient(`http://127.0.0.1:${server.address().port}`, {});
      const missing = await client.from('reports').download('missing.zip');
      expect(classifyStorageError(await storageErrorInfo(missing.error))).to.equal('not_found');
      const boom = await client.from('reports').download('boom.zip');
      expect(classifyStorageError(await storageErrorInfo(boom.error))).to.equal('error');
    } finally {
      server.close();
    }
  });
});
