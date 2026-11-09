import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../js/dominio.js';

test('datas no horário municipal (UTC-3)', () => {
  const t = d.instante('2026-11-03', '08:30');
  assert.equal(t.toISOString(), '2026-11-03T11:30:00.000Z');
  assert.equal(d.diaMunicipal(new Date('2026-11-04T02:00:00Z')), '2026-11-03'); // 23h em Frei Inocêncio
  assert.equal(d.horaMunicipal(t), '08:30');
  assert.equal(d.diaDaSemana('2026-11-03'), 2); // terça
  assert.equal(d.inicioDaSemana('2026-11-05'), '2026-11-01');
  assert.equal(d.formatarData(t), '03/11/2026');
});

test('jornada gera índices de meia hora e rejeita sobreposição', () => {
  const { jornada, slots } = d.prepararJornada([{ dia: 2, inicio: '08:00', fim: '10:00', escola_id: 'x' }, { dia: 1, inicio: '13:00', fim: '13:30' }]);
  assert.deepEqual(slots, [1 * 48 + 26, 2 * 48 + 16, 2 * 48 + 17, 2 * 48 + 18, 2 * 48 + 19]);
  assert.equal(jornada[0].dia, 1);
  assert.throws(() => d.prepararJornada([{ dia: 1, inicio: '08:00', fim: '10:00' }, { dia: 1, inicio: '09:30', fim: '11:00' }]), /sobrepostas/);
  assert.throws(() => d.prepararJornada([{ dia: 1, inicio: '08:15', fim: '10:00' }]), /meia hora/);
  assert.throws(() => d.prepararJornada([{ dia: 1, inicio: '10:00', fim: '10:00' }]), /depois/);
});

test('índice do slot coincide com a regra do Firestore', () => {
  assert.equal(d.indiceSlot(d.instante('2026-11-03', '08:00')), 2 * 48 + 16);
  assert.equal(d.indiceSlot(d.instante('2026-11-08', '00:30')), 1); // domingo
});

test('horários livres respeitam jornada, ocupação, duração e passado', () => {
  const { slots } = d.prepararJornada([{ dia: 2, inicio: '08:00', fim: '10:00' }]);
  const agora = d.instante('2026-11-01', '12:00').getTime();
  const ocupados = [{ inicio: d.instante('2026-11-03', '08:30'), duracao_min: 30, status: 'agendado' }, { inicio: d.instante('2026-11-03', '09:00'), duracao_min: 30, status: 'cancelado' }];
  const h = l => l.map(x => d.horaMunicipal(x));
  assert.deepEqual(h(d.horariosLivres({ dia: '2026-11-03', slots, ocupados, agora })), ['08:00', '09:00', '09:30']);
  assert.deepEqual(h(d.horariosLivres({ dia: '2026-11-03', slots, ocupados, duracao: 60, agora })), ['09:00']);
  assert.deepEqual(d.horariosLivres({ dia: '2026-11-04', slots, ocupados, agora }), []);
  assert.deepEqual(h(d.horariosLivres({ dia: '2026-11-03', slots, ocupados: [], agora: d.instante('2026-11-03', '09:10').getTime() })), ['09:30']);
  assert.ok(d.validarAgendamento({ inicio: d.instante('2026-11-03', '09:00'), duracao: 60, slots, ocupados, agora }));
  assert.throws(() => d.validarAgendamento({ inicio: d.instante('2026-11-03', '08:30'), duracao: 30, slots, ocupados, agora }), /ocupado/);
  assert.throws(() => d.validarAgendamento({ inicio: d.instante('2026-11-03', '08:15'), duracao: 30, slots, ocupados, agora }), /meia hora/);
});

test('cadastro de aluno: validação e duplicidade', () => {
  assert.throws(() => d.validarEstudante({ nome: 'Al', escola_id: 'x' }), /nome/);
  assert.throws(() => d.validarEstudante({ nome: 'Ana Souza' }), /escola/);
  const e = d.validarEstudante({ nome: '  Ana   Souza ', escola_id: 'x', nascimento: '2018-05-01' });
  assert.equal(e.nome, 'Ana Souza');
  const lista = [{ id: '1', nome: 'ANA SOUZA', nascimento: '2018-05-01' }, { id: '2', nome: 'Ána Souza', nascimento: '2017-01-01' }];
  assert.deepEqual(d.possiveisDuplicados(lista, e).map(x => x.id), ['1']);
  assert.equal(d.idade('2018-05-01', d.instante('2026-04-30', '12:00')), 7);
  assert.equal(d.idade('2018-05-01', d.instante('2026-05-01', '12:00')), 8);
});

