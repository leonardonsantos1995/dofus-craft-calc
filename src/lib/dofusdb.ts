import type { ItemInfo, ItemRef, Lang } from './types';
import { loadJSON, saveJSON } from './storage';

const API = import.meta.env.VITE_DOFUSDB_URL ?? '/dofusdb';
const NAME_CACHE_KEY = 'dcc.itemCache.v1';
const ID_CACHE_KEY = 'dcc.itemById.v1';

type NameCache = Record<string, ItemInfo | null>; // `${lang}:${nome em minúsculas}`
type IdCache = Record<string, ItemInfo | null>; // id oficial

let nameCache: NameCache = loadJSON<NameCache>(NAME_CACHE_KEY, {});
let idCache: IdCache = loadJSON<IdCache>(ID_CACHE_KEY, {});

interface ApiItem {
  id: number;
  name: Partial<Record<Lang, string>>;
  img?: string;
  iconId?: number;
  level?: number;
}

function toInfo(item: ApiItem): ItemInfo {
  const img = item.img && !item.img.includes('undefined') ? item.img : item.iconId ? `https://api.dofusdb.fr/img/items/${item.iconId}.png` : undefined;
  return {
    id: item.id,
    names: { en: item.name?.en, fr: item.name?.fr, es: item.name?.es, pt: item.name?.pt, de: item.name?.de },
    img,
    level: item.level,
  };
}

/** Resolve uma referência usando só o cache (síncrono, para a interface). */
export function getCachedItem(lang: Lang, ref: ItemRef): ItemInfo | null | undefined {
  if (ref.id !== undefined) {
    const byId = idCache[String(ref.id)];
    if (byId !== undefined) return byId;
  }
  return nameCache[`${lang}:${ref.sourceName.toLowerCase()}`];
}

// ---------- busca por ID (em lote) ----------

async function fetchByIds(ids: number[]): Promise<void> {
  const qs = ids.map((i) => `id[$in][]=${i}`).join('&');
  const res = await fetch(`${API}/items?${qs}&$limit=${ids.length}`);
  if (!res.ok) throw new Error(`DofusDB respondeu ${res.status}`);
  const json = (await res.json()) as { data: ApiItem[] };
  const found = new Set<number>();
  for (const item of json.data ?? []) {
    idCache[String(item.id)] = toInfo(item);
    found.add(item.id);
  }
  for (const id of ids) if (!found.has(id)) idCache[String(id)] = null;
}

/** Busca na DofusDB todos os IDs ainda não conhecidos, em lotes de 40. */
export async function lookupIds(ids: number[], onProgress?: (done: number, total: number) => void): Promise<{ errors: string[] }> {
  const missing = [...new Set(ids)].filter((id) => idCache[String(id)] === undefined);
  const errors: string[] = [];
  const BATCH = 40;
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH);
    try {
      await fetchByIds(chunk);
    } catch (e) {
      errors.push((e as Error).message);
    }
    onProgress?.(Math.min(i + BATCH, missing.length), missing.length);
  }
  saveJSON(ID_CACHE_KEY, idCache);
  return { errors };
}

// ---------- busca por nome (para o texto colado) ----------

