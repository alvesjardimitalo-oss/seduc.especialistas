// Leitura do PDF "Calendário Escolar" gerado pelo sistema escolar (TCPDF): cada dia é um
// quadrinho colorido e a legenda diz o significado de cada cor. Lemos a cor por baixo de cada
// número de dia e conferimos com o total de dias letivos de cada mês impresso no próprio PDF.
import { somarDias } from './dominio.js';

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const pad = n => String(n).padStart(2, '0');

/** Significado das cores conforme os textos da legenda. */
function categoriaDaLegenda(texto) {
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/sabado\s*\/\s*domingo/.test(t)) return 'fim_de_semana';
  if (/sabado letivo/.test(t)) return 'sabado_letivo';
  if (/dia letivo/.test(t)) return 'letivo';
  if (/inicio/.test(t)) return 'inicio_etapa';
  if (/final|fim/.test(t)) return 'fim_etapa';
  if (/feriado|recesso|ferias|nao letivo/.test(t)) return 'sem_aula';
  return null;
}
const PADRAO = { '#ffff00': 'fim_de_semana', '#ff0000': 'sem_aula', '#ffffff': 'letivo', '#008000': 'sabado_letivo', '#0000ff': 'inicio_etapa', '#00bfff': 'fim_etapa' };
export const LETIVOS = new Set(['letivo', 'sabado_letivo', 'inicio_etapa', 'fim_etapa']);

/**
 * Interpreta os textos e retângulos de uma página.
 * @param itens  [{str, x, y, w}] (coordenadas do PDF, y de baixo para cima)
 * @param rets   [{cor:'#rrggbb', x0, y0, x1, y1}] na ordem em que foram desenhados
 */
