export type Lang = 'en' | 'fr' | 'es' | 'pt' | 'de';

/** Referência a um item: pelo ID oficial da Ankama (preferível) ou pelo nome no idioma de origem. */
export interface ItemRef {
  id?: number;
  sourceName: string;
}

export interface ParsedResource extends ItemRef {
  qty: number;
}

export interface ParsedEquipment extends ItemRef {
  resources: ParsedResource[];
  /** Quantas vezes o item aparece no set (ex.: dois anéis iguais). Padrão 1. */
  count?: number;
  /** Se entra no cálculo. Padrão true. */
  include?: boolean;
  /** Itens sem receita (Dofus, montaria…) não podem ser craftados. */
  craftable?: boolean;
  slot?: string;
}

/** Dados de um item resolvido na DofusDB. */
export interface ItemInfo {
  id: number;
  names: Partial<Record<Lang, string>>;
  img?: string;
  level?: number;
}

export interface BuildSource {
  url: string;
  stuffId: number;
  name: string;
  level?: number;
}

export interface Build {
  sourceLang: Lang;
  equipments: ParsedEquipment[];
  importedAt: string;
  /** Nome do set (montador). */
  setName?: string;
  /** Itens escolhidos no montador (id + quantidade), para reabrir/editar. */
  entries?: { id: number; count: number }[];
  source?: BuildSource;
}

export interface LotPrices {
  p1?: number;
  p10?: number;
  p100?: number;
  updatedAt?: string;
}

export interface MarketPrice {
  price?: number;
  updatedAt?: string;
}

/** Preços salvos por servidor. A chave do item é `id:<id oficial>` ou `name:<nome original>`. */
export interface ServerPrices {
  resources: Record<string, LotPrices>;
  equipments: Record<string, MarketPrice>;
}
