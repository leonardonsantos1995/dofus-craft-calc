import { afterEach, describe, expect, it, vi } from 'vitest';
import { accentInsensitiveRegex } from '../src/lib/dofusdb';
import { buildFromEntries } from '../src/lib/setBuilder';
import { summarize } from '../src/lib/model';

describe('accentInsensitiveRegex', () => {
  it('ignora acentos', () => {
    const rx = new RegExp(accentInsensitiveRegex('chapeu do papamute'), 'i');
    expect(rx.test('Chapéu do Papamute Real')).toBe(true);
    expect(new RegExp(accentInsensitiveRegex('Âmbar (x)'), 'i').test('âmbar (x)')).toBe(true);
  });
});

describe('buildFromEntries', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('monta o set com receitas e nomes da DofusDB, multiplicando a quantidade', async () => {
    const names: Record<number, string> = { 8466: 'Anel Ancestral', 12738: 'Seixo rutilante', 16155: 'Teia de Arakne sombria' };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = new URL(url, 'http://x');
      if (u.pathname.endsWith('/recipes')) {
        return new Response(JSON.stringify({ data: [{ resultId: 8466, ingredientIds: [12738, 16155], quantities: [2, 4] }] }));
      }
      const ids = u.searchParams.getAll('id[$in][]').map(Number);
      return new Response(JSON.stringify({ data: ids.map((id) => ({ id, name: { pt: names[id] } })) }));
    }));
    const b = await buildFromEntries('Teste', [{ id: 8466, count: 2 }]);
    expect(b.setName).toBe('Teste');
    expect(b.equipments[0]).toMatchObject({ id: 8466, sourceName: 'Anel Ancestral', count: 2 });
    expect(b.equipments[0].resources).toEqual([
      { id: 12738, sourceName: 'Seixo rutilante', qty: 2 },
      { id: 16155, sourceName: 'Teia de Arakne sombria', qty: 4 },
    ]);
    const s = summarize(b, () => undefined, { resources: {}, equipments: {} });
    expect(s.resources.find((r) => r.key === 'id:16155')!.totalQty).toBe(8);
  });
});
