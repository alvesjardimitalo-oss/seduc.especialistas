// Painel: agenda de consultas com busca (aluno ou código), filtro de data e de profissional.
// Cada consulta abre em janela ampliada (ver abrirConsulta em formularios.js).
import * as dados from '../dados.js';
import { S, pode, escolaCurta, estudante, garantirAtendimentos, escopoEscolas, escolaAtual, especialistasDaEscola } from '../estado.js';
import { formAtendimento, formAgendar, formAluno, abrirConsulta } from '../formularios.js';
import { ESPECIALIDADES, STATUS_AGENDA, DIAS, diaMunicipal, diaDaSemana, instante, somarDias, horaMunicipal, formatarData, ms, consultasDoPainel } from '../dominio.js';
import { esc, vazio, $, $$ } from '../ui.js';

const filtros = { busca: '', dia: '', profissional: null, mostrarCancelados: false };

export function linhaAgenda(a, { mostrarProf = true, mostrarData = false } = {}) {
  const e = estudante(a.estudante_id);
  return '<button type="button" class="linha-agenda s-' + esc(a.status) + '" data-consulta="' + esc(a.id) + '">'
    + '<span class="hora">' + (mostrarData ? '<em>' + esc(formatarData(a.inicio).slice(0, 5)) + '</em>' : '') + esc(horaMunicipal(a.inicio)) + '<small>' + (a.duracao_min || '') + ' min</small></span>'
    + '<span class="quem"><strong>' + esc(e?.nome || 'Aluno') + '</strong><small>' + esc(escolaCurta(a.escola_id)) + (mostrarProf ? ' · ' + esc(a.profissional_nome) : '') + (a.codigo ? ' · ' + esc(a.codigo) : '') + '</small></span>'
    + '<span class="selo s-' + esc(a.status) + '">' + esc(STATUS_AGENDA[a.status] || a.status) + '</span></button>';
}
export function ligarAgendamentos(raiz, lista) {
  $$('[data-consulta]', raiz).forEach(b => b.onclick = () => abrirConsulta(lista.find(a => a.id === b.dataset.consulta)));
}