test('registro SOAP: objetivo obrigatório, até 4000 por campo e 10000 no total', () => {
  assert.throws(() => d.validarRegistro({ subjetivo: 'Relato da mãe', objetivo: ' ', tipo: 'sessao', evolucao: 'avancou' }), /Objetivo/);
  assert.throws(() => d.validarRegistro({ objetivo: 'x', tipo: 'outro', evolucao: 'avancou' }), /tipo/);
  assert.throws(() => d.validarRegistro({ objetivo: 'b'.repeat(4001), tipo: 'sessao', evolucao: 'avancou' }), /4000/);
  assert.throws(() => d.validarRegistro({ subjetivo: 'a'.repeat(3000), objetivo: 'b'.repeat(3000), avaliacao: 'c'.repeat(3000), plano: 'd'.repeat(1001), tipo: 'sessao', evolucao: 'avancou' }), /10000/);
  assert.equal(d.validarRegistro({ subjetivo: 'a'.repeat(3000), objetivo: 'b'.repeat(4000), avaliacao: 'c'.repeat(2000), plano: 'd'.repeat(1000), tipo: 'sessao', evolucao: 'avancou' }).objetivo.length, 4000);
  assert.deepEqual(d.validarRegistro({ subjetivo: ' s ', objetivo: 'o', avaliacao: '', plano: 'p', tipo: 'sessao', evolucao: 'estavel' }), { subjetivo: 's', objetivo: 'o', avaliacao: '', plano: 'p', orientacao_escola: '' });
  assert.deepEqual(d.secoesRegistro({ objetivo: 'o', plano: 'p' }).map(x => x[0]), ['O — Objetivo', 'P — Plano']);
  assert.deepEqual(d.secoesRegistro({ trabalhado: 't', orientacoes: 'or' }).map(x => x[1]), ['t', 'or']);
  assert.equal(d.planoDoRegistro({ orientacoes: 'antigo' }), 'antigo'); assert.equal(d.planoDoRegistro({ plano: 'novo', orientacoes: 'x' }), 'novo');
});

test('problemas e condições; fila do dia por ordem de chegada', () => {
  assert.throws(() => d.validarCondicao({ descricao: 'ab' }), /3 a 150/);
  assert.deepEqual(d.validarCondicao({ descricao: '  Troca  de fonemas ', observacao: '' }), { descricao: 'Troca de fonemas', observacao: '' });
  const ord = d.ordenarCondicoes([{ id: 'r', situacao: 'resolvido', criado_em: 3 }, { id: 'a1', situacao: 'ativo', criado_em: 1 }, { id: 'a2', situacao: 'ativo', criado_em: 2 }]);
  assert.deepEqual(ord.map(c => c.id), ['a2', 'a1', 'r']);
  const t = h => d.instante('2026-11-03', h);
  const fila = d.filaDoDia([{ id: 'x', status: 'agendado', inicio: t('08:00') }, { id: 'y', status: 'agendado', inicio: t('09:00'), chegada_em: t('07:55') }, { id: 'z', status: 'agendado', inicio: t('08:30'), chegada_em: t('07:50') }, { id: 'w', status: 'realizado', inicio: t('07:30'), chegada_em: t('07:20') }]);
  assert.deepEqual(fila.map(f => f.id), ['z', 'y', 'w', 'x']);
});

