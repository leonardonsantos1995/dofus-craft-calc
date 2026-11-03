import type { Lang, ParsedEquipment } from './types';

/** Linha "Tipo - Level N" que vem logo abaixo do nome do equipamento no modal de craft do DofusBook. */
const LEVEL_RE = /^.+?\s+-\s+(Level|Niveau|Nível|Nivel|Stufe|Livello)\s*\.?\s*\d+\s*$/i;
const LEVEL_LANG: Record<string, Lang> = { level: 'en', niveau: 'fr', 'nível': 'pt', nivel: 'es', stufe: 'de' };

/** Detecta o idioma do texto do DofusBook pela palavra usada para "nível". */
export function detectCraftLang(text: string): Lang | undefined {
  for (const raw of text.split(/\r?\n/)) {
    const m = clean(raw).match(LEVEL_RE);
    if (m) return LEVEL_LANG[m[1].toLowerCase()];
  }
  return undefined;
}

/**
 * Converte o texto copiado do DofusBook (Ctrl+A / Ctrl+C com o modal
 * "Craft Details for This build" aberto) numa lista de equipamentos com recursos.
 *
 * Também aceita o formato simples: nome do equipamento numa linha e recursos
 * nas linhas seguintes ("5 Recurso", "Recurso x5", "Recurso5 Recurso").
 */
export function parseCraftText(text: string): ParsedEquipment[] {
  const lines = text.split(/\r?\n/).map(clean);
  return lines.some((l) => LEVEL_RE.test(l)) ? parseModal(lines) : parseSimple(lines);
}

/** Formato do modal: nome / "Tipo - Level N" / [conjunto] / recursos… */
function parseModal(lines: string[]): ParsedEquipment[] {
  // Ignora tudo antes do título do modal ("CRAFT : nome do set"), se existir
  const start = Math.max(0, lines.findIndex((l) => /^CRAFT\s*:/i.test(l)));
  const equipments: ParsedEquipment[] = [];
  let current: ParsedEquipment | null = null;

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (i + 1 < lines.length && LEVEL_RE.test(lines[i + 1]) && !LEVEL_RE.test(line)) {
      current = { sourceName: stripDuplicateAlt(line), resources: [] };
      equipments.push(current);
      i++; // pula a linha "Tipo - Level N"
      continue;
    }
    if (!current) continue; // cabeçalho do modal ("12 selected items" etc.)
    const res = parseResourceLine(line, true);
    if (res) addResource(current, res);
    // demais linhas (nome do conjunto, botões, rodapé) são ignoradas
  }
  return equipments.filter((e) => e.resources.length > 0);
}

/** Formato simples: qualquer linha que não é recurso começa um equipamento. */
function parseSimple(lines: string[]): ParsedEquipment[] {
  const equipments: ParsedEquipment[] = [];
  let current: ParsedEquipment | null = null;
  for (const line of lines) {
    if (!line) continue;
    const res = parseResourceLine(line);
    if (res) {
      if (!current) {
        current = { sourceName: 'Sem equipamento', resources: [] };
        equipments.push(current);
      }
      addResource(current, res);
    } else {
      current = { sourceName: line, resources: [] };
      equipments.push(current);
    }
  }
  return equipments.filter((e) => e.resources.length > 0);
}

function addResource(eq: ParsedEquipment, res: { sourceName: string; qty: number }) {
  const existing = eq.resources.find((r) => r.sourceName === res.sourceName);
  if (existing) existing.qty += res.qty;
  else eq.resources.push(res);
}

/** `quantityFirst`: no modal os recursos sempre começam pela quantidade ("5 Recurso"). */
function parseResourceLine(line: string, quantityFirst = false): { sourceName: string; qty: number } | null {
  // "Nome<qtd> Nome" (texto alternativo da imagem + quantidade + nome) ou "<qtd> Nome"
  let m = line.match(/^(.*?)(\d+)\s*[x×]?\s+(.+)$/);
  if (m) {
    const prefix = m[1].trim();
    const name = m[3].trim();
    if (!prefix || normalize(prefix) === normalize(name)) {
      return { sourceName: name, qty: parseInt(m[2], 10) };
    }
  }
  if (quantityFirst) return null;
  // "Nome x5" ou "Nome 5"
  m = line.match(/^(.+?)\s+[x×]?(\d+)$/);
  if (m) return { sourceName: m[1].trim(), qty: parseInt(m[2], 10) };
  return null;
}

/** "GelanoGelano" (texto alternativo da imagem colado ao nome) → "Gelano". */
function stripDuplicateAlt(s: string): string {
  const half = s.length / 2;
  if (Number.isInteger(half) && s.slice(0, half) === s.slice(half)) return s.slice(0, half);
  return s;
}

function clean(s: string) {
  return s.replace(/ /g, ' ').trim();
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}
