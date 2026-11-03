import { fetchRecipes, getCachedById, lookupIds } from './dofusdb';
import { loadJSON, saveJSON } from './storage';
import type { Build } from './types';

/** Um item escolhido no montador de set. */
export interface SetEntry {
  id: number;
  count: number;
}

export interface SavedSet {
  name: string;
  entries: SetEntry[];
  savedAt: string;
}

const SETS_KEY = 'dcc.sets.v1';

export function listSavedSets(): SavedSet[] {
  return loadJSON<SavedSet[]>(SETS_KEY, []).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function saveSet(name: string, entries: SetEntry[]) {
  const sets = loadJSON<SavedSet[]>(SETS_KEY, []).filter((s) => s.name !== name);
  sets.push({ name, entries, savedAt: new Date().toISOString() });
  saveJSON(SETS_KEY, sets);
}

export function deleteSet(name: string) {
  saveJSON(SETS_KEY, loadJSON<SavedSet[]>(SETS_KEY, []).filter((s) => s.name !== name));
}

/** Busca receitas e nomes na DofusDB e monta o Build com os itens escolhidos. */
export async function buildFromEntries(name: string, entries: SetEntry[], onProgress?: (msg: string) => void): Promise<Build> {
  onProgress?.('Buscando receitas na DofusDB…');
  const recipes = await fetchRecipes(entries.map((e) => e.id));
  const allIds = [...entries.map((e) => e.id), ...[...recipes.values()].flatMap((r) => r.ingredients.map((g) => g.id))];
  onProgress?.('Buscando nomes em português…');
  await lookupIds(allIds);
  const nameOf = (id: number) => getCachedById(id)?.names.pt ?? `Item ${id}`;
  return {
    sourceLang: 'pt',
    importedAt: new Date().toISOString(),
    setName: name || undefined,
    entries,
    equipments: entries.map((e) => {
      const recipe = recipes.get(e.id);
      const resources = (recipe?.ingredients ?? []).map((g) => ({ id: g.id, sourceName: nameOf(g.id), qty: g.qty }));
      return { id: e.id, sourceName: nameOf(e.id), resources, count: e.count, craftable: resources.length > 0, include: true };
    }),
  };
}
