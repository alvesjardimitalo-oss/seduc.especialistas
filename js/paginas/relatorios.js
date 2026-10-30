import * as dados from '../dados.js';
import { S, escolaCurta, especialistas, escolasVisiveis, escopoEscolas } from '../estado.js';
import { ESPECIALIDADES, TIPOS_ATENDIMENTO, diaMunicipal, somarDias, instante, resumoGerencial, csv, formatarDataHora } from '../dominio.js';
import { esc, vazio, aviso, $ } from '../ui.js';
import { imprimirGerencial } from '../impressao.js';

export async function render(main, vigente) {
  const hoje = diaMunicipal(Date.now());
  const f = S.filtrosRelatorio ||= { de: hoje.slice(0, 7) + '-01', ate: hoje, escola: '', especialidade: '', profissional: S.perfil.perfil === 'especialista' ? S.user.uid : '' };
  if (f.de && f.ate && f.de > f.ate) { [f.de, f.ate] = [f.ate, f.de]; }
  const periodo = { de: f.de ? instante(f.de, '00:00') : undefined, ate: f.ate ? instante(somarDias(f.ate, 1), '00:00') : undefined, escolas: escopoEscolas() || undefined };
  const [atendimentos, agendamentos] = await Promise.all([
    dados.listarAtendimentos(periodo),
    dados.listarAgendamentos({ de: periodo.de || instante('2020-01-01'), ate: periodo.ate || instante(somarDias(hoje, 1)), escolas: periodo.escolas })
  ]);
  if (!vigente()) return;
  const r = resumoGerencial({ atendimentos, agendamentos, filtros: f });
  const profs = especialistas();
  const sel = (nome, rotulo, itens, vazioTxt) => '<label class="campo"><span>' + rotulo + '</span><select name="' + nome + '"><option value="">' + vazioTxt + '</option>' + itens.map(([v, t]) => '<option value="' + esc(v) + '"' + (f[nome] === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>';
  const card = (rot, v, cor) => '<div class="metrica m-' + cor + '"><span>' + rot + '</span><b>' + v + '</b></div>';

  main.innerHTML = '<header class="pagina-topo"><div><h1>Relatórios</h1><p>Indicadores quantitativos do atendimento especializado. Não exibem conteúdo clínico.</p></div>'
    + '<div class="acoes-linha"><button class="btn sec" id="csv">Exportar planilha (CSV)</button><button class="btn" id="imprimir">Imprimir / PDF</button></div></header>'
    + '<form class="cartao filtros" id="filtros">'
    + '<label class="campo"><span>De</span><input type="date" name="de" value="' + esc(f.de) + '"></label><label class="campo"><span>Até</span><input type="date" name="ate" value="' + esc(f.ate) + '"></label>'
    + sel('escola', 'Escola', escolasVisiveis().map(e => [e.id, escolaCurta(e.id)]), 'Todas')
    + sel('especialidade', 'Especialidade', Object.entries(ESPECIALIDADES), 'Todas')
    + sel('profissional', 'Profissional', profs.map(u => [u.id, u.nome]), 'Toda a equipe') + '</form>'
    + '<div class="metricas">' + card('Atendimentos realizados', r.atendimentos, 'azul') + card('Alunos atendidos', r.alunos, 'verde') + card('Horas de atendimento', String(r.horas).replace('.', ','), 'roxo') + card('Faltas de alunos', r.faltas, 'ambar') + '</div>'
    + '<div class="colunas">'
    + '<section class="cartao"><h2>Por escola</h2>' + (Object.keys(r.porEscola).length ? '<table class="tabela"><thead><tr><th>Escola</th><th>Alunos</th><th>Atend.</th>' + Object.keys(ESPECIALIDADES).map(k => '<th title="' + ESPECIALIDADES[k] + '">' + ESPECIALIDADES[k].slice(0, 5) + '.</th>').join('') + '</tr></thead><tbody>'
      + Object.entries(r.porEscola).sort((a, b) => b[1].atendimentos - a[1].atendimentos).map(([id, e]) => '<tr><td>' + esc(escolaCurta(id)) + '</td><td class="num">' + e.alunos + '</td><td class="num">' + e.atendimentos + '</td>' + Object.keys(ESPECIALIDADES).map(k => '<td class="num">' + (e.porEspecialidade[k] || 0) + '</td>').join('') + '</tr>').join('') + '</tbody></table>' : vazio('Sem atendimentos no período.')) + '</section>'
    + '<section class="cartao"><h2>Por tipo de atendimento</h2>' + barras(r.porTipo, TIPOS_ATENDIMENTO) + '<h2 class="subtitulo">Agenda no período</h2><p>' + r.agendados + ' agendado(s) a realizar · ' + r.faltas + ' falta(s) · ' + r.cancelados + ' cancelamento(s) · ' + r.altas + ' alta(s)</p></section>'
    + '</div>'
    + '<section class="cartao"><h2>Por profissional</h2>' + (Object.keys(r.porProfissional).length ? '<table class="tabela"><thead><tr><th>Profissional</th><th>Especialidade</th><th>Atendimentos</th><th>Alunos</th><th>Horas</th><th>Faltas</th></tr></thead><tbody>'
      + Object.values(r.porProfissional).map(p => '<tr><td>' + esc(p.nome) + '</td><td>' + esc(ESPECIALIDADES[p.especialidade]) + '</td><td class="num">' + p.atendimentos + '</td><td class="num">' + p.alunos + '</td><td class="num">' + String(Math.round(p.minutos / 6) / 10).replace('.', ',') + '</td><td class="num">' + (p.faltas || 0) + '</td></tr>').join('') + '</tbody></table>' : vazio('Sem atendimentos no período.')) + '</section>';

  $('#filtros', main).onchange = ev => { S.filtrosRelatorio = { ...f, ...Object.fromEntries(new FormData(ev.currentTarget)) }; render(main, vigente); };
  $('#imprimir', main).onclick = () => imprimirGerencial(r, f, { profissional: profs.find(u => u.id === f.profissional)?.nome });
  $('#csv', main).onclick = () => {
    const ok = a => a.situacao !== 'anulado' && (!f.escola || a.escola_id === f.escola) && (!f.especialidade || a.especialidade === f.especialidade) && (!f.profissional || a.profissional_uid === f.profissional) && diaMunicipal(a.data) >= (f.de || '') && (!f.ate || diaMunicipal(a.data) <= f.ate);
    const linhas = [['Data', 'Escola', 'Especialidade', 'Profissional', 'Tipo', 'Duração (min)', 'Código do aluno']]
      .concat(atendimentos.filter(ok).map(a => [formatarDataHora(a.data), escolaCurta(a.escola_id), ESPECIALIDADES[a.especialidade], a.profissional_nome, TIPOS_ATENDIMENTO[a.tipo], a.duracao_min, a.estudante_id.slice(-6)]));
    const url = URL.createObjectURL(new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'atendimentos_' + (f.de || 'inicio') + '_' + (f.ate || hoje) + '.csv' });
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    aviso('Planilha gerada sem nomes de alunos (apenas código).');
  };
}

function barras(contagem, rotulos) {
  const max = Math.max(1, ...Object.values(contagem));
  const itens = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  return itens.length ? '<div class="barras">' + itens.map(([k, v]) => '<div class="barra"><span>' + esc(rotulos[k] || k) + '</span><i style="width:' + (v / max * 100) + '%"></i><b>' + v + '</b></div>').join('') + '</div>' : vazio('Sem dados.');
}
