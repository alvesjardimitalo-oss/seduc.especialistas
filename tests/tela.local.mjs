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
  await pg.waitForSelector('.dia .linha-agenda');
  await foto(pg, '07-agenda');
  // cancelar
  await pg.click('.dia .linha-agenda'); await pg.click('[data-ag=cancelar]');
  await pg.fill('[name=motivo]', 'Família pediu outro dia.'); await pg.click('#modal [type=submit]');
  await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(200);
  assert.equal(await pg.locator('.dia .linha-agenda').count(), 0);

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
  await adm.click('.destaque [data-editar]');
  await adm.selectOption('[name=especialidade]', 'neuropsicologia');
  await adm.click('#mais-faixa'); await adm.click('#mais-faixa');
  await adm.locator('.jornada-linha').nth(1).locator('[name=j_dia]').selectOption('3');
  await foto(adm, '12-editar-jornada');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached' });
  await adm.waitForSelector('text=Qua 08:00–11:00');
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
  console.error('FALHA:', e.message); console.error(erros.join('\n')); process.exitCode = 1;
} finally { await navegador.close(); servidor.close(); }
