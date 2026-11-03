import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error arquivo JS da Pages Function
import { onRequestGet } from '../functions/dofusdb/[[path]].js';

describe('Pages Function /dofusdb', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('repassa /dofusdb/items com a query para a DofusDB', async () => {
    const fetchMock = vi.fn(async () => new Response('{"data":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const req = new Request('https://site.pages.dev/dofusdb/items?id[$in][]=11117&$limit=1');
    const res = await onRequestGet({ request: req, params: { path: ['items'] } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"data":[]}');
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.dofusdb.fr/items?id[$in][]=11117&$limit=1');
  });

  it('bloqueia outros caminhos', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await onRequestGet({ request: new Request('https://x/dofusdb/monsters'), params: { path: ['monsters'] } });
    expect(res.status).toBe(404);
    const res2 = await onRequestGet({ request: new Request('https://x/dofusdb/items/1'), params: { path: ['items', '1'] } });
    expect(res2.status).toBe(404);
  });
});