export async function render(main, vigente) {
  const hoje = diaMunicipal(Date.now()), agora = new Date(), eu = S.perfil, especialista = eu.perfil === 'especialista';
  if (filtros.profissional === null) filtros.profissional = especialista ? S.user.uid : '';
  const de = filtros.dia || somarDias(hoje, -7), ate = filtros.dia || somarDias(hoje, 30);
  const escolas = escolaAtual() ? [escolaAtual()] : escopoEscolas() || undefined;
  const periodo = { de: instante(de, '00:00'), ate: instante(somarDias(ate, 1), '00:00') };
  const [agendamentos, atendimentos, vencidos] = await Promise.all([
    filtros.profissional ? dados.listarAgendamentos({ profissional: filtros.profissional, ...periodo }) : dados.listarAgendamentos({ escolas, ...periodo }),
    garantirAtendimentos(),
    especialista ? dados.listarAgendamentos({ profissional: S.user.uid, de: instante(somarDias(hoje, -30), '00:00'), ate: new Date() }) : Promise.resolve([])
  ]);
  if (!vigente()) return;
  const noPeriodo = atendimentos.filter(a => { const d = diaMunicipal(a.data); return d >= de && d <= ate; });
  const lista = consultasDoPainel({ agendamentos, atendimentos: noPeriodo, estudantes: S.estudantes, filtros: { ...filtros, escola: escolaAtual() } });
  const semRegistro = vencidos.filter(a => a.status === 'agendado' && ms(a.inicio) < Date.now() && (!escolaAtual() || a.escola_id === escolaAtual()));
  const ativos = S.estudantes.filter(e => (e.situacao || 'ativo') === 'ativo' && (!escolaAtual() || e.escola_id === escolaAtual()));
  const aguardando = ativos.filter(e => !S.acompanhamento.get(e.id));
  const saudacao = agora.getHours() < 12 ? 'Bom dia' : agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const profs = especialistasDaEscola(escolaAtual());

  // agrupa por dia
  const porDia = new Map();
  for (const c of lista) { const d = diaMunicipal(c.inicio); if (!porDia.has(d)) porDia.set(d, []); porDia.get(d).push(c); }

  let h = '<header class="pagina-topo painel-topo"><div><span class="sobre-escuro">' + esc(DIAS[diaDaSemana(hoje)] + ', ' + formatarData(Date.now())) + '</span><h1>' + saudacao + ', ' + esc(String(eu.nome).split(' ')[0]) + '</h1></div>'
    + '<div class="menu-mais"><button class="btn mais" id="mais" aria-haspopup="true" aria-expanded="false" aria-label="Novo">+</button><div class="menu-mais-lista" hidden>'
    + (pode.agendar() ? '<button data-acao="agendar">Agendar consulta</button>' : '')
    + (pode.registrar() ? '<button data-acao="registrar">Registrar atendimento sem agendamento</button>' : '')
    + (pode.cadastrarAluno() ? '<button data-acao="aluno">Cadastrar aluno</button>' : '') + '</div></div></header>';

  if (semRegistro.length) h += '<div class="alerta-caixa aviso"><strong>' + semRegistro.length + ' consulta(s) sem registro.</strong> Informe se o aluno compareceu: '
    + semRegistro.slice(0, 6).map(a => '<button class="link" data-consulta="' + esc(a.id) + '">' + esc(formatarData(a.inicio).slice(0, 5) + ' ' + (estudante(a.estudante_id)?.nome || 'Aluno')) + '</button>').join(' · ') + '</div>';

  h += '<section class="cartao"><form class="busca-consultas" id="busca" autocomplete="off">'
    + '<label class="campo busca-grande"><span>Buscar consulta</span><input type="search" name="busca" value="' + esc(filtros.busca) + '" placeholder="Nome do aluno ou código da consulta"></label>'
    + '<label class="campo"><span>Data</span><input type="date" name="dia" value="' + esc(filtros.dia) + '"></label>'
    + '<label class="campo"><span>Profissional</span><select name="profissional"><option value="">Toda a equipe</option>' + profs.map(u => '<option value="' + esc(u.id) + '"' + (filtros.profissional === u.id ? ' selected' : '') + '>' + esc(u.nome) + ' — ' + esc(ESPECIALIDADES[u.especialidade] || '') + '</option>').join('') + '</select></label>'
    + '<label class="check"><input type="checkbox" name="mostrarCancelados"' + (filtros.mostrarCancelados ? ' checked' : '') + '> Cancelados</label></form>'
    + '<p class="nota" role="status">' + lista.length + ' consulta(s) ' + (filtros.dia ? 'em ' + formatarData(instante(filtros.dia, '12:00')) : 'de ' + formatarData(instante(de, '12:00')).slice(0, 5) + ' a ' + formatarData(instante(ate, '12:00')).slice(0, 5)) + (escolaAtual() ? ' · ' + esc(escolaCurta(escolaAtual())) : '') + '</p>'
    + (lista.length ? [...porDia].map(([d, itens]) => '<div class="grupo-dia' + (d === hoje ? ' hoje' : '') + '"><h3>' + (d === hoje ? 'Hoje' : d === somarDias(hoje, 1) ? 'Amanhã' : DIAS[diaDaSemana(d)]) + ' · ' + formatarData(instante(d, '12:00')) + '</h3><div class="lista-agenda">' + itens.map(c => linhaAgenda(c, { mostrarProf: !filtros.profissional })).join('') + '</div></div>').join('')
      : vazio('Nenhuma consulta encontrada.', filtros.busca || filtros.dia ? 'Revise a busca ou a data.' : 'Use o botão + para agendar.'))
    + '</section>';

  h += '<section class="cartao"><header class="cartao-topo"><h2>Aguardando primeiro atendimento (' + aguardando.length + ')</h2><a href="#/alunos" class="link">Ver alunos →</a></header>'
    + (aguardando.length ? '<ul class="lista-simples">' + aguardando.slice(0, 6).map(e => '<li><a href="#/aluno/' + esc(e.id) + '"><strong>' + esc(e.nome) + '</strong><small>' + esc(escolaCurta(e.escola_id)) + (e.turma ? ' · ' + esc(e.turma) : '') + '</small></a></li>').join('') + '</ul>' : vazio('Nenhum aluno aguardando.'))
    + '</section>';

  main.innerHTML = h;
  ligarAgendamentos(main, [...lista, ...semRegistro]);
  const form = $('#busca', main);
  let t;
  form.oninput = ev => {
    clearTimeout(t);
    t = setTimeout(() => {
      Object.assign(filtros, { busca: form.busca.value, dia: form.dia.value, profissional: form.profissional.value, mostrarCancelados: form.mostrarCancelados.checked });
      const foco = ev.target.name, pos = ev.target.selectionStart;
      render(main, vigente).then(() => { const el = $('#busca [name=' + foco + ']', main); el?.focus(); if (foco === 'busca' && el) el.setSelectionRange(pos, pos); });
    }, ev.target.name === 'busca' ? 250 : 0);
  };
  form.onsubmit = e => e.preventDefault();
  const mais = $('#mais', main), lista2 = $('.menu-mais-lista', main);
  mais.onclick = () => { lista2.hidden = !lista2.hidden; mais.setAttribute('aria-expanded', String(!lista2.hidden)); };
  $$('[data-acao]', main).forEach(b => b.onclick = () => { lista2.hidden = true; ({ registrar: () => formAtendimento(), agendar: () => formAgendar(), aluno: () => formAluno() })[b.dataset.acao](); });
}