export function interpretarCalendario(itens, rets) {
  const anoTxt = itens.map(i => i.str).join(' ').match(/ANO\s+(20\d\d)/i);
  if (!anoTxt) throw Error('Não encontrei o ano no PDF. Use o "Calendário Escolar" emitido pelo sistema da escola.');
  const ano = Number(anoTxt[1]);
  // legenda: quadrinho colorido logo à esquerda de cada texto
  const cores = { ...PADRAO };
  for (const it of itens) {
    const cat = categoriaDaLegenda(it.str); if (!cat || it.str.length < 8) continue;
    const r = rets.filter(q => q.x1 <= it.x + 2 && q.x1 >= it.x - 25 && q.y0 - 3 <= it.y && it.y <= q.y1 + 3 && q.x1 - q.x0 < 25).pop();
    if (r) cores[r.cor] = cat;
  }
  // meses: cabeçalho "MÊS - DIAS: N" e a coluna começa no "D" logo abaixo
  const meses = [];
  for (const it of itens) {
    const m = it.str.toUpperCase().match(/^(JANEIRO|FEVEREIRO|MARÇO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\b(?:.*DIAS:\s*(\d+))?/);
    if (!m) continue;
    const ds = itens.filter(d => d.str.trim() === 'D' && d.y < it.y && it.y - d.y < 30);
    const d = ds.sort((a, b) => Math.abs(a.x - it.x) - Math.abs(b.x - it.x))[0];
    meses.push({ mes: MESES.indexOf(m[1]) + 1, y: it.y, x0: d ? d.x : it.x, letivosPdf: m[2] != null ? Number(m[2]) : null });
  }
  if (meses.length !== 12) throw Error('Encontrei ' + meses.length + ' meses no PDF; esperava 12. Confira se é o calendário anual da rede.');
  const dias = {};
  for (const it of itens) {
    if (!/^\d{2}$/.test(it.str.trim())) continue;
    const cands = meses.filter(m => m.y > it.y && m.y - it.y < 160 && m.x0 - 4 <= it.x);
    if (!cands.length) continue;
    const xmax = Math.max(...cands.map(m => m.x0));
    const m = cands.filter(c => c.x0 === xmax).sort((a, b) => (a.y - it.y) - (b.y - it.y))[0];
    const dia = Number(it.str), data = new Date(Date.UTC(ano, m.mes - 1, dia));
    if (data.getUTCMonth() !== m.mes - 1) continue;
    const cx = it.x + it.w / 2, cy = it.y + 3;
    const r = rets.filter(q => q.x0 - 1 <= cx && cx <= q.x1 + 1 && q.y0 - 1 <= cy && cy <= q.y1 + 1 && q.x1 - q.x0 < 25 && q.y1 - q.y0 < 25).pop();
    dias[ano + '-' + pad(m.mes) + '-' + pad(dia)] = r ? (cores[r.cor] || 'letivo') : 'letivo';
  }
  // conferência com o total de dias letivos impresso em cada mês
  const conferencia = meses.sort((a, b) => a.mes - b.mes).map(m => {
    const lidos = Object.entries(dias).filter(([d, c]) => Number(d.slice(5, 7)) === m.mes && LETIVOS.has(c)).length;
    return { mes: m.mes, pdf: m.letivosPdf, lidos, ok: m.letivosPdf == null || m.letivosPdf === lidos };
  });
  return { ano, dias, conferencia, periodos: periodosSemAula(dias, ano) };
}

// ---------- nomes dos períodos ----------
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return ano + '-' + pad(mes) + '-' + pad(dia);
}
export function feriados(ano) {
  const p = pascoa(ano), f = { [ano + '-01-01']: 'Confraternização Universal', [ano + '-04-21']: 'Tiradentes', [ano + '-05-01']: 'Dia do Trabalho', [ano + '-09-07']: 'Independência',
    [ano + '-10-12']: 'Nossa Senhora Aparecida', [ano + '-10-15']: 'Dia do Professor', [ano + '-11-02']: 'Finados', [ano + '-11-15']: 'Proclamação da República', [ano + '-11-20']: 'Consciência Negra', [ano + '-12-25']: 'Natal' };
  f[somarDias(p, -48)] = 'Carnaval'; f[somarDias(p, -47)] = 'Carnaval'; f[somarDias(p, -46)] = 'Quarta-feira de Cinzas';
  f[somarDias(p, -3)] = 'Quinta-feira Santa'; f[somarDias(p, -2)] = 'Sexta-feira Santa'; f[somarDias(p, 60)] = 'Corpus Christi';
  return f;
}
/** Agrupa os dias úteis sem aula em períodos (fins de semana no meio não quebram o período). */
export function periodosSemAula(dias, ano) {
  const fer = feriados(ano), lista = Object.keys(dias).sort(), periodos = [];
  for (const d of lista) {
    if (dias[d] !== 'sem_aula') continue;
    const ult = periodos[periodos.length - 1];
    if (ult) {
      let entre = somarDias(ult.ate, 1), continuo = true;
      while (entre < d) { if (LETIVOS.has(dias[entre])) { continuo = false; break; } entre = somarDias(entre, 1); }
      if (continuo) { ult.ate = d; ult.dias.push(d); continue; }
    }
    periodos.push({ de: d, ate: d, dias: [d] });
  }
  for (const p of periodos) {
    const nomes = [...new Set(p.dias.map(d => fer[d]).filter(Boolean))];
    const mes = Number(p.de.slice(5, 7));
    p.motivo = p.dias.length >= 8 ? (mes === 7 ? 'Recesso escolar de julho' : 'Férias escolares')
      : nomes.length ? nomes.join(' / ') + (p.dias.length > nomes.length ? ' (e emenda)' : '')
      : 'Dia sem aula (calendário escolar)';
  }
  return periodos;
}

/** Lê o arquivo PDF no navegador (pdf.js carregado sob demanda, hospedado no próprio site). */
export async function lerCalendarioPdf(arquivo) {
  const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()), verbosity: 0 }).promise;
  const pg = await doc.getPage(1);
  const tc = await pg.getTextContent();
  const itens = tc.items.filter(t => t.str && t.str.trim()).map(t => ({ str: t.str, x: t.transform[4], y: t.transform[5], w: t.width }));
  const ops = await pg.getOperatorList(), O = pdfjs.OPS;
  const pinta = new Set([O.fill, O.eoFill, O.fillStroke, O.eoFillStroke, O.closeFillStroke, O.closeEOFillStroke]);
  const rets = []; let cor = '#000000'; const pilha = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const f = ops.fnArray[i], a = ops.argsArray[i];
    if (f === O.save) pilha.push(cor);
    else if (f === O.restore) cor = pilha.pop() ?? cor;
    else if (f === O.setFillRGBColor) cor = typeof a[0] === 'string' ? a[0].toLowerCase() : '#' + a.slice(0, 3).map(v => pad(Math.round(v).toString(16))).join('');
    else if (f === O.constructPath && pinta.has(a[0]) && a[2]) rets.push({ cor, x0: a[2][0], y0: a[2][1], x1: a[2][2], y1: a[2][3] });
  }
  return interpretarCalendario(itens, rets);
}
