import ExcelJS from 'exceljs';
import type { BuildSummary } from './model';

/**
 * Gera a planilha com as abas Resumo, Preços e Crafts, com fórmulas vivas
 * (mesma lógica do site: melhor combinação de lotes de 1/10/100).
 */

const BIG = '1E+12';
const NUM = '#,##0;-#,##0;"-"';
const FONT = 'Arial';
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const HDR = fill('FF1F3864');
const EQ = fill('FFD9E1F2');
const INP = fill('FFFFF2CC');
const TOT = fill('FFE2EFDA');
const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const BOX: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

function col(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function setF(ws: ExcelJS.Worksheet, ref: string, formula: string) {
  ws.getCell(ref).value = { formula: formula.replace(/^=/, '') } as ExcelJS.CellFormulaValue;
}

function header(ws: ExcelJS.Worksheet, row: number, heads: string[]) {
  heads.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = h;
    c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = HDR;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = BOX;
  });
}

const CALC_NAMES = ['m10', 'g10', 'u10', 'm100', 'g100r', 'u100', 'total', 'c100', 'c10', 'c1', 'n100', 'k10', 'n10', 'n1', 'units', 'text'] as const;
type CalcRefs = Record<(typeof CALC_NAMES)[number], string>;

/** Escreve as colunas auxiliares do cálculo de lotes a partir de `startCol`. */
function calcBlock(ws: ExcelJS.Worksheet, row: number, startCol: number, N: string, e: [string, string, string], r: [string, string]): CalcRefs {
  const R = Object.fromEntries(CALC_NAMES.map((n, i) => [n, `${col(startCol + i)}${row}`])) as CalcRefs;
  const [e1, e10, e100] = e;
  const [r10, r100] = r;
  const f: CalcRefs = {
    m10: `MOD(${N},10)`,
    g10: `MIN(${e10},${R.m10}*${e1})`,
    u10: `IF(AND(${R.m10}>0,${e10}<${R.m10}*${e1}),1,0)`,
    m100: `MOD(${N},100)`,
    g100r: `INT(${R.m100}/10)*${e10}+${R.g10}`,
    u100: `IF(${e100}<${R.g100r},1,0)`,
    total: `INT(${N}/100)*${e100}+MIN(${e100},${R.g100r})`,
    c100: `INT(${N}/100)+${R.u100}`,
    c10: `IF(${R.u100}=1,0,INT(${R.m100}/10)+${R.u10})`,
    c1: `IF(${R.u100}+${R.u10}>0,0,${R.m10})`,
    n100: `IF(${r100},${R.c100},0)`,
    k10: `${R.c10}+IF(${r100},0,10*${R.c100})`,
    n10: `IF(${r10},${R.k10},0)`,
    n1: `${R.c1}+IF(${r10},0,10*${R.k10})`,
    units: `${R.n100}*100+${R.n10}*10+${R.n1}`,
    text:
      `IF(${N}=0,"",IF(${R.total}>=${BIG},"Sem preço informado",MID(` +
      `IF(${R.n100}>0," + "&${R.n100}&"× lote 100","")&` +
      `IF(${R.n10}>0," + "&${R.n10}&"× lote 10","")&IF(${R.n1}>0," + "&${R.n1}&"× unidade",""),4,200)))`,
  };
  CALC_NAMES.forEach((n, i) => {
    const c = ws.getCell(row, startCol + i);
    c.value = { formula: f[n] } as ExcelJS.CellFormulaValue;
    c.font = { name: FONT, size: 8, color: { argb: 'FF808080' } };
  });
  return R;
}

function hideCols(ws: ExcelJS.Worksheet, from: number, count: number) {
  for (let i = from; i < from + count; i++) ws.getColumn(i).hidden = true;
}

