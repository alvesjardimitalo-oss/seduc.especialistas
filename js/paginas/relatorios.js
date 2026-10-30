// Módulo de relatórios: somente atendimentos realizados (sem conteúdo clínico).
import * as dados from '../dados.js';
import { S, escolaCurta, especialistasDaEscola, escolasVisiveis, escopoEscolas, escolaAtual, estudante } from '../estado.js';
import { ESPECIALIDADES, TIPOS_ATENDIMENTO, EVOLUCAO, diaMunicipal, somarDias, instante, resumoGerencial, csv, formatarDataHora, ms } from '../dominio.js';
import { esc, vazio, aviso, $, $$ } from '../ui.js';
import { imprimirGerencial } from '../impressao.js';

const LIMITE_TABELA = 300;

export async function render(main, vigente) {
  const hoje = diaMunicipal(Date.now());
  const f = S.filtrosRelatorio ||= { de: hoje.slice(0, 7) + '-01', ate: hoje, escola: escolaAtual(), especialidade: '', profissional: S.perfil.perfil === 'especialista' ? S.user.uid : '' };
  if (f.de && f.ate && f.de > f.ate) [f.de, f.ate] = [f.ate, f.de];
  const atendimentos = await dados.listarAtendimentos({ de: f.de ? instante(f.de, '00:00') : undefined, ate: f.ate ? instante(somarDias(f.ate, 1), '00:00') : undefined, escolas: escopoEscolas() || undefined });
  if (!vigente()) return;
  const r = resumoGerencial({ atendimentos, filtros: f });
  const lista = atendimentos.filter(a => a.situacao !== 'anulado' && (!f.escola || a.escola_id === f.escola) && (!f.especialidade || a.especialidade === f.especialidade) && (!f.profissional || a.profissional_uid === f.profissional))
    .sort((a, b) => ms(b.data) - ms(a.data));
  const profs = especialistasDaEscola(f.escola);
  const sel = (nome, rotulo, itens, vazioTxt) => '<label class="campo"><span>' + rotulo + '</span><select name="' + nome + '"><option value="">' + vazioTxt + '</option>' + itens.map(([v, t]) => '<option value="' + esc(v) + '"' + (f[nome] === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>';
  const card = (rot, v, cor) => '<div class="metrica m-' + cor + '"><span>' + rot + '</span><b>' + v + '</b></div>';
  const horas = m => String(Math.round(m / 6) / 10).replace('.', ',');

  main.innerHTML = '<header class="pagina-topo"><div><h1>Relatórios de atendimentos</h1><p>Somente atendimentos realizados. Faltas, cancelamentos e textos clínicos não entram neste módulo.</p></div>'
    + '<div class="acoes-linha"><button class="btn sec" id="csv">Exportar planilha (CSV)</button><button class="btn" id="imprimir">Imprimir / PDF</button></div></header>'
    + '<form class="cartao filtros" id="filtros">'
    + '<label class="campo"><span>De</span><input type="date" name="de" value="' + esc(f.de) + '"></label><label class="campo"><span>Até</span><input type="date" name="ate" value="' + esc(f.ate) + '"></label>'
    + sel('escola', 'Instituição', escolasVisiveis().map(e => [e.id, escolaCurta(e.id)]), 'Todas')
    + sel('especialidade', 'Especialidade', Object.entries(ESPECIALIDADES), 'Todas')
    + sel('profissional', 'Profissional', profs.map(u => [u.id, u.nome]), 'Toda a equipe') + '</form>'
    + '<div class="metricas">' + card('Atendimentos realizados', r.atendimentos, 'azul') + card('Alunos atendidos', r.alunos, 'verde') + card('Horas de atendimento', horas(r.horas * 60), 'roxo') + card('Altas', r.altas, 'ambar') + '</div>'
    + '<div class="colunas">'
    + '<section class="cartao"><h2>Por instituição</h2>' + (Object.keys(r.porEscola).length ? '<table class="tabela"><thead><tr><th>Instituição</th><th>Alunos</th><th>Atend.</th>' + Object.keys(ESPECIALIDADES).map(k => '<th title="' + ESPECIALIDADES[k] + '">' + ESPECIALIDADES[k].slice(0, 5) + '.</th>').join('') + '</tr></thead><tbody>'
      + Object.entries(r.porEscola).sort((a, b) => b[1].atendimentos - a[1].atendimentos).map(([id, e]) => '<tr><td>' + esc(escolaCurta(id)) + '</td><td class="num">' + e.alunos + '</td><td class="num">' + e.atendimentos + '</td>' + Object.keys(ESPECIALIDADES).map(k => '<td class="num">' + (e.porEspecialidade[k] || 0) + '</td>').join('') + '</tr>').join('') + '</tbody></table>' : vazio('Sem atendimentos no período.')) + '</section>'
    + '<section class="cartao"><h2>Por profissional</h2>' + (Object.keys(r.porProfissional).length ? '<table class="tabela"><thead><tr><th>Profissional</th><th>Especialidade</th><th>Atend.</th><th>Alunos</th><th>Horas</th></tr></thead><tbody>'
      + Object.values(r.porProfissional).map(p => '<tr><td>' + esc(p.nome) + '</td><td>' + esc(ESPECIALIDADES[p.especialidade]) + '</td><td class="num">' + p.atendimentos + '</td><td class="num">' + p.alunos + '</td><td class="num">' + horas(p.minutos) + '</td></tr>').join('') + '</tbody></table>' : vazio('Sem atendimentos no período.'))
    + '<h2 class="subtitulo">Por tipo</h2>' + barras(r.porTipo, TIPOS_ATENDIMENTO) + '</section>'
    + '</div>'
    + '<section class="cartao"><h2>Atendimentos realizados (' + lista.length + ')</h2>'
    + (lista.length ? '<table class="tabela"><thead><tr><th>Data</th><th>Código</th><th>Aluno</th><th>Instituição</th><th>Profissional</th><th>Tipo</th><th>Evolução</th><th>Min</th></tr></thead><tbody>'
      + lista.slice(0, LIMITE_TABELA).map(a => '<tr><td>' + esc(formatarDataHora(a.data)) + '</td><td>' + esc(a.codigo || '—') + '</td><td><a href="#/aluno/' + esc(a.estudante_id) + '">' + esc(estudante(a.estudante_id)?.nome || 'Aluno') + '</a></td><td>' + esc(escolaCurta(a.escola_id)) + '</td><td>' + esc(a.profissional_nome) + '<br><small class="nota">' + esc(ESPECIALIDADES[a.especialidade]) + '</small></td><td>' + esc(TIPOS_ATENDIMENTO[a.tipo]) + '</td><td>' + esc(EVOLUCAO[a.evolucao]) + '</td><td class="num">' + a.duracao_min + '</td></tr>').join('')
      + '</tbody></table>' + (lista.length > LIMITE_TABELA ? '<p class="nota">Mostrando os ' + LIMITE_TABELA + ' mais recentes. A planilha traz todos.</p>' : '')
      : vazio('Nenhum atendimento realizado no período.')) + '</section>';

  $('#filtros', main).onchange = ev => { S.filtrosRelatorio = { ...f, ...Object.fromEntries(new FormData(ev.currentTarget)) }; render(main, vigente); };
  $('#imprimir', main).onclick = () => imprimirGerencial(r, f, { profissional: profs.find(u => u.id === f.profissional)?.nome });
  $('#csv', main).onclick = () => {
    const linhas = [['Data', 'Código da consulta', 'Código do aluno', 'Instituição', 'Especialidade', 'Profissional', 'Tipo', 'Evolução', 'Duração (min)']]
      .concat(lista.map(a => [formatarDataHora(a.data), a.codigo || '', a.estudante_id.slice(-6), escolaCurta(a.escola_id), ESPECIALIDADES[a.especialidade], a.profissional_nome, TIPOS_ATENDIMENTO[a.tipo], EVOLUCAO[a.evolucao], a.duracao_min]));
    const url = URL.createObjectURL(new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'atendimentos_' + (f.de || 'inicio') + '_' + (f.ate || hoje) + '.csv' });
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    aviso('Planilha gerada sem nomes de alunos (LGPD): use o código para localizar.');
  };
}

function barras(contagem, rotulos) {
  const max = Math.max(1, ...Object.values(contagem));
  const itens = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  return itens.length ? '<div class="barras">' + itens.map(([k, v]) => '<div class="barra"><span>' + esc(rotulos[k] || k) + '</span><i style="width:' + (v / max * 100) + '%"></i><b>' + v + '</b></div>').join('') + '</div>' : vazio('Sem dados.');
}