test('situação do acompanhamento por especialidade, com alta e anulados', () => {
  const a = (esp, dia, tipo = 'sessao', situacao = 'valido') => ({ estudante_id: 'e', especialidade: esp, data: d.instante(dia, '09:00'), tipo, situacao });
  const s = d.situacaoAcompanhamento([a('fonoaudiologia', '2026-03-01', 'avaliacao'), a('fonoaudiologia', '2026-04-01', 'alta'), a('psicopedagogia', '2026-05-01'), a('neuropsicologia', '2026-06-01', 'sessao', 'anulado')]);
  assert.deepEqual(s.especialidades, ['psicopedagogia']);
  assert.deepEqual(s.altas, ['fonoaudiologia']);
  assert.equal(s.estado, 'em_acompanhamento');
  assert.equal(s.total, 3);
  assert.equal(d.situacaoAcompanhamento([a('fonoaudiologia', '2026-03-01', 'alta')]).estado, 'alta');
  assert.equal(d.situacaoAcompanhamento([]).estado, 'aguardando');
  const linha = d.linhaDoTempo([a('fonoaudiologia', '2026-03-01'), a('psicopedagogia', '2026-05-01'), a('fonoaudiologia', '2026-04-01', 'sessao', 'anulado')], { especialidade: 'fonoaudiologia', incluirAnulados: false });
  assert.equal(linha.length, 1);
});

test('resumo gerencial por período, escola e profissional', () => {
  const at = (esc, uid, dia, aluno, extra = {}) => ({ escola_id: esc, profissional_uid: uid, profissional_nome: uid, especialidade: 'fonoaudiologia', data: d.instante(dia, '10:00'), estudante_id: aluno, tipo: 'sessao', duracao_min: 45, situacao: 'valido', ...extra });
  const atendimentos = [at('a', 'p1', '2026-10-01', 'x'), at('a', 'p1', '2026-10-02', 'x'), at('b', 'p2', '2026-10-31', 'y', { especialidade: 'psicopedagogia' }), at('b', 'p2', '2026-11-01', 'z'), at('a', 'p1', '2026-10-05', 'w', { situacao: 'anulado' })];
  const agendamentos = [{ escola_id: 'a', profissional_uid: 'p1', especialidade: 'fonoaudiologia', inicio: d.instante('2026-10-03', '09:00'), status: 'falta' }];
  const r = d.resumoGerencial({ atendimentos, agendamentos, filtros: { de: '2026-10-01', ate: '2026-10-31' } });
  assert.equal(r.atendimentos, 3); assert.equal(r.alunos, 2); assert.equal(r.faltas, 1); assert.equal(r.horas, 2.3);
  assert.equal(r.porEscola.a.alunos, 1); assert.equal(r.porEscola.b.porEspecialidade.psicopedagogia, 1);
  assert.equal(r.porProfissional.p1.faltas, 1);
  assert.equal(d.resumoGerencial({ atendimentos, agendamentos, filtros: { escola: 'b' } }).atendimentos, 2);
});

test('CSV com BOM e escape', () => {
  assert.equal(d.csv([['a;b', 'c"d'], [1, '']]), '﻿"a;b";"c""d"\r\n1;');
});

test('importação do arquivo privado valida esquema e escolas', () => {
  const ok = { esquema: 'seduc_alunos_especiais_v1', alunos: [{ id: 'alu_' + 'a'.repeat(24), nome: 'Maria Teste', escola_id: 'monteiro-lobato', turma: '1º ano', deficiencia: 'TEA', ano_letivo: 2026 }] };
  const r = d.conferirImportacaoAlunos(ok);
  assert.equal(r[0].estudante.nome, 'Maria Teste'); assert.equal(r[0].necessidade, 'TEA');
  assert.throws(() => d.conferirImportacaoAlunos({ ...ok, esquema: 'x' }), /incompatível/);
  assert.throws(() => d.conferirImportacaoAlunos({ ...ok, alunos: [{ ...ok.alunos[0], escola_id: 'outra' }] }), /Escola/);
});

test('código único da consulta', () => {
  const c = d.gerarCodigo(d.instante('2026-10-30', '09:00'), () => 0);
  assert.equal(c, 'C261030-AAAA'); assert.ok(d.codigoValido(c));
  assert.ok(!d.codigoValido('C2610-AAAA')); assert.ok(!d.codigoValido(''));
  const vistos = new Set(); for (let i = 0; i < 2000; i++) vistos.add(d.gerarCodigo());
  assert.ok(vistos.size > 1990, 'códigos praticamente não se repetem no mesmo dia');
});