export function buildWorkbook(s: BuildSummary, server: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dofus Craft Calc';
  const rs = wb.addWorksheet('Resumo');
  const pr = wb.addWorksheet('Preços');
  const cs = wb.addWorksheet('Crafts');

  // ---------------- Preços ----------------
  pr.getCell('A1').value = `Preços dos recursos no market — servidor ${server} (kamas)`;
  pr.getCell('A1').font = { name: FONT, bold: true, size: 14 };
  pr.getCell('A2').value = 'Preencha as células amarelas com o preço TOTAL do lote como aparece no market. Deixe em branco o lote que não estiver à venda.';
  pr.getCell('A3').value = 'A planilha escolhe a combinação de lotes mais barata (pode sobrar recurso quando arredondar para cima compensar).';
  ['A2', 'A3'].forEach((r) => (pr.getCell(r).font = { name: FONT, italic: true, color: { argb: 'FF595959' } }));
  header(pr, 5, ['Recurso', 'Preço x1', 'Preço lote 10', 'Preço lote 100', 'Qtd total p/ todos os crafts', 'Como comprar (todos os crafts)', 'Custo total (melhor compra)', 'Sobra']);
  pr.getRow(5).height = 32;

  const first = 6;
  const H = 10; // colunas auxiliares a partir de J
  s.resources.forEach((r, i) => {
    const row = first + i;
    pr.getCell(row, 1).value = r.name;
    const vals = [r.prices.p1, r.prices.p10, r.prices.p100];
    vals.forEach((v, k) => {
      const c = pr.getCell(row, 2 + k);
      if (v !== undefined) c.value = v;
      c.fill = INP;
      c.font = { name: FONT, color: { argb: 'FF0000FF' } };
      c.numFmt = NUM;
    });
    setF(pr, `E${row}`, `SUMIF(Crafts!$A$1:$A$2000,A${row},Crafts!$B$1:$B$2000)`);
    const e1 = `${col(H)}${row}`, e10 = `${col(H + 1)}${row}`, e100 = `${col(H + 2)}${row}`;
    const r10 = `${col(H + 3)}${row}`, r100 = `${col(H + 4)}${row}`;
    const helpers = [
      `IF(B${row}="",${BIG},B${row})`,
      `MIN(IF(C${row}="",${BIG},C${row}),10*${e1})`,
      `MIN(IF(D${row}="",${BIG},D${row}),10*${e10})`,
      `AND(C${row}<>"",C${row}<=10*${e1})`,
      `AND(D${row}<>"",D${row}<=10*${e10})`,
    ];
    helpers.forEach((hf, k) => {
      const c = pr.getCell(row, H + k);
      c.value = { formula: hf } as ExcelJS.CellFormulaValue;
      c.font = { name: FONT, size: 8, color: { argb: 'FF808080' } };
    });
    const R = calcBlock(pr, row, H + 5, `E${row}`, [e1, e10, e100], [r10, r100]);
    setF(pr, `F${row}`, R.text);
    setF(pr, `G${row}`, `IF(${R.total}>=${BIG},0,${R.total})`);
    setF(pr, `H${row}`, `IF(${R.total}>=${BIG},0,${R.units}-E${row})`);
    pr.getCell(`G${row}`).font = { name: FONT, bold: true };
    ['E', 'G', 'H'].forEach((c) => (pr.getCell(`${c}${row}`).numFmt = NUM));
    for (let c = 1; c <= 8; c++) pr.getCell(row, c).border = BOX;
  });
  const last = first + s.resources.length - 1;
  const tr = last + 1;
  pr.getCell(`A${tr}`).value = 'TOTAL (comprando tudo de uma vez)';
  setF(pr, `G${tr}`, `SUM(G${first}:G${last})`);
  pr.getCell(`G${tr}`).numFmt = NUM;
  for (let c = 1; c <= 8; c++) {
    const x = pr.getCell(tr, c);
    x.fill = TOT;
    x.font = { name: FONT, bold: true };
    x.border = BOX;
  }
  hideCols(pr, H, 5 + CALC_NAMES.length);
  [34, 12, 13, 14, 15, 38, 17, 9].forEach((w, i) => (pr.getColumn(i + 1).width = w));
  pr.views = [{ state: 'frozen', xSplit: 1, ySplit: 5 }];

  const PN = `Preços!$A$${first}:$A$${last}`;
  const PCOL = (c: string) => `Preços!$${c}$${first}:$${c}$${last}`;
  const effCols = [0, 1, 2, 3, 4].map((k) => col(H + k));

  // ---------------- Crafts ----------------
  cs.getCell('A1').value = `Custo de craft por equipamento — servidor ${server}`;
  cs.getCell('A1').font = { name: FONT, bold: true, size: 14 };
  cs.getCell('A2').value = 'Os preços vêm da aba Preços, com a melhor combinação de lotes para a quantidade de cada equipamento. Amarelo = você preenche (preço do equipamento pronto no market).';
  cs.getCell('A2').font = { name: FONT, italic: true, color: { argb: 'FF595959' } };
  const CH = 12; // auxiliares a partir de L
  let row = 4;
  const summaryRefs: { name: string; total: string; market: string; missing: string }[] = [];
  for (const eq of s.equipments) {
    cs.getCell(row, 1).value = eq.name;
    for (const c of [1, 2, 3, 4, 5, 7, 8]) {
      const x = cs.getCell(row, c);
      x.fill = EQ;
      x.font = { name: FONT, bold: true, size: 12 };
      x.border = BOX;
    }
    cs.getCell(row, 7).value = 'Comparativo';
    row++;
    header(cs, row, ['Recurso', 'Quantidade', 'Como comprar', 'Sobra', 'Valor (melhor compra)']);
    const headRow = row;
    row++;
    const start = row;
    for (const l of eq.lines) {
      cs.getCell(row, 1).value = l.name;
      cs.getCell(row, 2).value = l.qty;
      cs.getCell(row, 2).font = { name: FONT, color: { argb: 'FF0000FF' } };
      cs.getCell(row, 2).alignment = { horizontal: 'center' };
      const look = [0, 1, 2, 3, 4].map((k) => `${col(CH + k)}${row}`);
      effCols.forEach((ec, k) => {
        const c = cs.getCell(row, CH + k);
        c.value = { formula: `IFERROR(INDEX(${PCOL(ec)},MATCH($A${row},${PN},0)),${k < 3 ? BIG : 'FALSE'})` } as ExcelJS.CellFormulaValue;
        c.font = { name: FONT, size: 8, color: { argb: 'FF808080' } };
      });
      const R = calcBlock(cs, row, CH + 5, `B${row}`, [look[0], look[1], look[2]], [look[3], look[4]]);
      setF(cs, `C${row}`, R.text);
      cs.getCell(`C${row}`).font = { name: FONT, color: { argb: 'FF008000' } };
      setF(cs, `D${row}`, `IF(${R.total}>=${BIG},0,${R.units}-B${row})`);
      setF(cs, `E${row}`, `IF(${R.total}>=${BIG},0,${R.total})`);
      ['D', 'E'].forEach((c) => (cs.getCell(`${c}${row}`).numFmt = NUM));
      for (let c = 1; c <= 5; c++) cs.getCell(row, c).border = BOX;
      row++;
    }
    const end = row - 1;
    cs.getCell(row, 1).value = 'TOTAL DO CRAFT';
    setF(cs, `E${row}`, `SUM(E${start}:E${end})`);
    cs.getCell(`E${row}`).numFmt = NUM;
    for (let c = 1; c <= 5; c++) {
      const x = cs.getCell(row, c);
      x.fill = TOT;
      x.font = { name: FONT, bold: true };
      x.border = BOX;
    }
    const total = `E${row}`;
    const r0 = headRow;
    const mk = `H${r0}`;
    const labels = ['Preço no market', 'Custo do craft', 'Diferença (market − craft)', 'Recursos sem preço', 'Melhor opção'];
    const formulas = [
      null,
      `${total}`,
      `IF(${mk}="","",${mk}-H${r0 + 1})`,
      `COUNTIF(C${start}:C${end},"Sem preço informado")`,
      `IF(${mk}="","Informe o preço",IF(H${r0 + 3}>0,"Faltam preços",IF(${mk}<H${r0 + 1},"Comprar no market","Craftar")))`,
    ];
    labels.forEach((lab, i) => {
      const rr = r0 + i;
      cs.getCell(rr, 7).value = lab;
      cs.getCell(rr, 7).font = { name: FONT, bold: true };
      const g = cs.getCell(rr, 8);
      if (i === 0) {
        if (eq.market !== undefined) g.value = eq.market;
        g.fill = INP;
        g.font = { name: FONT, color: { argb: 'FF0000FF' } };
      } else {
        g.value = { formula: formulas[i]! } as ExcelJS.CellFormulaValue;
        g.font = { name: FONT, bold: i === 4 };
      }
      if (i < 4) g.numFmt = NUM;
      cs.getCell(rr, 7).border = BOX;
      g.border = BOX;
    });
    summaryRefs.push({ name: eq.name, total, market: mk, missing: `H${r0 + 3}` });
    row += 2;
  }
  cs.getCell(row, 1).value = 'TOTAL GERAL (cada equipamento comprado separado)';
  setF(cs, `E${row}`, summaryRefs.length ? summaryRefs.map((r) => r.total).join('+') : '0');
  cs.getCell(`E${row}`).numFmt = NUM;
  for (let c = 1; c <= 5; c++) {
    const x = cs.getCell(row, c);
    x.fill = HDR;
    x.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } };
    x.border = BOX;
  }
  hideCols(cs, CH, 5 + CALC_NAMES.length);
  [34, 12, 34, 8, 20, 3, 28, 20].forEach((w, i) => (cs.getColumn(i + 1).width = w));

  // ---------------- Resumo ----------------
  rs.getCell('A1').value = `Resumo: craftar ou comprar? — servidor ${server}`;
  rs.getCell('A1').font = { name: FONT, bold: true, size: 14 };
  header(rs, 3, ['Equipamento', 'Custo do craft', 'Preço no market', 'Economia craftando', 'Melhor opção']);
  let r = 4;
  for (const ref of summaryRefs) {
    rs.getCell(r, 1).value = ref.name;
    rs.getCell(r, 1).font = { name: FONT, bold: true };
    setF(rs, `B${r}`, `Crafts!${ref.total}`);
    setF(rs, `C${r}`, `IF(Crafts!${ref.market}="","",Crafts!${ref.market})`);
    setF(rs, `D${r}`, `IF(C${r}="","",C${r}-B${r})`);
    setF(rs, `E${r}`, `IF(C${r}="","Informe o preço",IF(Crafts!${ref.missing}>0,"Faltam preços",IF(C${r}<B${r},"Comprar no market","Craftar")))`);
    for (let c = 1; c <= 5; c++) {
      rs.getCell(r, c).border = BOX;
      if (c >= 2 && c <= 4) rs.getCell(r, c).numFmt = NUM;
    }
    r++;
  }
  rs.getCell(r, 1).value = 'TOTAL';
  (['B', 'C', 'D'] as const).forEach((c) => {
    setF(rs, `${c}${r}`, r > 4 ? `SUM(${c}4:${c}${r - 1})` : '0');
    rs.getCell(`${c}${r}`).numFmt = NUM;
  });
  for (let c = 1; c <= 5; c++) {
    const x = rs.getCell(r, c);
    x.fill = TOT;
    x.font = { name: FONT, bold: true };
    x.border = BOX;
  }
  rs.getCell(r + 2, 1).value = 'Comprando os recursos de todos os equipamentos de uma vez';
  setF(rs, `B${r + 2}`, `Preços!G${tr}`);
  rs.getCell(r + 3, 1).value = 'Economia por comprar tudo junto (lotes maiores)';
  setF(rs, `B${r + 3}`, `B${r}-B${r + 2}`);
  for (const rr of [r + 2, r + 3]) {
    rs.getCell(rr, 1).font = { name: FONT, bold: true };
    rs.getCell(rr, 2).font = { name: FONT, bold: true };
    rs.getCell(rr, 2).numFmt = NUM;
  }
  if (r > 4) {
    rs.addConditionalFormatting({
      ref: `E4:E${r - 1}`,
      rules: [
        { type: 'expression', priority: 1, formulae: ['E4="Craftar"'], style: { font: { bold: true, color: { argb: 'FF00703C' } } } },
        { type: 'expression', priority: 2, formulae: ['E4="Comprar no market"'], style: { font: { bold: true, color: { argb: 'FFC00000' } } } },
      ],
    });
  }
  [52, 16, 16, 20, 22].forEach((w, i) => (rs.getColumn(i + 1).width = w));

  // Fonte padrão nas células sem estilo próprio
  for (const ws of [rs, pr, cs]) {
    ws.eachRow((rw) =>
      rw.eachCell((c) => {
        if (!c.font || !c.font.name) c.font = { ...(c.font ?? {}), name: FONT };
      }),
    );
  }
  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
  return wb;
}

export async function downloadXlsx(s: BuildSummary, server: string) {
  const wb = buildWorkbook(s, server);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crafts_${server.toLowerCase().replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
