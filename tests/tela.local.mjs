// Teste de interface no Chromium com o simulador em memória (sem rede, sem regras).
// Uso: node tests/tela.local.mjs [pasta-de-capturas]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const raiz = new URL('..', import.meta.url).pathname, saida = process.argv[2] || '/tmp/capturas';
await import('node:fs').then(fs => fs.mkdirSync(saida, { recursive: true }));
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const servidor = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  if (p === '/js/firebase.js') p = '/tests/simulador-firebase.js';
  try { res.writeHead(200, { 'content-type': tipos[extname(p)] || 'text/plain' }); res.end(await readFile(join(raiz, p))); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = 'http://127.0.0.1:' + servidor.address().port + '/';

// Dados fictícios
const FUSO = 3 * 3600e3, dia = 864e5;
const hojeMun = new Date(Date.now() - FUSO); const ymd = new Date(Date.UTC(hojeMun.getUTCFullYear(), hojeMun.getUTCMonth(), hojeMun.getUTCDate()));
const amanha = new Date(ymd.getTime() + dia), dowAmanha = amanha.getUTCDay();
const jornada = [{ dia: dowAmanha, inicio: '08:00', fim: '11:00', escola_id: 'monteiro-lobato' }];
const slots = []; for (let m = 8 * 60; m < 11 * 60; m += 30) slots.push(dowAmanha * 48 + m / 30);
const seed = {
  'usuarios/fono': { nome: 'Fernanda Fono', email: 'fono@x.br', perfil: 'especialista', ativo: true, especialidade: 'fonoaudiologia', registro_profissional: 'CRFa 6-12345', jornada, slots },
  'usuarios/psico': { nome: 'Paula Psicopedagoga', email: 'psico@x.br', perfil: 'especialista', ativo: true, especialidade: 'psicopedagogia', jornada: [], slots: [] },
  'usuarios/admin': { nome: 'Ítalo Admin', email: 'admin@x.br', perfil: 'superadmin', ativo: true },
  'usuarios/dir': { nome: 'Diretora Monteiro', email: 'dir@x.br', perfil: 'direcao', ativo: true, escolas: ['monteiro-lobato'] },
  'usuarios/pend': { nome: 'Nova Pessoa', email: 'nova@x.br', perfil: 'pendente', ativo: false },
  'usuarios/pend2': { nome: 'Desconhecido', email: 'desconhecido@x.br', perfil: 'pendente', ativo: false },
  'usuarios/antiga': { nome: 'Conta Antiga', email: 'antiga@x.br', perfil: 'especialista', ativo: true, especialidade: 'fonoaudiologia', vinculos_legados: ['v1'], termos_aceitos: true, criado_em: 1 },
  'agendamentos/agF': { estudante_id: 'a2', escola_id: 'prefeito-jose-pedro', profissional_uid: 'fono', profissional_nome: 'Fernanda Fono', especialidade: 'fonoaudiologia', inicio: amanha.getTime() + 8 * 3600e3 + FUSO, duracao_min: 30, status: 'agendado' },
  ['reservas/fono_' + (amanha.getTime() + 8 * 3600e3 + FUSO)]: { agendamento_id: 'agF', profissional_uid: 'fono' },
  'agendamentos/agP': { estudante_id: 'a2', escola_id: 'prefeito-jose-pedro', profissional_uid: 'fono', profissional_nome: 'Fernanda Fono', especialidade: 'fonoaudiologia', inicio: Math.floor((Date.now() - 2 * dia) / 18e5) * 18e5, duracao_min: 30, status: 'agendado' },
  'escolas/monteiro-lobato': { nome: 'Escola Municipal Monteiro Lobato', tipo: 'escola' },
  'escolas/prefeito-jose-pedro': { nome: 'Escola Municipal Prefeito José Pedro da Silva', tipo: 'escola' },
  'estudantes/a1': { nome: 'Ana Clara Souza', escola_id: 'monteiro-lobato', nascimento: '2018-04-10', turma: '2º ano A', turno: 'manha', situacao: 'ativo', criado_em: Date.now() - 40 * dia },
  'estudantes/a2': { nome: 'Bruno Henrique Lima', escola_id: 'prefeito-jose-pedro', nascimento: '2016-09-02', turma: '4º ano', situacao: 'ativo', criado_em: Date.now() - 20 * dia },
  'estudantes_privado/a1': { responsavel: 'Maria Souza', parentesco: 'Mãe', telefone: '(33) 99999-0000', motivo_encaminhamento: 'Troca de fonemas na leitura e escrita; dificuldade de atenção em sala.' },
  'estudantes_clinico/a1': { necessidade_informada: 'Hipótese de dislalia (avaliação externa pendente)', fonte: 'Relato da família' },
  'atendimentos/x1': { estudante_id: 'a1', escola_id: 'monteiro-lobato', profissional_uid: 'psico', profissional_nome: 'Paula Psicopedagoga', especialidade: 'psicopedagogia', tipo: 'avaliacao', evolucao: 'nao_avaliado', data: Date.now() - 10 * dia, duracao_min: 50, agendamento_id: '', situacao: 'valido', versao: 1 },
  'atendimentos_registro/x1': { estudante_id: 'a1', profissional_uid: 'psico', trabalhado: 'Avaliação psicopedagógica inicial: provas operatórias e leitura de palavras.', desenvolvido: 'Reconhece letras, lê sílabas simples com apoio.', orientacoes: 'Sugerida avaliação fonoaudiológica.', versao: 1 }
};

const navegador = await chromium.launch();
const erros = [];
async function sessao(uid) {
  const pg = await navegador.newPage({ viewport: { width: 1360, height: 900 } });
  pg.on('console', m => { if (m.type() === 'error') erros.push(uid + ': ' + m.text()); });
  pg.on('pageerror', e => erros.push(uid + ' pageerror: ' + e.message));
  pg.on('dialog', d => d.accept());
  await pg.addInitScript(([seed, uid, email]) => {
    if (!window.__banco) { window.__banco = new Map(Object.entries(JSON.parse(localStorage.getItem('banco') || 'null') || seed)); }
    window.__usuarioTeste = { uid, email, emailVerified: true, displayName: uid };
    addEventListener('beforeunload', () => localStorage.setItem('banco', JSON.stringify([...window.__banco])));
  }, [seed, uid, seed['usuarios/' + uid]?.email || uid + '@x.br']);
  await pg.goto(url);
  await pg.click('#entrar');
  return pg;
}
const foto = (pg, nome) => pg.screenshot({ path: join(saida, nome + '.png'), fullPage: true });

try {
  // ---- especialista ----
  const pg = await sessao('fono');
  await pg.waitForSelector('.saudacao'); await foto(pg, '01-painel-fono');
  assert.match(await pg.textContent('.saudacao'), /Fernanda/);
  // agendamento vencido sem registro aparece no painel e recebe falta
  assert.match(await pg.textContent('#conteudo'), /Agendamentos sem registro \(1\)/);
  await pg.click('[data-agendamento=agP]'); await pg.click('[data-ag=falta]');
  await pg.fill('[name=motivo]', 'Não compareceu; escola avisada.'); await pg.click('#modal [type=submit]');
  await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(200);
  assert.doesNotMatch(await pg.textContent('#conteudo'), /Agendamentos sem registro/);
  await pg.click('a[href="#/alunos"]'); await pg.waitForSelector('.aluno-item');
  assert.equal(await pg.locator('.aluno-item').count(), 2);
  await pg.fill('#filtros [name=busca]', 'bruno'); await pg.waitForTimeout(400);
  assert.equal(await pg.locator('.aluno-item').count(), 1);
  await pg.fill('#filtros [name=busca]', ''); await pg.waitForTimeout(400);
  await foto(pg, '02-alunos');
  await pg.click('.aluno-item >> text=Ana Clara'); await pg.waitForSelector('.linha-tempo');
  assert.match(await pg.textContent('.card-atendimento'), /provas operatórias/);
  await foto(pg, '03-prontuario');

  // registrar atendimento
  await pg.click('[data-acao=registrar]');
  await pg.fill('[name=trabalhado]', 'Treino de discriminação auditiva /p/ x /b/ com figuras e jogo de memória.');
  await pg.fill('[name=desenvolvido]', 'Acertou 7 de 10 pares; maior dificuldade em posição medial.');
  await pg.fill('[name=orientacoes]', 'Família: leitura compartilhada 10 min/dia. Escola: posicionar a aluna próximo à professora.');
  await pg.selectOption('[name=evolucao]', 'avancou');
  await foto(pg, '04-form-atendimento');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' });
  await pg.waitForSelector('.card-atendimento .secao >> text=discriminação auditiva');
  assert.equal(await pg.locator('.card-atendimento').count(), 2);
  await foto(pg, '05-prontuario-com-registro');

  // retificar
  await pg.click('[data-retificar]');
  await pg.fill('[name=desenvolvido]', 'Acertou 8 de 10 pares; maior dificuldade em posição medial.');
  await pg.fill('[name=motivo]', 'Correção da contagem.');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' });
  await pg.waitForSelector('text=retificado');
  await pg.click('[data-versoes]'); await pg.waitForSelector('.versao');
  assert.match(await pg.textContent('.versao'), /7 de 10/);
  await pg.click('#modal [data-fechar]');

  // filtro por especialidade
  await pg.click('[data-filtro-esp=psicopedagogia]'); await pg.waitForTimeout(150);
  assert.equal(await pg.locator('.card-atendimento').count(), 1);
  await pg.click('[data-filtro-esp=""]');

  // agendar
  await pg.click('[data-acao=agendar]'); await pg.waitForSelector('.horario');
  await foto(pg, '06-form-agendar');
  await pg.locator('.horario').nth(1).click();
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' });
  await pg.waitForSelector('.faixa-proximo');
  await pg.click('a[href="#/agenda"]'); await pg.waitForSelector('.semana');
  await pg.waitForSelector('.dia .linha-agenda.s-agendado');
  await foto(pg, '07-agenda');
  // cancelar
  const antesCancelar = await pg.locator('.dia .linha-agenda.s-agendado').count();
  await pg.locator('.dia .linha-agenda.s-agendado', { hasText: 'Ana Clara' }).click(); await pg.click('[data-ag=cancelar]');
  await pg.fill('[name=motivo]', 'Família pediu outro dia.'); await pg.click('#modal [type=submit]');
  await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(200);
  assert.equal(await pg.locator('.dia .linha-agenda.s-agendado').count(), antesCancelar - 1);

  // agendar → remarcar → registrar a partir do agendamento (fluxo completo)
  await pg.goto(url + '#/aluno/a1/agenda'); await pg.waitForSelector('[data-acao=agendar]');
  await pg.click('[data-acao=agendar]'); await pg.waitForSelector('.horario');
  await pg.locator('.horario').first().click(); await pg.click('#modal [type=submit]');
  await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForSelector('.lista-agenda .linha-agenda.s-agendado');
  await pg.click('.linha-agenda.s-agendado'); await pg.click('[data-ag=remarcar]'); await pg.waitForSelector('.horario');
  await pg.locator('.horario').nth(3).click(); await pg.fill('[name=motivo_remarcacao]', 'Família pediu mais tarde.');
  await foto(pg, '07b-remarcar');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(200);
  assert.equal(await pg.locator('.linha-agenda.s-agendado').count(), 1);
  assert.match(await pg.textContent('#conteudo'), /Remarcado para|Cancelado/);
  await pg.click('.linha-agenda.s-agendado'); await pg.click('[data-ag=registrar]');
  await pg.fill('[name=trabalhado]', 'Sessão agendada: leitura de pseudopalavras.');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(200);
  assert.equal(await pg.locator('.linha-agenda.s-agendado').count(), 0);
  assert.equal(await pg.locator('.linha-agenda.s-realizado').count(), 1);
  await pg.goto(url + '#/aluno/a1'); await pg.waitForSelector('.linha-tempo');
  assert.equal(await pg.locator('.card-atendimento').count(), 3);
  // anular registro feito por engano: some da lista, aparece riscado com "Mostrar anulados"
  await pg.locator('.card-atendimento', { hasText: 'pseudopalavras' }).evaluate(d => { d.open = true; });
  await pg.locator('.card-atendimento', { hasText: 'pseudopalavras' }).locator('[data-anular]').click();
  await pg.fill('[name=motivo]', 'Registrado no aluno errado.'); await pg.click('#modal [type=submit]');
  await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(200);
  assert.equal(await pg.locator('.card-atendimento').count(), 2);
  await pg.check('#mostrar-anulados'); await pg.waitForSelector('.card-atendimento.anulado');
  assert.match(await pg.textContent('.card-atendimento.anulado'), /Registrado no aluno errado/);
  await pg.uncheck('#mostrar-anulados');

  // relatório descritivo
  await pg.goto(url + '#/aluno/a1/relatorios'); await pg.waitForSelector('[data-acao=relatorio]');
  await pg.click('[data-acao=relatorio]'); await pg.click('#preencher');
  assert.match(await pg.inputValue('[name=texto]'), /discriminação auditiva/);
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' });
  await pg.waitForSelector('.card-atendimento >> text=Relatório de acompanhamento');
  await foto(pg, '08-relatorios-aluno');

  // cadastrar aluno
  await pg.click('a[href="#/alunos"]'); await pg.click('#novo');
  await pg.fill('[name=nome]', 'Carlos Eduardo Teste'); await pg.selectOption('[name=escola_id]', 'monteiro-lobato');
  await pg.fill('[name=motivo_encaminhamento]', 'Não consegue acompanhar a leitura.');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('.perfil-topo >> text=Carlos Eduardo');
  assert.match(await pg.textContent('.chips'), /Aguardando/);

  await pg.click('a[href="#/relatorios"]'); await pg.waitForSelector('.metricas');
  await foto(pg, '09-relatorios');
  await pg.close();

  // ---- direção: sem texto clínico ----
  const dir = await sessao('dir');
  await dir.waitForSelector('.saudacao');
  await dir.goto(url + '#/alunos'); await dir.waitForSelector('.aluno-item');
  const nomes = await dir.locator('.aluno-item strong').allTextContents();
  assert.ok(!nomes.includes('Bruno Henrique Lima'), 'direção não vê aluno de outra escola');
  await dir.goto(url + '#/aluno/a1'); await dir.waitForSelector('.linha-tempo');
  assert.doesNotMatch(await dir.textContent('#conteudo'), /provas operatórias/);
  assert.match(await dir.textContent('#conteudo'), /restrito à equipe/);
  await foto(dir, '10-prontuario-direcao');
  await dir.close();

  // ---- administração ----
  const adm = await sessao('admin');
  await adm.waitForSelector('.saudacao');
  await adm.goto(url + '#/equipe'); await adm.waitForSelector('.pessoa');
  await foto(adm, '11-equipe');
  await adm.click('[data-editar=pend]');
  await adm.selectOption('[name=especialidade]', 'neuropsicologia');
  await adm.click('#mais-faixa'); await adm.click('#mais-faixa');
  await adm.locator('.jornada-linha').nth(1).locator('[name=j_dia]').selectOption('3');
  await foto(adm, '12-editar-jornada');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached' });
  await adm.waitForSelector('text=Qua 08:00–11:00');
  // conta da versão antiga com campos extras pode ser editada
  await adm.click('[data-editar=antiga]'); await adm.fill('[name=nome]', 'Conta Antiga Editada');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached' });
  await adm.waitForSelector('text=Conta Antiga Editada');
  assert.equal(await adm.evaluate(() => 'vinculos_legados' in window.__banco.get('usuarios/antiga')), false);
  // recusar solicitação pendente: apaga
  await adm.click('[data-recusar=pend2]'); await adm.click('#modal [type=submit]');
  await adm.waitForSelector('#modal', { state: 'detached' }); await adm.waitForTimeout(200);
  assert.equal(await adm.evaluate(() => window.__banco.has('usuarios/pend2')), false);
  // excluir acesso (com agendamentos futuros cancelados) e restaurar
  await adm.click('[data-excluir=fono]'); await adm.waitForSelector('[name=cancelar]');
  assert.match(await adm.textContent('#modal'), /agendamento\(s\) futuro/);
  await adm.fill('[name=motivo]', 'Teste de exclusão'); await foto(adm, '12b-excluir-acesso');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached' });
  await adm.click('#ver-excluidos'); await adm.waitForSelector('[data-restaurar=fono]');
  const agendaFono = await adm.evaluate(() => [...window.__banco].filter(([k, v]) => k.startsWith('agendamentos/') && v.profissional_uid === 'fono' && v.status === 'agendado' && (v.inicio?._ms ?? v.inicio) > Date.now()).length);
  assert.equal(agendaFono, 0, 'agendamentos futuros cancelados');
  assert.equal(await adm.evaluate(() => [...window.__banco.keys()].some(k => k.startsWith('atendimentos/') )), true, 'atendimentos preservados');
  await adm.click('[data-restaurar=fono]'); await adm.waitForTimeout(300);
  assert.equal(await adm.evaluate(() => window.__banco.get('usuarios/fono').excluido), false);
  // excluir de novo e confirmar que a conta não entra mais
  await adm.click('[data-excluir=fono]'); await adm.fill('[name=motivo]', 'Fim do contrato'); await adm.click('#modal [type=submit]');
  await adm.waitForSelector('#modal', { state: 'detached' });
  await adm.evaluate(() => { window.__usuarioTeste = { uid: 'fono', email: 'fono@x.br', emailVerified: true }; });
  await adm.click('#sair'); await adm.click('#entrar'); await adm.waitForSelector('.alerta-caixa');
  assert.match(await adm.textContent('.alerta-caixa'), /desativado/);
  await adm.evaluate(() => { window.__usuarioTeste = { uid: 'admin', email: 'admin@x.br', emailVerified: true }; });
  await adm.click('#sair'); await adm.click('#entrar'); await adm.waitForSelector('.topo-usuario');
  await adm.goto(url + '#/escolas'); await adm.waitForSelector('#semear');
  await adm.click('#semear'); await adm.waitForSelector('text=Creche Sebastiana');
  await foto(adm, '13-escolas');
  await adm.setViewportSize({ width: 390, height: 844 });
  await adm.goto(url + '#/aluno/a1'); await adm.waitForSelector('.linha-tempo');
  await foto(adm, '14-celular-prontuario');
  await adm.close();

  assert.deepEqual(erros, []);
  console.log('OK: fluxo de interface completo.');
} catch (e) {
  console.error('FALHA:', e.message, (e.stack||'').split('\n').find(l=>l.includes('tela.local'))); console.error(erros.join('\n')); process.exitCode = 1;
} finally { await navegador.close(); servidor.close(); }