test('CPF', () => {
  assert.ok(d.cpfValido('529.982.247-25')); assert.ok(!d.cpfValido('529.982.247-24')); assert.ok(!d.cpfValido('111.111.111-11'));
  assert.equal(d.formatarCPF('52998224725'), '529.982.247-25');
  assert.throws(() => d.validarEstudante({ nome: 'Ana Souza', escola_id: 'x', cpf: '123' }), /CPF/);
});

test('painel junta agendamentos e atendimentos avulsos com busca, data, profissional e escola', () => {
  const t = h => d.instante('2026-11-03', h);
  const estudantes = [{ id: 'a', nome: 'Ana Barreto' }, { id: 'b', nome: 'Bruno Lima' }];
  const agendamentos = [
    { id: 'g1', estudante_id: 'a', escola_id: 'e1', profissional_uid: 'p1', inicio: t('10:00'), status: 'agendado', codigo: 'C261103-AAAA' },
    { id: 'g2', estudante_id: 'b', escola_id: 'e2', profissional_uid: 'p2', inicio: t('08:00'), status: 'cancelado' },
    { id: 'g3', estudante_id: 'b', escola_id: 'e2', profissional_uid: 'p2', inicio: t('09:00'), status: 'realizado', atendimento_id: 'x1' }];
  const atendimentos = [
    { id: 'x1', estudante_id: 'b', agendamento_id: 'g3', data: t('09:05') },
    { id: 'x2', estudante_id: 'a', agendamento_id: '', escola_id: 'e1', profissional_uid: 'p1', data: t('07:00'), codigo: 'C261103-BBBB' },
    { id: 'x3', estudante_id: 'a', agendamento_id: '', situacao: 'anulado', data: t('07:30') }];
  const ids = f => d.consultasDoPainel({ agendamentos, atendimentos, estudantes, filtros: f }).map(c => c.id);
  assert.deepEqual(ids({}), ['x2', 'g3', 'g1']);
  assert.deepEqual(ids({ mostrarCancelados: true }), ['x2', 'g2', 'g3', 'g1']);
  assert.deepEqual(ids({ busca: 'barreto' }), ['x2', 'g1']);
  assert.deepEqual(ids({ busca: 'c261103-bbbb' }), ['x2']);
  assert.deepEqual(ids({ profissional: 'p2' }), ['g3']);
  assert.deepEqual(ids({ escola: 'e1' }), ['x2', 'g1']);
  assert.deepEqual(ids({ dia: '2026-11-04' }), []);
});

test('importação v2: dados pessoais opcionais validados', () => {
  const base = { id: 'alu_' + 'b'.repeat(24), nome: 'Teste Ficticio', escola_id: 'monteiro-lobato', turma: '1º ano A', deficiencia: 'Autismo; TDAH', ano_letivo: 2026 };
  const [r] = d.conferirImportacaoAlunos({ esquema: 'seduc_alunos_especiais_v2', alunos: [{ ...base, nascimento: '2018-05-01', cpf: '529.982.247-25', mae: 'Mãe Teste', pai: '', telefone: '(33) 99999-0000', endereco: 'Rua A, 1', turno: 'integral', observacoes: 'Recursos: ledor.' }] });
  assert.equal(r.estudante.nascimento, '2018-05-01'); assert.equal(r.estudante.turno, 'integral');
  assert.equal(r.privado.cpf, '52998224725'); assert.equal(r.privado.mae, 'Mãe Teste'); assert.equal(r.necessidade, 'Autismo; TDAH'); assert.equal(r.observacoes, 'Recursos: ledor.');
  const [inval] = d.conferirImportacaoAlunos({ esquema: 'seduc_alunos_especiais_v2', alunos: [{ ...base, nascimento: '01/05/2018', cpf: '123' }] });
  assert.equal(inval.estudante.nascimento, ''); assert.equal(inval.privado, null);
});

