// Gráfico de colunas empilhadas em SVG (sem bibliotecas), com legenda, rótulo do total,
// dica ao passar o mouse/tocar e tabela equivalente para leitura acessível.
import { esc } from './ui.js';

/**
 * @param {Array<{rotulo:string, valores:Object<string,number>}>} colunas
 * @param {Array<[string,string]>} categorias  [chave, nome] na ordem fixa de empilhamento
 */
export function colunasEmpilhadas({ colunas, categorias, titulo, unidade = 'atendimento(s)' }) {
  const L = 760, A = 240, esq = 36, dir = 8, topo = 18, base = 26;
  const totais = colunas.map(c => categorias.reduce((s, [k]) => s + (c.valores[k] || 0), 0));
  const max = Math.max(1, ...totais), passo = escala(max);
  const topoEixo = Math.ceil(max / passo) * passo;
  const larg = (L - esq - dir) / colunas.length, barra = Math.min(38, larg * 0.62);
  const y = v => topo + (A - topo - base) * (1 - v / topoEixo);
  let svg = '<svg class="grafico-colunas" viewBox="0 0 ' + L + ' ' + A + '" role="img" aria-label="' + esc(titulo) + '">';
  for (let v = 0; v <= topoEixo; v += passo) svg += '<line class="grade-linha" x1="' + esq + '" x2="' + (L - dir) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="eixo" x="' + (esq - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>';
  colunas.forEach((c, i) => {
    const x = esq + i * larg + (larg - barra) / 2;
    let acum = 0;
    svg += '<g class="coluna" tabindex="0" data-i="' + i + '">';
    svg += '<rect class="alvo" x="' + (esq + i * larg) + '" y="' + topo + '" width="' + larg + '" height="' + (A - topo - base) + '"/>';
    for (const [k] of categorias) {
      const v = c.valores[k] || 0; if (!v) continue;
      const y1 = y(acum + v), y0 = y(acum), alt = Math.max(1, y0 - y1 - 2); // 2px de respiro entre segmentos
      svg += '<rect class="seg cat-' + esc(k) + '" x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + barra.toFixed(1) + '" height="' + alt.toFixed(1) + '" rx="2"/>';
      acum += v;
    }
    if (totais[i]) svg += '<text class="total" x="' + (x + barra / 2).toFixed(1) + '" y="' + (y(totais[i]) - 5).toFixed(1) + '" text-anchor="middle">' + totais[i] + '</text>';
    svg += '<text class="eixo" x="' + (x + barra / 2).toFixed(1) + '" y="' + (A - 8) + '" text-anchor="middle">' + esc(c.rotulo) + '</text></g>';
  });
  svg += '</svg>';
  const legenda = '<div class="legenda">' + categorias.map(([k, n]) => '<span><i class="cat-' + esc(k) + '"></i>' + esc(n) + '</span>').join('') + '</div>';
  const tabela = '<details class="tabela-grafico"><summary>Ver como tabela</summary><table class="tabela"><thead><tr><th>Mês</th>' + categorias.map(([, n]) => '<th>' + esc(n) + '</th>').join('') + '<th>Total</th></tr></thead><tbody>'
    + colunas.map((c, i) => '<tr><td>' + esc(c.rotulo) + '</td>' + categorias.map(([k]) => '<td class="num">' + (c.valores[k] || 0) + '</td>').join('') + '<td class="num"><b>' + totais[i] + '</b></td></tr>').join('') + '</tbody></table></details>';
  return '<figure class="figura-grafico" data-grafico>' + legenda + '<div class="area-grafico">' + svg + '<div class="dica" role="status" hidden></div></div>' + tabela + '</figure>';
}

/** Liga a dica (tooltip) das colunas: mouse, toque e teclado. */
export function ligarGrafico(raiz, { colunas, categorias, unidade = 'atendimento(s)' }) {
  raiz.querySelectorAll('[data-grafico]').forEach(fig => {
    const dica = fig.querySelector('.dica'), area = fig.querySelector('.area-grafico');
    const mostrar = g => {
      const c = colunas[Number(g.dataset.i)], total = categorias.reduce((s, [k]) => s + (c.valores[k] || 0), 0);
      dica.innerHTML = '<strong>' + esc(c.rotulo) + ' — ' + total + ' ' + unidade + '</strong>' + categorias.map(([k, n]) => '<span><i class="cat-' + esc(k) + '"></i>' + esc(n) + ': <b>' + (c.valores[k] || 0) + '</b></span>').join('');
      const r = g.getBoundingClientRect(), base = area.getBoundingClientRect();
      dica.hidden = false;
      const x = Math.min(Math.max(8, r.left - base.left + r.width / 2 - dica.offsetWidth / 2), base.width - dica.offsetWidth - 8);
      dica.style.left = x + 'px'; dica.style.top = '4px';
      fig.querySelectorAll('.coluna').forEach(o => o.classList.toggle('apagada', o !== g));
    };
    const esconder = () => { dica.hidden = true; fig.querySelectorAll('.coluna').forEach(o => o.classList.remove('apagada')); };
    fig.querySelectorAll('.coluna').forEach(g => { g.addEventListener('mouseenter', () => mostrar(g)); g.addEventListener('focus', () => mostrar(g)); g.addEventListener('click', () => mostrar(g)); });
    area.addEventListener('mouseleave', esconder); fig.querySelectorAll('.coluna').forEach(g => g.addEventListener('blur', esconder));
  });
}

function escala(max) {
  const bruto = max / 4, pot = 10 ** Math.floor(Math.log10(bruto)), n = bruto / pot;
  return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pot);
}
