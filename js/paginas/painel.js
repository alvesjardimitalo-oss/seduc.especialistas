import * as dados from '../dados.js';
import { S, pode, escolaCurta, estudante, garantirAtendimentos, escopoEscolas } from '../estado.js';
import { formAtendimento, formAgendar, formAluno, abrirAgendamento } from '../formularios.js';
import { ESPECIALIDADES, TIPOS_ATENDIMENTO, STATUS_AGENDA, DIAS, diaMunicipal, diaDaSemana, instante, somarDias, horaMunicipal, formatarData, formatarDataHora, ms, resumoGerencial } from '../dominio.js';
import { esc, vazio, $$ } from '../ui.js';

export function linhaAgenda(a, { mostrarProf = true } = {}) {
  const e = estudante(a.estudante_id);
  return '<button type="button" class="linha-agenda s-' + esc(a.status) + '" data-agendamento="' + esc(a.id) + '">'
    + '<span class="hora">' + esc(horaMunicipal(a.inicio)) + '<small>' + a.duracao_min + ' min</small></span>'
    + '<span class="quem"><strong>' + esc(e?.nome || 'Aluno') + '</strong><small>' + esc(escolaCurta(a.escola_id)) + (mostrarProf ? ' · ' + esc(a.profissional_nome) : '') + '</small></span>'
    + '<span class="selo s-' + esc(a.status) + '">' + esc(STATUS_AGENDA[a.status]) + '</span></button>';
}
export function ligarAgendamentos(raiz, lista) {
  $$('[data-agendamento]', raiz).forEach(b => b.onclick = () => abrirAgendamento(lista.find(a => a.id === b.dataset.agendamento)));
}

