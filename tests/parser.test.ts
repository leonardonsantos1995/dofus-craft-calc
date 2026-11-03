import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectCraftLang, parseCraftText } from '../src/lib/parser';
import { EXAMPLE_TEXT } from '../src/lib/example';

describe('parseCraftText', () => {
  it('lê o formato copiado do DofusBook', () => {
    const eqs = parseCraftText(EXAMPLE_TEXT);
    expect(eqs.map((e) => e.sourceName)).toEqual([
      'Ancestral Ring', 'Ancestral Torc', 'Zoth Warrior Axe', 'Royal Mastogob Boots',
      'Asse Shield', 'Ancestral Treecape', 'Royal Mastogob Belt', 'Royal Mastogob Hat',
    ]);
    expect(eqs[0].resources[0]).toEqual({ sourceName: 'Dark Treechnid Amber', qty: 5 });
    expect(eqs[0].resources[1]).toEqual({ sourceName: 'Dark Treechnee Web', qty: 4 });
    expect(eqs[4].resources[0]).toEqual({ sourceName: "Gobvious's Duster", qty: 18 });
    expect(eqs[1].resources[0]).toEqual({ sourceName: 'Venerable Treechnid Root', qty: 16 });
    const total = eqs.reduce((s, e) => s + e.resources.reduce((a, r) => a + r.qty, 0), 0);
    expect(total).toBe(18 + 31 + 23 + 50 + 44 + 36 + 61 + 66);
  });

  it('aceita "Nome x5" e "Nome 5"', () => {
    const eqs = parseCraftText('Item A\nRecurso Um x5\nRecurso Dois 3\n');
    expect(eqs[0].resources).toEqual([
      { sourceName: 'Recurso Um', qty: 5 },
      { sourceName: 'Recurso Dois', qty: 3 },
    ]);
  });
});

describe('modal de craft do DofusBook (Ctrl+A da página inteira)', () => {
  const text = readFileSync(new URL('./fixtures/dofusbook-craft-modal-en.txt', import.meta.url), 'utf8');

  it('lê os 12 equipamentos ignorando o resto da página', () => {
    const eqs = parseCraftText(text);
    expect(eqs.map((e) => e.sourceName)).toEqual([
      'Gelano', 'Ancestral Ring', 'Ancestral Torc', 'Zoth Warrior Axe', 'Royal Mastogob Boots', 'Asse Shield',
      'Ancestral Treecape', 'Royal Mastogob Belt', 'Royal Mastogob Hat', 'Player', 'Tease', 'Water Destroyer',
    ]);
    expect(eqs[1].resources).toEqual([
      { sourceName: 'Dark Treechnid Amber', qty: 5 },
      { sourceName: 'Dark Treechnee Web', qty: 4 },
      { sourceName: 'Ancestral Treechnid Root', qty: 3 },
      { sourceName: 'Gleaming Pebble', qty: 2 },
      { sourceName: 'Squashed Arachnee', qty: 2 },
      { sourceName: 'Scrawny Bwak', qty: 1 },
      { sourceName: 'Moowolf Magic Testicles', qty: 1 },
    ]);
    // Escudo sem linha de conjunto
    expect(eqs[5].resources[0]).toEqual({ sourceName: "Gobvious's Duster", qty: 18 });
    expect(eqs[11].resources).toHaveLength(7);
  });

  it('detecta o idioma', () => {
    expect(detectCraftLang(text)).toBe('en');
    expect(detectCraftLang('Gelano\nAnneau - Niveau 60\n50 Gelée')).toBe('fr');
    expect(detectCraftLang('Gelanel\nAnel - Nível 60\n50 Gelatina')).toBe('pt');
  });

  it('aceita o texto alternativo das imagens colado junto', () => {
    const eqs = parseCraftText('Ancestral Ring\nRing - Level 113\nAncestral Set\n\nDark Treechnid Amber5 Dark Treechnid Amber\n');
    expect(eqs[0].resources).toEqual([{ sourceName: 'Dark Treechnid Amber', qty: 5 }]);
  });
});