async function queryOne(params: string): Promise<ApiItem | null> {
  const res = await fetch(`${API}/items?${params}&$limit=1`);
  if (!res.ok) throw new Error(`DofusDB respondeu ${res.status}`);
  const json = (await res.json()) as { data: ApiItem[] };
  return json.data?.[0] ?? null;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function lookupName(lang: Lang, name: string): Promise<void> {
  const key = `${lang}:${name.toLowerCase()}`;
  if (key in nameCache) return;
  const field = `name.${lang}`;
  let item = await queryOne(`${field}=${encodeURIComponent(name)}`);
  if (!item) {
    const rx = encodeURIComponent(`^${escapeRegex(name)}$`);
    item = await queryOne(`${field}[$regex]=${rx}&${field}[$options]=i`);
  }
  nameCache[key] = item ? toInfo(item) : null;
}

export async function lookupNames(lang: Lang, names: string[], onProgress?: (done: number, total: number) => void): Promise<{ errors: string[] }> {
  const unique = [...new Set(names)];
  const errors: string[] = [];
  let done = 0;
  let index = 0;
  const worker = async () => {
    while (index < unique.length) {
      const name = unique[index++];
      try {
        await lookupName(lang, name);
      } catch (e) {
        errors.push(`${name}: ${(e as Error).message}`);
      }
      onProgress?.(++done, unique.length);
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  saveJSON(NAME_CACHE_KEY, nameCache);
  return { errors };
}

/** Resolve todas as referências de um conjunto (IDs em lote, nomes um a um). */
export async function lookupRefs(lang: Lang, refs: ItemRef[], onProgress?: (done: number, total: number) => void) {
  const ids = refs.filter((r) => r.id !== undefined).map((r) => r.id!);
  const names = refs.filter((r) => r.id === undefined).map((r) => r.sourceName);
  const a = await lookupIds(ids, onProgress);
  const b = await lookupNames(lang, names, onProgress);
  return { errors: [...a.errors, ...b.errors] };
}

export function clearItemCache() {
  nameCache = {};
  idCache = {};
  saveJSON(NAME_CACHE_KEY, nameCache);
  saveJSON(ID_CACHE_KEY, idCache);
}

// ---------- busca de equipamentos e receitas (montador de set) ----------

export interface SearchResult extends ItemInfo {
  typeName?: string;
}

const ACCENTS: Record<string, string> = { a: '[aáàâãä]', e: '[eéèêë]', i: '[iíìîï]', o: '[oóòôõö]', u: '[uúùûü]', c: '[cç]' };

/** Regex que ignora maiúsculas e acentos ("chapeu" encontra "Chapéu"). */
export function accentInsensitiveRegex(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .split('')
    .map((ch) => ACCENTS[ch] ?? ch)
    .join('');
}

/** Busca itens craftáveis pelo nome em português. */
export async function searchCraftable(text: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const rx = encodeURIComponent(accentInsensitiveRegex(text));
  const res = await fetch(`${API}/items?name.pt[$regex]=${rx}&name.pt[$options]=i&hasRecipe=true&$limit=12&$sort[level]=-1`, { signal });
  if (!res.ok) throw new Error(`DofusDB respondeu ${res.status}`);
  const json = (await res.json()) as { data: (ApiItem & { type?: { name?: Partial<Record<Lang, string>> } })[] };
  return (json.data ?? []).map((item) => {
    const info = toInfo(item);
    idCache[String(item.id)] = info;
    return { ...info, typeName: item.type?.name?.pt };
  });
}

export interface Recipe {
  resultId: number;
  ingredients: { id: number; qty: number }[];
}

/** Receitas (ingredientes e quantidades) dos itens informados. */
const RECIPE_CACHE_KEY = 'dcc.recipes.v1';
const recipeCache: Record<string, Recipe> = loadJSON<Record<string, Recipe>>(RECIPE_CACHE_KEY, {});

export async function fetchRecipes(resultIds: number[]): Promise<Map<number, Recipe>> {
  const out = new Map<number, Recipe>();
  for (const id of resultIds) if (recipeCache[String(id)]) out.set(id, recipeCache[String(id)]);
  const ids = [...new Set(resultIds)].filter((id) => !out.has(id));
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const qs = chunk.map((id) => `resultId[$in][]=${id}`).join('&');
    const res = await fetch(`${API}/recipes?${qs}&$limit=${chunk.length}`);
    if (!res.ok) throw new Error(`DofusDB respondeu ${res.status}`);
    const json = (await res.json()) as { data: { resultId: number; ingredientIds: number[]; quantities: number[] }[] };
    for (const r of json.data ?? []) {
      const recipe = { resultId: r.resultId, ingredients: r.ingredientIds.map((id, k) => ({ id, qty: r.quantities[k] ?? 0 })) };
      out.set(r.resultId, recipe);
      recipeCache[String(r.resultId)] = recipe;
    }
  }
  if (ids.length) saveJSON(RECIPE_CACHE_KEY, recipeCache);
  return out;
}

export function getCachedById(id: number): ItemInfo | null | undefined {
  return idCache[String(id)];
}

/**
 * Procura um equipamento pelo nome exato, preferindo o item que tem receita
 * (há nomes repetidos, ex.: "Escudo de Mota" de verdade e a versão de aparência).
 */
export async function lookupCraftableByName(lang: Lang, name: string): Promise<ItemInfo | null> {
  const field = `name.${lang}`;
  const exact = `${field}=${encodeURIComponent(name)}`;
  const rx = `${field}[$regex]=${encodeURIComponent(`^${escapeRegex(name)}$`)}&${field}[$options]=i`;
  for (const params of [`${exact}&hasRecipe=true`, `${rx}&hasRecipe=true`, exact, rx]) {
    const item = await queryOne(params);
    if (item) {
      const info = toInfo(item);
      idCache[String(item.id)] = info;
      saveJSON(ID_CACHE_KEY, idCache);
      return info;
    }
  }
  return null;
}