export async function render(main, vigente) {
  const hoje = diaMunicipal(Date.now()), agora = new Date();
  const eu = S.perfil, especialista = eu.perfil === 'especialista';
  const filtroAgenda = especialista ? { profissional: S.user.uid } : { escolas: escopoEscolas() || undefined };
  const [deHoje, pendentes, atendimentos] = await Promise.all([
    dados.listarAgendamentos({ ...filtroAgenda, de: instante(hoje, '00:00'), ate: instante(somarDias(hoje, 1), '00:00') }),
    especialista ? dados.listarAgendamentos({ profissional: S.user.uid, de: instante(somarDias(hoje, -21), '00:00'), ate: new Date() }) : Promise.resolve([]),
    garantirAtendimentos()
  ]);
  if (!vigente()) return;
  const saudacao = agora.getHours() < 12 ? 'Bom dia' : agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const jornadaHoje = (eu.jornada || []).filter(f => f.dia === diaDaSemana(hoje));
  const ativos = S.estudantes.filter(e => (e.situacao || 'ativo') === 'ativo');
  const aguardando = ativos.filter(e => !S.acompanhamento.get(e.id)).sort((a, b) => ms(a.criado_em) - ms(b.criado_em));
  const atrasados = pendentes.filter(a => a.status === 'agendado' && ms(a.inicio) < Date.now()).sort((a, b) => ms(a.inicio) - ms(b.inicio));
  const mes = hoje.slice(0, 7);
  const r = resumoGerencial({ atendimentos, agendamentos: [], filtros: { de: mes + '-01', ate: hoje, ...(especialista ? { profissional: S.user.uid } : {}) } });
  const recentes = atendimentos.filter(a => a.situacao !== 'anulado').sort((a, b) => ms(b.data) - ms(a.data)).slice(0, 6);

  let h = '<section class="saudacao"><div><span class="sobre">' + esc(DIAS[diaDaSemana(hoje)] + ', ' + formatarData(Date.now())) + '</span>'
    + '<h1>' + saudacao + ', ' + esc(String(eu.nome).split(' ')[0]) + '</h1>'
    + '<p>' + (especialista
      ? esc(ESPECIALIDADES[eu.especialidade] || '') + ' · ' + (jornadaHoje.length ? 'Hoje: ' + jornadaHoje.map(f => f.inicio + '–' + f.fim + (f.escola_id ? ' em ' + escolaCurta(f.escola_id) : '')).join(', ') : 'Hoje não há jornada cadastrada')
      : 'Acompanhamento da equipe de especialistas da rede municipal') + '</p></div>'
    + '<div class="acoes-linha">'
    + (pode.registrar() ? '<button class="btn" data-acao="registrar">+ Registrar atendimento</button>' : '')
    + (pode.agendar() ? '<button class="btn ' + (pode.registrar() ? 'claro' : '') + '" data-acao="agendar">Agendar</button>' : '')
    + (pode.cadastrarAluno() ? '<button class="btn claro" data-acao="aluno">Cadastrar aluno</button>' : '')
    + '</div></section>';

  h += '<div class="metricas">'
    + metrica(especialista ? 'Meus atendimentos no mês' : 'Atendimentos no mês', r.atendimentos, 'azul')
    + metrica(especialista ? 'Alunos que atendi no mês' : 'Alunos atendidos no mês', r.alunos, 'verde')
    + metrica('Alunos em acompanhamento', ativos.filter(e => S.acompanhamento.get(e.id)?.estado === 'em_acompanhamento').length, 'roxo')
    + metrica('Aguardando 1º atendimento', aguardando.length, 'ambar') + '</div>';

  h += '<div class="colunas">';
  h += '<section class="cartao"><header class="cartao-topo"><h2>' + (especialista ? 'Minha agenda de hoje' : 'Agenda de hoje') + '</h2><a href="#/agenda" class="link">Abrir agenda →</a></header>'
    + (deHoje.length ? '<div class="lista-agenda">' + deHoje.sort((a, b) => ms(a.inicio) - ms(b.inicio)).map(a => linhaAgenda(a, { mostrarProf: !especialista })).join('') + '</div>' : vazio('Nenhum atendimento agendado para hoje.'))
    + (atrasados.length ? '<h3 class="subtitulo alerta-texto">Agendamentos sem registro (' + atrasados.length + ')</h3><p class="nota">Registre o atendimento ou marque a falta para manter o prontuário em dia.</p><div class="lista-agenda">' + atrasados.map(a => linhaAgenda(a, { mostrarProf: false }).replace('<span class="hora">', '<span class="hora"><em>' + esc(formatarData(a.inicio).slice(0, 5)) + '</em>')).join('') + '</div>' : '')
    + '</section>';

  h += '<section class="cartao"><header class="cartao-topo"><h2>Aguardando primeiro atendimento</h2><a href="#/alunos" class="link">Ver alunos →</a></header>'
    + (aguardando.length ? '<ul class="lista-simples">' + aguardando.slice(0, 8).map(e => '<li><a href="#/aluno/' + esc(e.id) + '"><strong>' + esc(e.nome) + '</strong><small>' + esc(escolaCurta(e.escola_id)) + (e.turma ? ' · ' + esc(e.turma) : '') + '</small></a></li>').join('') + '</ul>'
      + (aguardando.length > 8 ? '<p class="nota">e mais ' + (aguardando.length - 8) + ' aluno(s).</p>' : '')
      : vazio('Nenhum aluno aguardando.', 'Todos os alunos ativos já tiveram atendimento.'))
    + '</section></div>';

  h += '<section class="cartao"><header class="cartao-topo"><h2>Últimos registros da equipe</h2></header>'
    + (recentes.length ? '<ul class="lista-simples">' + recentes.map(a => '<li><a href="#/aluno/' + esc(a.estudante_id) + '"><span class="ponto esp-' + esc(a.especialidade) + '"></span><strong>' + esc(estudante(a.estudante_id)?.nome || 'Aluno') + '</strong><small>' + esc(TIPOS_ATENDIMENTO[a.tipo]) + ' · ' + esc(ESPECIALIDADES[a.especialidade]) + ' · ' + esc(a.profissional_nome) + ' · ' + esc(formatarDataHora(a.data)) + '</small></a></li>').join('') + '</ul>'
      : vazio('Ainda não há atendimentos registrados.'))
    + '</section>';

  main.innerHTML = h;
  ligarAgendamentos(main, [...deHoje, ...atrasados]);
  $$('[data-acao]', main).forEach(b => b.onclick = () => ({ registrar: () => formAtendimento(), agendar: () => formAgendar(), aluno: () => formAluno() })[b.dataset.acao]());
}

const metrica = (rotulo, valor, cor) => '<div class="metrica m-' + cor + '"><span>' + esc(rotulo) + '</span><b>' + valor + '</b></div>';