test('importação reconhece escola cadastrada com outro identificador', () => {
  const escolas = [{ id: 'doutor-joao-souza-lima', nome: 'EM Doutor João de Souza Lima' }, { id: 'Xy7', nome: 'CRECHE SEBASTIANA DUARTE CABRAL' }];
  assert.equal(d.localizarEscola('creche-sebastiana-duarte-cabral', escolas).id, 'Xy7');
  assert.equal(d.localizarEscola('monteiro-lobato', escolas), null);
  const regs = [{ estudante: { escola_id: 'creche-sebastiana-duarte-cabral' } }, { estudante: { escola_id: 'monteiro-lobato' } }];
  const r = d.resolverEscolasImportacao(regs, escolas);
  assert.equal(r.registros[0].estudante.escola_id, 'Xy7'); assert.deepEqual(r.faltando, ['monteiro-lobato']);
});

test('calendário escolar: bloqueio da rede e da escola', () => {
  const bloqueios = [{ id: d.idBloqueio('2026-12-24'), motivo: 'Recesso' }, { id: d.idBloqueio('2026-11-20', 'monteiro-lobato'), motivo: 'Conselho de classe' }];
  assert.equal(d.bloqueioDoDia('2026-12-24', 'qualquer', bloqueios).motivo, 'Recesso');
  assert.equal(d.bloqueioDoDia('2026-11-20', 'monteiro-lobato', bloqueios).motivo, 'Conselho de classe');
  assert.equal(d.bloqueioDoDia('2026-11-20', 'outra', bloqueios), null);
  assert.equal(d.numeroDoDia('1970-01-02'), 1);
  assert.deepEqual(d.diasDoBloqueio({ de: '2026-12-30', ate: '2027-01-02', motivo: 'Férias' }), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.throws(() => d.diasDoBloqueio({ de: '2026-12-30', ate: '2026-12-01', motivo: 'x' }), /posterior/);
  const { slots } = d.prepararJornada([{ dia: 2, inicio: '08:00', fim: '09:00' }]);
  assert.throws(() => d.validarAgendamento({ inicio: d.instante('2026-11-24', '08:00'), duracao: 30, slots, agora: d.instante('2026-11-01', '00:00').getTime(), bloqueios: [{ id: d.idBloqueio('2026-11-24'), motivo: 'Feriado' }] }), /Feriado/);
});

test('orientação para a escola separada do registro clínico', () => {
  const r = d.validarRegistro({ objetivo: 'x'.repeat(4000), orientacao_escola: 'Sentar perto da professora.', tipo: 'observacao_sala', evolucao: 'estavel' });
  assert.equal(r.orientacao_escola, 'Sentar perto da professora.');
  assert.throws(() => d.validarRegistro({ objetivo: 'x', orientacao_escola: 'y'.repeat(2001), tipo: 'grupo', evolucao: 'estavel' }), /escola/);
});

test('calendário escolar em PDF (Frei Inocêncio 2026): leitura por cor confere com os dias letivos', async () => {
  const { interpretarCalendario, feriados } = await import('../js/calendario-pdf.js');
  const { readFileSync } = await import('node:fs');
  const { itens, rets } = JSON.parse(readFileSync(new URL('./fixtures/calendario-2026.json', import.meta.url), 'utf8'));
  const r = interpretarCalendario(itens, rets);
  assert.equal(r.ano, 2026); assert.equal(Object.keys(r.dias).length, 365);
  assert.ok(r.conferencia.every(c => c.ok)); assert.equal(r.conferencia.reduce((n, c) => n + c.lidos, 0), 200);
  assert.deepEqual(r.periodos.map(p => [p.de, p.ate]), [['2026-01-01', '2026-02-03'], ['2026-02-16', '2026-02-20'], ['2026-04-02', '2026-04-03'], ['2026-04-20', '2026-04-21'], ['2026-05-01', '2026-05-01'], ['2026-06-04', '2026-06-05'], ['2026-07-20', '2026-07-31'], ['2026-09-07', '2026-09-07'], ['2026-10-12', '2026-10-16'], ['2026-11-02', '2026-11-02'], ['2026-11-20', '2026-11-20'], ['2026-12-21', '2026-12-31']]);
  assert.equal(r.periodos[6].motivo, 'Recesso escolar de julho'); assert.match(r.periodos[1].motivo, /Carnaval/);
  assert.equal(r.periodos.reduce((n, p) => n + p.dias.length, 0), 63);
  assert.equal(feriados(2026)['2026-04-03'], 'Sexta-feira Santa'); assert.equal(feriados(2027)['2027-02-08'], 'Carnaval');
  assert.throws(() => interpretarCalendario([{ str: 'qualquer coisa', x: 0, y: 0, w: 1 }], []), /ano/);
});

test('feriados: Páscoa, datas móveis e só dias úteis', () => {
  assert.equal(d.pascoa(2026), '2026-04-05');
  assert.equal(d.pascoa(2027), '2027-03-28');
  const f = d.feriadosDoAno(2026), dias = f.map(x => x.dia);
  assert.ok(dias.includes('2026-02-16') && dias.includes('2026-02-17')); // carnaval
  assert.ok(dias.includes('2026-04-03')); // sexta-feira santa
  assert.ok(dias.includes('2026-06-04')); // corpus christi
  assert.ok(!dias.includes('2026-11-15')); // domingo: fora
  assert.ok(f.every(x => { const w = d.diaDaSemana(x.dia); return w >= 1 && w <= 5; }));
});

test('fila de espera: validação, ordem e indicadores', () => {
  assert.throws(() => d.validarPedido({ estudante_id: 'a', especialidade: 'x', motivo: 'dificuldade na leitura' }), /especialidade/);
  assert.throws(() => d.validarPedido({ estudante_id: 'a', especialidade: 'fonoaudiologia', motivo: 'curto' }), /10 caracteres/);
  const p = d.validarPedido({ estudante_id: 'a', especialidade: 'fonoaudiologia', motivo: '  Troca letras na escrita ', prioridade: 'x' });
  assert.equal(p.prioridade, 'normal'); assert.equal(p.motivo, 'Troca letras na escrita');
  const agora = d.instante('2026-11-20', '12:00').getTime(), em = dia => d.instante(dia, '10:00');
  const lista = [
    { id: '1', situacao: 'aguardando', prioridade: 'normal', especialidade: 'fonoaudiologia', escola_id: 'A', criado_em: em('2026-11-01') },
    { id: '2', situacao: 'aguardando', prioridade: 'alta', especialidade: 'fonoaudiologia', escola_id: 'B', criado_em: em('2026-11-15') },
    { id: '3', situacao: 'agendado', prioridade: 'normal', especialidade: 'psicopedagogia', escola_id: 'A', criado_em: em('2026-11-01'), atualizado_em: em('2026-11-11') },
    { id: '4', situacao: 'cancelado', prioridade: 'normal', especialidade: 'psicopedagogia', escola_id: 'A', criado_em: em('2026-11-01') }
  ];
  assert.deepEqual(d.ordenarFila(lista).map(x => x.id), ['2', '1']);
  const r = d.resumoFila(lista, agora);
  assert.equal(r.aguardando, 2); assert.equal(r.altas, 1); assert.equal(r.esperaMaxima, 19); assert.equal(r.esperaMedia, 12);
  assert.equal(r.tempoAteAgendar, 10); assert.equal(r.porEspecialidade.fonoaudiologia.aguardando, 2);
  assert.equal(r.porEscola.A.aguardando, 1);
});

test('frequência: jornada prevista desconta bloqueios e soma horas cumpridas', () => {
  const { jornada } = d.prepararJornada([{ dia: 1, inicio: '08:00', fim: '11:00', escola_id: 'A' }, { dia: 3, inicio: '13:00', fim: '17:00', escola_id: 'B' }]);
  const bloqueios = [{ id: d.idBloqueio('2026-11-04', 'B'), motivo: 'Reunião' }];
  const prev = d.jornadaPrevista({ jornada, de: '2026-11-01', ate: '2026-11-14', bloqueios });
  assert.deepEqual(prev.map(p => p.dia), ['2026-11-02', '2026-11-09', '2026-11-11']); // 04/11 bloqueado na escola B
  const reg = [
    { dia: '2026-11-02', situacao: 'presente', entrada: d.instante('2026-11-02', '08:00'), saida: d.instante('2026-11-02', '11:30') },
    { dia: '2026-11-09', situacao: 'atestado' }
  ];
  const r = d.resumoFrequencia({ registros: reg, jornada, de: '2026-11-01', ate: '2026-11-14', bloqueios, hoje: '2026-11-15' });
  assert.equal(r.diasPrevistos, 3); assert.equal(r.minutosPrevistos, 180 + 180 + 240); assert.equal(r.minutosCumpridos, 210);
  assert.equal(r.presencas, 1); assert.equal(r.justificadas, 1); assert.deepEqual(r.semRegistro, ['2026-11-11']);
  assert.equal(d.formatarHoras(210), '3h30'); assert.equal(d.formatarHoras(600), '10h');
});

test('plano de metas: validação, notas e séries', () => {
  assert.throws(() => d.validarMetas([{ texto: ' ' }]), /pelo menos uma/);
  const metas = d.validarMetas([{ id: 'm2', texto: 'Produzir /r/ em palavras' }, { texto: 'Ler sílabas simples', situacao: 'xx' }]);
  assert.deepEqual(metas.map(m => m.id), ['m2', 'm1']); assert.equal(metas[1].situacao, 'ativa');
  assert.deepEqual(d.validarNotasMetas({ meta_m2: '4', meta_m1: '9' }, metas), { m2: 4 });
  const ats = [{ id: 'b', data: d.instante('2026-11-10', '09:00') }, { id: 'a', data: d.instante('2026-11-03', '09:00') }, { id: 'c', situacao: 'anulado', data: d.instante('2026-11-11', '09:00') }];
  const regs = new Map([['a', { metas: { m2: 2 } }], ['b', { metas: { m2: 3, m1: 1 } }], ['c', { metas: { m2: 5 } }]]);
  const s = d.seriesDasMetas(metas, ats, regs);
  assert.deepEqual(s.m2.map(x => x.nota), [2, 3]); assert.deepEqual(s.m1.map(x => x.nota), [1]);
});

test('lembrete por WhatsApp não leva dado clínico', () => {
  assert.equal(d.numeroWhatsApp('(33) 99855-6503'), '5533998556503');
  assert.equal(d.numeroWhatsApp('+55 33 3333-4444'), '553333334444');
  assert.equal(d.numeroWhatsApp('9999'), '');
  const t = d.textoLembrete({ nome: 'Ana Clara Souza', inicio: d.instante('2026-11-05', '08:30'), escola: 'E.M. Monteiro Lobato' });
  assert.match(t, /Ana tem atendimento/); assert.match(t, /quinta, 05\/11, às 08:30/);
  assert.doesNotMatch(t, /Souza|Fono|Psico|Neuro/);
  assert.match(d.linkWhatsApp('33998556503', 'oi'), /^https:\/\/wa\.me\/5533998556503\?text=oi$/);
});

test('série mensal para o painel da Secretaria', () => {
  assert.deepEqual(d.ultimosMeses(3, '2026-01-15'), ['2025-11', '2025-12', '2026-01']);
  const s = d.serieMensal([
    { data: d.instante('2025-12-10', '09:00'), especialidade: 'fonoaudiologia', escola_id: 'A' },
    { data: d.instante('2026-01-02', '09:00'), especialidade: 'psicopedagogia', escola_id: 'A' },
    { data: d.instante('2026-01-03', '09:00'), especialidade: 'psicopedagogia', escola_id: 'B', situacao: 'anulado' }
  ], ['2025-12', '2026-01']);
  assert.equal(s[0].total, 1); assert.equal(s[1].porEspecialidade.psicopedagogia, 1); assert.equal(d.rotuloMes('2026-01'), 'jan/26');
});

test('cópia de segurança: criptografa e abre só com a senha certa', async () => {
  const b = await import('../js/backup.js');
  const env = await b.criptografar({ estudantes: [{ id: 'x', nome: 'Teste' }] }, 'senha-longa-de-teste', { colecoes: 1 });
  assert.equal(env.formato, 'seduc-backup-v1'); assert.doesNotMatch(JSON.stringify(env), /Teste/);
  assert.deepEqual(await b.abrir(env, 'senha-longa-de-teste'), { estudantes: [{ id: 'x', nome: 'Teste' }] });
  await assert.rejects(() => b.abrir(env, 'senha-errada-qualquer'), /Senha incorreta/);
  assert.throws(() => b.validarSenha('curta'), /12 caracteres/);
});
