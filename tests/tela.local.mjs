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
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png' };
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
  'usuarios/dir': { nome: 'Diretora Monteiro', email: 'dir@x.br', perfil: 'direcao', cargo: 'Vice-diretor(a)', ativo: true, escolas: ['monteiro-lobato'] },
  'relatorios/r1': { estudante_id: 'a1', escola_id: 'monteiro-lobato', profissional_uid: 'psico', profissional_nome: 'Paula Psicopedagoga', especialidade: 'psicopedagogia', tipo: 'devolutiva', titulo: 'Devolutiva à escola', destinatario: 'Direção', texto: 'Texto da devolutiva para a escola.', criado_em: Date.now() - 5 * dia },
  'usuarios/ped': { nome: 'Supervisora Monteiro', email: 'ped@x.br', perfil: 'pedagogico', ativo: true, escolas: ['monteiro-lobato'] },
  'usuarios/pend': { nome: 'Nova Pessoa', email: 'nova@x.br', perfil: 'pendente', ativo: false },
  'usuarios/pend2': { nome: 'Desconhecido', email: 'desconhecido@x.br', perfil: 'pendente', ativo: false },
  'usuarios/antiga': { nome: 'Conta Antiga', email: 'antiga@x.br', perfil: 'especialista', ativo: true, especialidade: 'fonoaudiologia', vinculos_legados: ['v1'], termos_aceitos: true, criado_em: 1 },
  'agendamentos/agF': { codigo: 'C000000-FUT1', estudante_id: 'a2', escola_id: 'prefeito-jose-pedro', profissional_uid: 'fono', profissional_nome: 'Fernanda Fono', especialidade: 'fonoaudiologia', inicio: amanha.getTime() + 8 * 3600e3 + FUSO, duracao_min: 30, status: 'agendado' },
  ['reservas/fono_' + (amanha.getTime() + 8 * 3600e3 + FUSO)]: { agendamento_id: 'agF', profissional_uid: 'fono' },
  'agendamentos/agH': { codigo: 'C000000-HOJE', estudante_id: 'a2', escola_id: 'prefeito-jose-pedro', profissional_uid: 'fono', profissional_nome: 'Fernanda Fono', especialidade: 'fonoaudiologia', inicio: Date.now() + 5 * 60000, duracao_min: 30, status: 'agendado' },
  'agendamentos/agP': { codigo: 'C000000-TEST', estudante_id: 'a2', escola_id: 'prefeito-jose-pedro', profissional_uid: 'fono', profissional_nome: 'Fernanda Fono', especialidade: 'fonoaudiologia', inicio: Math.floor((Date.now() - 2 * dia) / 18e5) * 18e5, duracao_min: 30, status: 'agendado' },
  'escolas/monteiro-lobato': { nome: 'Escola Municipal Monteiro Lobato', tipo: 'escola' },
  'escolas/prefeito-jose-pedro': { nome: 'Escola Municipal Prefeito José Pedro da Silva', tipo: 'escola' },
  'escolas/doutor-joao-souza-lima': { nome: 'Escola Municipal Doutor João de Souza Lima', tipo: 'escola' },
  'escolas/creche-sebastiana-duarte-cabral': { nome: 'Creche Sebastiana Duarte Cabral', tipo: 'creche' },
  'escolas/professora-terezinha-sarmento': { nome: 'Escola Municipal Professora Terezinha Sarmento de Oliveira', tipo: 'escola' },
  'estudantes/a1': { nome: 'Ana Clara Souza', escola_id: 'monteiro-lobato', nascimento: '2018-04-10', turma: '2º ano A', turno: 'manha', situacao: 'ativo', criado_em: Date.now() - 40 * dia },
  'estudantes/a2': { nome: 'Bruno Henrique Lima', escola_id: 'prefeito-jose-pedro', nascimento: '2016-09-02', turma: '4º ano', situacao: 'ativo', criado_em: Date.now() - 20 * dia },
  'estudantes_privado/a1': { responsavel: 'Maria Souza', parentesco: 'Mãe', telefone: '(33) 99999-0000', motivo_encaminhamento: 'Troca de fonemas na leitura e escrita; dificuldade de atenção em sala.' },
  'estudantes_clinico/a1': { necessidade_informada: 'Hipótese de dislalia (avaliação externa pendente)', fonte: 'Relato da família' },
  'atendimentos/x1': { estudante_id: 'a1', escola_id: 'monteiro-lobato', profissional_uid: 'psico', profissional_nome: 'Paula Psicopedagoga', especialidade: 'psicopedagogia', tipo: 'avaliacao', evolucao: 'nao_avaliado', data: Date.now() - 10 * dia, duracao_min: 50, agendamento_id: '', situacao: 'valido', versao: 1, orientacao_escola: 'Usar letra bastão e dar comandos curtos.' },
  'atendimentos_registro/x1': { estudante_id: 'a1', profissional_uid: 'psico', trabalhado: 'Avaliação psicopedagógica inicial: provas operatórias e leitura de palavras.', desenvolvido: 'Reconhece letras, lê sílabas simples com apoio.', orientacoes: 'Sugerida avaliação fonoaudiológica.', versao: 1 }
};

const navegador = await chromium.launch();
const erros = [];
async function sessao(uid, { senha = false, instituicao = '' } = {}) {
  const pg = await navegador.newPage({ viewport: { width: 1360, height: 900 } });
  pg.on('console', m => { if (m.type() === 'error' && !/500 caracteres no total|já está na fila|Nenhum feriado novo/.test(m.text())) erros.push(uid + ': ' + m.text()); });
  pg.on('pageerror', e => erros.push(uid + ' pageerror: ' + e.message));
  pg.on('dialog', d => d.accept());
  await pg.addInitScript(([seed, uid, email]) => {
    if (!window.__banco) { window.__banco = new Map(Object.entries(JSON.parse(localStorage.getItem('banco') || 'null') || seed)); }
    window.__usuarioTeste = { uid, email, emailVerified: true, displayName: uid };
    addEventListener('beforeunload', () => localStorage.setItem('banco', JSON.stringify([...window.__banco])));
  }, [seed, uid, seed['usuarios/' + uid]?.email || uid + '@x.br']);
  await pg.goto(url);
  if (senha) { await pg.fill('[name=email]', uid + '@x.br'); await pg.fill('[name=senha]', 'senha-teste'); await pg.click('#entrar-senha'); }
  else await pg.click('#entrar');
  // termo de LGPD e escolha da instituição (quando aparecem)
  await pg.waitForSelector('#aceitar, .lista-inst, .topo-usuario');
  if (await pg.$('#aceitar')) { if (uid === 'fono') await foto(pg, '00a-termo-lgpd'); await pg.click('#aceitar'); await pg.waitForSelector('.lista-inst, .topo-usuario'); }
  if (await pg.$('.lista-inst')) { if (uid === 'fono') await foto(pg, '00b-instituicao'); await pg.click('[data-inst="' + instituicao + '"]'); }
  await pg.waitForSelector('.topo-usuario');
  return pg;
}
const foto = (pg, nome) => pg.screenshot({ path: join(saida, nome + '.png'), fullPage: true });

try {
  // ---- especialista ----
  const pg0 = await navegador.newPage({ viewport: { width: 1360, height: 900 } });
  await pg0.goto(url); await pg0.waitForSelector('#form-login'); await foto(pg0, '00-login'); await pg0.close();
  const pg = await sessao('fono', { senha: true });
  await pg.waitForSelector('#busca'); await foto(pg, '01-painel-fono');
  assert.match(await pg.textContent('.painel-topo'), /Fernanda/);
  // lista de atendimento do dia: "Chegou" e "Atender"
  await pg.click('[data-chegou=agH]'); await pg.waitForSelector('.item-fila.chegou');
  assert.match(await pg.textContent('.item-fila.chegou'), /1º[\s\S]*Chegou às \d\d:\d\d/);
  await foto(pg, '01a-lista-do-dia');
  await pg.click('[data-atender=agH]'); await pg.waitForSelector('#modal [name=objetivo]');
  assert.match(await pg.textContent('#modal'), /S — Subjetivo[\s\S]*O — Objetivo[\s\S]*A — Avaliação[\s\S]*P — Plano/);
  await pg.locator('#modal [data-fechar]').first().click(); await pg.waitForSelector('#modal', { state: 'detached' });
  // consulta vencida sem registro: "O aluno compareceu?" → Não → falta e reagendar
  assert.match(await pg.textContent('#conteudo'), /1 consulta\(s\) sem registro/);
  await pg.click('.alerta-caixa [data-consulta=agP]'); await pg.waitForSelector('.pergunta-presenca');
  assert.match(await pg.textContent('.codigo'), /C\d{6}-TEST/);
  await foto(pg, '01b-consulta-ampliada');
  await pg.click('[data-c=nao]');
  await pg.fill('[name=motivo]', 'Não compareceu; escola avisada.'); await pg.click('#modal [type=submit]');
  await pg.waitForSelector('#modal .horario'); // abriu o reagendamento
  await pg.locator('.horario').nth(2).click(); await pg.click('#modal [type=submit]');
  await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(300);
  assert.doesNotMatch(await pg.textContent('#conteudo'), /sem registro/);
  // busca no painel por nome e por código, filtro de data
  await pg.fill('#busca [name=dia]', ''); await pg.fill('#busca [name=busca]', 'bruno'); await pg.waitForTimeout(500);
  const linhasBruno = await pg.locator('#conteudo .linha-agenda').count();
  assert.ok(linhasBruno >= 1);
  assert.ok((await pg.locator('#conteudo .linha-agenda', { hasText: 'Ana Clara' }).count()) === 0);
  const codigo = (await pg.locator('#conteudo .linha-agenda.s-agendado .quem small').first().textContent()).match(/C\d{6}-[A-Z0-9]{4}/)[0];
  await pg.fill('#busca [name=busca]', codigo.toLowerCase()); await pg.waitForTimeout(500);
  assert.equal(await pg.locator('#conteudo .linha-agenda').count(), 1);
  await foto(pg, '01c-painel-busca');
  // abre a consulta reagendada e responde "Sim" (registro antes do horário)
  await pg.click('#conteudo .linha-agenda'); await pg.click('[data-c=sim]'); await pg.waitForSelector('#modal [name=objetivo]');
  assert.match(await pg.textContent('#modal-titulo'), new RegExp(codigo));
  await pg.fill('[name=objetivo]', 'x'.repeat(480)); await pg.fill('[name=avaliacao]', 'y'.repeat(30));
  assert.match(await pg.textContent('.contador-total'), /510\/500/);
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('.form-erro:not([hidden])');
  assert.match(await pg.textContent('.form-erro'), /500/);
  await pg.fill('[name=objetivo]', 'Leitura de sílabas complexas com apoio visual.'); await pg.fill('[name=avaliacao]', 'Leu 6 de 10.');
  await pg.fill('[name=orientacao_escola]', 'Ler junto com o aluno, apontando as sílabas.'); await pg.selectOption('[name=tipo]', 'observacao_sala');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(300);
  await pg.click('#conteudo .linha-agenda'); await pg.waitForSelector('.registro-consulta');
  assert.match(await pg.textContent('.registro-consulta'), /sílabas complexas/);
  assert.match(await pg.textContent('#modal .orientacao-escola'), /apontando as sílabas/);
  assert.match(await pg.textContent('.registro-consulta'), /Observação em sala/);
  await pg.click('#modal [data-fechar]');
  await pg.fill('#busca [name=busca]', ''); await pg.waitForTimeout(400);
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
  await pg.fill('[name=objetivo]', 'Treino de discriminação auditiva /p/ x /b/ com figuras e jogo de memória.');
  await pg.fill('[name=avaliacao]', 'Acertou 7 de 10 pares; maior dificuldade em posição medial.');
  await pg.fill('[name=plano]', 'Família: leitura compartilhada 10 min/dia. Escola: posicionar a aluna próximo à professora.');
  await pg.selectOption('[name=evolucao]', 'avancou');
  await foto(pg, '04-form-atendimento');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' });
  await pg.waitForSelector('.card-atendimento .secao >> text=discriminação auditiva');
  assert.equal(await pg.locator('.card-atendimento').count(), 2);
  await foto(pg, '05-prontuario-com-registro');

  // retificar
  await pg.click('[data-retificar]');
  await pg.fill('[name=avaliacao]', 'Acertou 8 de 10 pares; maior dificuldade em posição medial.');
  await pg.fill('[name=motivo]', 'Correção da contagem.');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' });
  await pg.waitForSelector('text=editada');
  await pg.click('[data-versoes]'); await pg.waitForSelector('.versao');
  assert.match(await pg.textContent('.versao'), /7 de 10/);
  await pg.click('#modal [data-fechar]');

  // folha de rosto: problemas e condições
  assert.match(await pg.textContent('.folha-rosto'), /Informado pela escola:[\s\S]*dislalia/i);
  assert.match(await pg.textContent('.folha-rosto'), /Paula Psicopedagoga[\s\S]*Plano:[\s\S]*avaliação fonoaudiológica/);
  await pg.click('[data-acao=nova-condicao]'); await pg.fill('#modal [name=descricao]', 'Troca de fonemas /p/ e /b/');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('.cond-ativo');
  assert.match(await pg.textContent('.cond-ativo'), /Troca de fonemas[\s\S]*Fonoaudiologia/);
  await foto(pg, '05b-folha-de-rosto');
  await pg.click('[data-condicao][data-para=resolvido]'); await pg.fill('#modal [name=observacao]', 'Objetivo atingido.');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('.resolvidos');
  assert.equal(await pg.locator('.lista-cond > .cond-ativo').count(), 0);
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
  await pg.locator('.dia .linha-agenda.s-agendado', { hasText: 'Ana Clara' }).click(); await pg.click('[data-c=cancelar]');
  await pg.fill('[name=motivo]', 'Família pediu outro dia.'); await pg.click('#modal [type=submit]');
  await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(200);
  assert.equal(await pg.locator('.dia .linha-agenda.s-agendado').count(), antesCancelar - 1);

  // agendar → remarcar → registrar a partir do agendamento (fluxo completo)
  await pg.goto(url + '#/aluno/a1/agenda'); await pg.waitForSelector('[data-acao=agendar]');
  await pg.click('[data-acao=agendar]'); await pg.waitForSelector('.horario');
  await pg.locator('.horario').first().click(); await pg.click('#modal [type=submit]');
  await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForSelector('.lista-agenda .linha-agenda.s-agendado');
  await pg.click('.linha-agenda.s-agendado'); await pg.click('[data-c=reagendar]'); await pg.waitForSelector('.horario');
  await pg.locator('.horario').last().click(); await pg.fill('[name=motivo_remarcacao]', 'Família pediu mais tarde.');
  await foto(pg, '07b-remarcar');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' }); await pg.waitForTimeout(200);
  assert.equal(await pg.locator('.linha-agenda.s-agendado').count(), 1);
  assert.match(await pg.textContent('#conteudo'), /Remarcado para|Cancelado/);
  await pg.click('.linha-agenda.s-agendado'); await pg.click('[data-c=sim]');
  await pg.fill('[name=objetivo]', 'Sessão agendada: leitura de pseudopalavras.');
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

  // plano de acompanhamento: metas e marcação na consulta → gráfico
  await pg.goto(url + '#/aluno/a1'); await pg.waitForSelector('.plano');
  await pg.click('[data-acao=plano]'); await pg.fill('#modal [name=texto_0]', 'Discriminar /p/ e /b/ em pares de palavras'); await pg.fill('#modal [name=texto_1]', 'Ler sílabas complexas com autonomia');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('.plano-esp');
  assert.equal(await pg.locator('.plano-esp .meta').count(), 2);
  await pg.click('[data-acao=registrar]'); await pg.waitForSelector('#modal .metas-consulta');
  await pg.fill('[name=objetivo]', 'Pares mínimos com figuras e ditado de sílabas.');
  await pg.click('.escala label:has(input[name=meta_m1][value="3"])'); await pg.click('.escala label:has(input[name=meta_m2][value="2"])');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' });
  await pg.waitForSelector('.grafico-meta .rotulo');
  assert.deepEqual(await pg.locator('.grafico-meta .rotulo').allTextContents(), ['3/5', '2/5']);
  await foto(pg, '15-plano-metas');

  // sem internet: o registro fica guardado e é enviado depois
  await pg.context().setOffline(true);
  await pg.click('[data-acao=registrar]'); await pg.waitForSelector('#modal [name=objetivo]');
  await pg.fill('[name=objetivo]', 'Registro feito sem internet na escola.');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('.toast >> text=Sem internet');
  await pg.context().setOffline(false); await pg.waitForTimeout(300);
  assert.equal(await pg.evaluate(() => [...window.__banco.values()].filter(v => v.objetivo === 'Registro feito sem internet na escola.').length), 1);

  // frequência: entrada e saída
  await pg.goto(url + '#/frequencia'); await pg.waitForSelector('#form-entrada');
  await pg.click('#form-entrada [type=submit]'); await pg.waitForSelector('#saida');
  await pg.click('#saida'); await pg.waitForSelector('.cartao-ponto.concluido');
  await foto(pg, '16-frequencia-especialista');
  await pg.click('#ausencia'); await pg.fill('#modal [name=dia]', amanha.toISOString().slice(0, 10)); await pg.fill('#modal [name=justificativa]', 'Curso de formação');
  await pg.click('#modal [type=submit]'); await pg.waitForSelector('#modal', { state: 'detached' });

  // lembrete pelo WhatsApp (sem dado clínico)
  await pg.goto(url + '#/painel'); await pg.waitForSelector('[data-lembrete]');
  await pg.evaluate(() => { window.open = u => { window.__aberto = u; return null; }; });
  await pg.locator('[data-lembrete]').first().click(); await pg.waitForSelector('#modal [name=telefone]');
  const textoLembrete = await pg.inputValue('#modal [name=texto]');
  assert.match(textoLembrete, /Bruno tem atendimento/); assert.doesNotMatch(textoLembrete, /Fono|Henrique|Lima/);
  await pg.fill('#modal [name=telefone]', '(33) 99999-1234'); await pg.click('#modal [type=submit]');
  assert.match(await pg.evaluate(() => window.__aberto), /^https:\/\/wa\.me\/5533999991234\?text=Ol/);

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
  await dir.goto(url + '#/alunos'); await dir.waitForSelector('.aluno-item');
  const nomes = await dir.locator('.aluno-item strong').allTextContents();
  assert.ok(!nomes.includes('Bruno Henrique Lima'), 'direção não vê aluno de outra escola');
  await dir.goto(url + '#/aluno/a1'); await dir.waitForSelector('.linha-tempo');
  assert.doesNotMatch(await dir.textContent('#conteudo'), /provas operatórias/);
  assert.match(await dir.textContent('#conteudo'), /restrito à equipe/);
  await dir.locator('.card-atendimento summary').first().click();
  assert.match(await dir.textContent('.card-atendimento .orientacao-escola'), /letra bastão/);
  await dir.click('[data-acao=ficha-escola]'); assert.doesNotMatch(await dir.textContent('#modal'), /Incluir a condição/); await dir.click('#modal [data-fechar]');
  await dir.goto(url + '#/painel'); await dir.waitForSelector('#busca');
  assert.match(await dir.textContent('#conteudo'), /Orientações recentes para a escola[\s\S]*letra bastão/);
  await foto(dir, '10-prontuario-direcao');
  // direção (vice-diretora) imprime documento emitido: rodapé com nome, cargo e registro da impressão
  await dir.goto(url + '#/aluno/a1/relatorios'); await dir.waitForSelector('[data-imprimir-rel=r1]', { state: 'attached' });
  await dir.evaluate(() => { window.open = () => ({ document: { write: h => { window.__impresso = h; }, close() {} } }); });
  await dir.locator('.card-atendimento summary').first().click(); await dir.click('[data-imprimir-rel=r1]');
  const impresso = await dir.evaluate(() => window.__impresso);
  assert.match(impresso, /Impresso por:<\/b> Diretora Monteiro — Vice-diretor\(a\)/); assert.match(impresso, /Registro de impressão:<\/b> [A-Z0-9]{6,}/);
  await dir.waitForFunction(() => [...window.__banco].some(([k, v]) => k.startsWith('acessos/') && v.acao === 'relatorio' && v.cargo === 'Vice-diretor(a)' && v.documento === 'r1'));
  assert.match(await dir.textContent('.topo-usuario'), /Vice-diretor/);
  // fila de espera: a direção pede atendimento
  await dir.goto(url + '#/fila'); await dir.waitForSelector('#novo-pedido'); await dir.click('#novo-pedido');
  await dir.selectOption('#modal [data-lista-aluno]', 'a1'); await dir.selectOption('#modal [name=especialidade]', 'fonoaudiologia');
  await dir.fill('#modal [name=motivo]', 'Troca letras na escrita e não acompanha a leitura da turma.');
  await dir.click('#modal [type=submit]'); await dir.waitForSelector('.pedido');
  await dir.click('#novo-pedido'); await dir.selectOption('#modal [data-lista-aluno]', 'a1'); await dir.selectOption('#modal [name=especialidade]', 'fonoaudiologia');
  await dir.fill('#modal [name=motivo]', 'Pedido repetido para o mesmo aluno.'); await dir.click('#modal [type=submit]');
  await dir.waitForSelector('#modal .form-erro:not([hidden])'); assert.match(await dir.textContent('#modal .form-erro'), /já está na fila/);
  await dir.click('#modal [data-fechar]');
  await foto(dir, '17-fila-de-espera');
  await dir.goto(url + '#/aluno/a1'); await dir.waitForSelector('.faixa-fila');
  // direção cria o acesso da equipe pedagógica (e-mail para criar a senha)
  await dir.goto(url + '#/equipe'); await dir.waitForSelector('#novo-pedagogico'); await dir.click('#novo-pedagogico');
  await dir.fill('#modal [name=nome]', 'Coordenadora Pedagógica'); await dir.fill('#modal [name=email]', 'Coord@x.br'); await dir.selectOption('#modal [name=cargo]', 'Coordenador(a) pedagógico(a)');
  await dir.click('#modal [type=submit]'); await dir.waitForSelector('.pessoa >> text=Coordenadora Pedagógica');
  assert.deepEqual(await dir.evaluate(() => window.__emails), ['coord@x.br']);
  assert.deepEqual(await dir.evaluate(() => { const u = window.__banco.get('usuarios/novo_coord'); return [u.perfil, u.escolas]; }), ['pedagogico', ['monteiro-lobato']]);
  await foto(dir, '21-direcao-equipe-pedagogica');
  await dir.close();

  // ---- equipe pedagógica: aluno novo direto do pedido de atendimento ----
  const ped = await sessao('ped');
  await ped.goto(url + '#/fila'); await ped.waitForSelector('#novo-pedido'); await ped.click('#novo-pedido');
  await ped.selectOption('#modal [name=especialidade]', 'psicopedagogia');
  await ped.fill('#modal [name=motivo]', 'Não reconhece as letras do próprio nome.');
  await ped.click('#cadastrar-do-pedido'); await ped.waitForSelector('#modal [name=nome]');
  await ped.fill('#modal [name=nome]', 'Joana Nova Aluna'); await ped.click('#modal [type=submit]');
  await ped.waitForSelector('#modal .aluno-fixo >> text=Joana Nova Aluna');
  assert.equal(await ped.inputValue('#modal [name=motivo]'), 'Não reconhece as letras do próprio nome.');
  await ped.click('#modal [type=submit]'); await ped.waitForSelector('.pedido >> text=Joana Nova Aluna');
  assert.equal(await ped.locator('[data-agendar]').count(), 0, 'equipe pedagógica não agenda');
  assert.ok(!(await ped.locator('nav a').allTextContents()).includes('Frequência'));
  await foto(ped, '20-equipe-pedagogica-fila');
  await ped.close();

  // ---- administração ----
  const adm = await sessao('admin');
  // fila: agenda o pedido da escola
  await adm.goto(url + '#/aluno/a2'); await adm.waitForSelector('.linha-tempo');
  await adm.goto(url + '#/fila'); await adm.waitForSelector('#novo-pedido'); await adm.click('#novo-pedido');
  await adm.selectOption('#modal [data-lista-aluno]', 'a1'); await adm.selectOption('#modal [name=especialidade]', 'fonoaudiologia'); await adm.selectOption('#modal [name=prioridade]', 'alta');
  await adm.fill('#modal [name=motivo]', 'Troca letras na escrita e não acompanha a leitura da turma.'); await adm.click('#modal [type=submit]');
  await adm.waitForSelector('[data-agendar]', { timeout: 8000 }).catch(async () => { await foto(adm, 'erro-fila'); throw Error('fila admin: ' + (await adm.$('#modal') ? await adm.textContent('#modal .form-erro') : await adm.textContent('#conteudo')).slice(0, 400)); });
  await adm.click('[data-agendar]');
  await adm.selectOption('#modal [name=profissional_uid]', 'fono'); await adm.waitForSelector('#modal .horario');
  await adm.locator('#modal .horario').first().click(); await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached' });
  await adm.waitForFunction(() => [...window.__banco].some(([k, v]) => k.startsWith('pedidos/') && v.situacao === 'agendado' && v.agendamento_id));
  // segurança: quem acessou e cópia criptografada
  await adm.goto(url + '#/seguranca'); await adm.waitForSelector('#form-backup');
  assert.match(await adm.textContent('#conteudo'), /Ítalo Admin[\s\S]*Abriu o prontuário/);
  await adm.fill('#form-backup [name=senha]', 'senha-de-teste-123'); await adm.fill('#form-backup [name=senha2]', 'senha-de-teste-123');
  const [download] = await Promise.all([adm.waitForEvent('download'), adm.click('#form-backup [type=submit]')]);
  const caminhoCopia = join(saida, 'copia-teste.json'); await download.saveAs(caminhoCopia);
  const copia = JSON.parse(await readFile(caminhoCopia, 'utf8'));
  assert.equal(copia.formato, 'seduc-backup-v1'); assert.doesNotMatch(JSON.stringify(copia), /Ana Clara/);
  await adm.click('.anteriores summary'); await adm.setInputFiles('#form-conferir [name=arquivo]', caminhoCopia);
  await adm.fill('#form-conferir [name=senha]', 'senha-de-teste-123'); await adm.click('#form-conferir [type=submit]');
  await adm.waitForSelector('[data-conferencia] .alerta-caixa.ok');
  await foto(adm, '18-seguranca');
  // frequência da equipe
  await adm.goto(url + '#/frequencia'); await adm.waitForSelector('#mes');
  assert.match(await adm.textContent('#conteudo'), /Fernanda Fono/);
  await foto(adm, '19-frequencia-equipe');
  // novo acesso com login e senha
  await adm.goto(url + '#/equipe'); await adm.waitForSelector('.pessoa'); await adm.waitForTimeout(300); await adm.click('#convidar'); await adm.waitForSelector('#modal [name=email]');
  await adm.fill('#modal [name=nome]', 'Carla Psicopedagoga'); await adm.fill('#modal [name=email]', 'carla@x.br');
  await adm.selectOption('#modal [name=especialidade]', 'psicopedagogia');
  await adm.check('#modal [name=escolas][value=monteiro-lobato]');
  await foto(adm, '11a-novo-acesso');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached', timeout: 8000 }).catch(async e => { throw Error('novo acesso: ' + await adm.textContent('#modal .form-erro')); });
  await adm.waitForSelector('text=Carla Psicopedagoga');
  assert.deepEqual(await adm.evaluate(() => window.__emails), ['carla@x.br']);
  assert.deepEqual(await adm.evaluate(() => window.__banco.get('usuarios/novo_carla').escolas), ['monteiro-lobato']);
  // administração troca o e-mail de login de conta sem registros
  await adm.click('[data-trocar-email=novo_carla]'); await adm.waitForSelector('#modal [name=email]');
  await adm.fill('#modal [name=email]', 'Carla.Certo@x.br');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached', timeout: 8000 }).catch(async () => { throw Error('trocar e-mail: ' + await adm.textContent('#modal .form-erro')); });
  assert.deepEqual(await adm.evaluate(() => window.__emails), ['carla@x.br', 'carla.certo@x.br']);
  assert.equal(await adm.evaluate(() => window.__banco.has('usuarios/novo_carla')), false);
  assert.deepEqual(await adm.evaluate(() => { const u = window.__banco.get('usuarios/novo_carlacerto'); return [u.email, u.especialidade, u.escolas]; }), ['carla.certo@x.br', 'psicopedagogia', ['monteiro-lobato']]);
  // conta com registros: orienta a troca pela própria profissional
  await adm.waitForSelector('[data-trocar-email=fono]'); await adm.click('[data-trocar-email=fono]'); await adm.waitForSelector('#modal');
  assert.match(await adm.textContent('#modal'), /Minha conta/); await adm.click('#modal [data-fechar]');
  // "Minha conta": troca do próprio e-mail
  await adm.click('#minha-conta'); await adm.waitForSelector('#modal [name=email]');
  await adm.fill('#modal [name=email]', 'admin.novo@x.br'); if (await adm.$('#modal [name=senha]')) await adm.fill('#modal [name=senha]', 'x');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached' });
  assert.deepEqual(await adm.evaluate(() => window.__trocasEmail), ['admin.novo@x.br']);
  await adm.goto(url + '#/painel'); await adm.waitForSelector('#busca');
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
  // conta de teste: excluir e apagar definitivamente (sem registros)
  await adm.click('[data-excluir=antiga]'); await adm.fill('#modal [name=motivo]', 'Conta de teste'); await adm.click('#modal [type=submit]');
  await adm.waitForSelector('#modal', { state: 'detached' }); if ((await adm.textContent('#ver-excluidos')).includes('Mostrar')) await adm.click('#ver-excluidos'); await adm.click('[data-apagar=antiga]');
  await adm.waitForSelector('#modal-titulo >> text=Apagar definitivamente'); await adm.click('#modal [type=submit]');
  await adm.waitForSelector('#modal', { state: 'detached' }); await adm.waitForTimeout(200);
  assert.equal(await adm.evaluate(() => window.__banco.has('usuarios/antiga')), false);
  // recusar solicitação pendente: apaga
  await adm.click('[data-recusar=pend2]'); await adm.click('#modal [type=submit]');
  await adm.waitForSelector('#modal', { state: 'detached' }); await adm.waitForTimeout(200);
  assert.equal(await adm.evaluate(() => window.__banco.has('usuarios/pend2')), false);
  // calendário escolar: bloquear amanhã para a rede toda
  await adm.goto(url + '#/agenda'); await adm.click('#calendario');
  const amanhaTxt = new Date(amanha.getTime()).toISOString().slice(0, 10);
  await adm.fill('#modal [name=de]', amanhaTxt); await adm.fill('#modal [name=ate]', amanhaTxt); await adm.fill('#modal [name=motivo]', 'Conselho de classe');
  await foto(adm, '13c-calendario');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached', timeout: 8000 }).catch(async () => { throw Error('calendário: ' + await adm.textContent('#modal .form-erro')); });
  assert.equal(await adm.evaluate(() => [...window.__banco.keys()].filter(k => k.startsWith('bloqueios/')).length), 1);
  await adm.goto(url + '#/agenda'); await adm.waitForSelector('.semana');
  await adm.selectOption('#prof', 'fono'); await adm.waitForTimeout(300);
  if (await adm.$('.faixa-bloqueio') === null) { await adm.click('#prox'); await adm.waitForSelector('.semana'); }
  assert.match(await adm.textContent('.faixa-bloqueio'), /Conselho de classe/);
  // calendário do ano letivo a partir do PDF emitido pelo sistema da escola
  await adm.click('#calendario'); await adm.click('#importar-pdf');
  await adm.setInputFiles('#modal [name=pdf]', new URL('./fixtures/calendario-2026.pdf', import.meta.url).pathname);
  await adm.waitForSelector('#modal .conferencia', { timeout: 30000 });
  assert.match(await adm.textContent('#modal .alerta-caixa'), /200 dias letivos lidos[\s\S]*Conferido/);
  assert.equal(await adm.locator('#modal [data-incluir]').count(), 12);
  await adm.fill('#modal [data-motivo="8"]', 'Semana do Professor');
  await foto(adm, '13d-calendario-pdf');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached', timeout: 30000 });
  const nBloq = await adm.evaluate(() => [...window.__banco.keys()].filter(k => k.startsWith('bloqueios/')).length);
  assert.equal(nBloq, 1 + 63);
  assert.equal(await adm.evaluate(() => [...window.__banco.values()].filter(v => v.motivo === 'Semana do Professor').length), 5);
  // feriados nacionais
  await adm.click('#calendario'); await adm.click('#feriados'); await adm.waitForSelector('[data-feriados] table');
  await foto(adm, '13e-feriados');
  await adm.click('#modal [type=submit]');
  await Promise.race([adm.waitForSelector('#modal', { state: 'detached' }), adm.waitForSelector('#modal .form-erro:not([hidden])')]);
  if (await adm.$('#modal')) await adm.click('#modal [data-fechar]');
  await adm.click('#agendar'); await adm.selectOption('#modal [name=profissional_uid]', 'fono'); await adm.fill('#modal [name=dia]', amanhaTxt);
  await adm.locator('#modal [name=dia]').dispatchEvent('change'); await adm.waitForSelector('text=Sem atendimento neste dia');
  await adm.click('#modal [data-fechar]');
  await adm.goto(url + '#/equipe'); await adm.waitForSelector('.pessoa');
  // excluir acesso (com agendamentos futuros cancelados) e restaurar
  await adm.click('[data-excluir=fono]'); await adm.waitForSelector('[name=cancelar]');
  assert.match(await adm.textContent('#modal'), /agendamento\(s\) futuro/);
  await adm.fill('[name=motivo]', 'Teste de exclusão'); await foto(adm, '12b-excluir-acesso');
  await adm.click('#modal [type=submit]'); await adm.waitForSelector('#modal', { state: 'detached' });
  if ((await adm.textContent('#ver-excluidos')).includes('Mostrar')) await adm.click('#ver-excluidos'); await adm.waitForSelector('[data-restaurar=fono]');
  const agendaFono = await adm.evaluate(() => [...window.__banco].filter(([k, v]) => k.startsWith('agendamentos/') && v.profissional_uid === 'fono' && v.status === 'agendado' && (v.inicio?._ms ?? v.inicio) > Date.now()).length);
  assert.equal(agendaFono, 0, 'agendamentos futuros cancelados');
  assert.equal(await adm.evaluate(() => [...window.__banco.keys()].some(k => k.startsWith('atendimentos/') )), true, 'atendimentos preservados');
  await adm.click('[data-restaurar=fono]'); await adm.waitForTimeout(300);
  assert.equal(await adm.evaluate(() => window.__banco.get('usuarios/fono').excluido), false);
  // conta com registros não pode ser apagada
  await adm.click('[data-excluir=fono]'); await adm.waitForSelector('#modal [name=motivo]'); await adm.fill('#modal [name=motivo]', 'Teste'); await adm.click('#modal [type=submit]');
  await adm.waitForSelector('#modal', { state: 'detached', timeout: 8000 }).catch(async () => { throw Error('excluir fono: ' + await adm.textContent('#modal')); });
  await adm.waitForSelector('#ver-excluidos'); await adm.waitForTimeout(300);
  if ((await adm.textContent('#ver-excluidos')).includes('Mostrar')) { await adm.click('#ver-excluidos'); await adm.waitForTimeout(300); }
  await adm.waitForSelector('[data-apagar=fono]');
  await adm.click('[data-apagar=fono]');
  await adm.waitForSelector('#modal-titulo >> text=Não é possível');
  await adm.locator('#modal [data-fechar]').first().click(); await adm.waitForSelector('#modal', { state: 'detached' });
  await adm.click('[data-restaurar=fono]'); await adm.waitForFunction(() => window.__banco.get('usuarios/fono').excluido === false);
  // excluir de novo e confirmar que a conta não entra mais
  await adm.click('[data-excluir=fono]'); await adm.fill('[name=motivo]', 'Fim do contrato'); await adm.click('#modal [type=submit]');
  await adm.waitForSelector('#modal', { state: 'detached' });
  await adm.evaluate(() => { window.__usuarioTeste = { uid: 'fono', email: 'fono@x.br', emailVerified: true }; });
  await adm.click('#sair'); assert.equal(await adm.evaluate(() => window.__cacheLimpo), true, 'cache local apagado ao sair');
  await adm.click('#entrar'); await adm.waitForSelector('.alerta-caixa');
  assert.match(await adm.textContent('.alerta-caixa'), /desativado/);
  await adm.evaluate(() => { window.__usuarioTeste = { uid: 'admin', email: 'admin@x.br', emailVerified: true }; });
  await adm.click('#sair'); await adm.click('#entrar'); await adm.waitForSelector('.topo-usuario');
  await adm.goto(url + '#/escolas'); await adm.waitForSelector('#semear');
  await adm.click('#semear'); await adm.waitForSelector('text=Creche Sebastiana');
  await foto(adm, '13-escolas');
  // troca de instituição: lista de alunos passa a mostrar só a escola escolhida
  await adm.click('#trocar-inst'); await adm.click('[data-inst=monteiro-lobato]');
  await adm.goto(url + '#/alunos'); await adm.waitForSelector('.aluno-item');
  assert.deepEqual(await adm.locator('.aluno-item strong').allTextContents(), ['Ana Clara Souza']);
  await adm.goto(url + '#/relatorios'); await adm.waitForSelector('.grafico-colunas'); await foto(adm, '13b-relatorios');
  await adm.setViewportSize({ width: 390, height: 844 });
  await adm.goto(url + '#/aluno/a1'); await adm.waitForSelector('.linha-tempo');
  await foto(adm, '14-celular-prontuario');
  await adm.close();

  // especialista corrige a escola do aluno (cadastrado na escola errada) pelo botão Editar da lista
  const esp = await sessao('fono', { instituicao: '' });
  await esp.goto(url + '#/alunos'); await esp.waitForSelector('.aluno-item');
  await esp.click('.aluno-linha:has-text("Bruno") [data-editar]'); await esp.waitForSelector('#modal [name=escola_id]');
  assert.equal(await esp.locator('#modal [name=escola_id] option').count(), 6, 'especialista escolhe qualquer escola da rede');
  assert.equal(await esp.isVisible('[data-mudanca-escola]'), false);
  await esp.selectOption('#modal [name=escola_id]', 'monteiro-lobato');
  assert.equal(await esp.isVisible('[data-mudanca-escola]'), true);
  await foto(esp, '15-mudanca-escola');
  await esp.click('#modal [type=submit]'); await esp.waitForTimeout(200);
  assert.equal(await esp.isVisible('#modal'), true, 'exige informar correção ou transferência');
  await esp.check('[name=tipo_mudanca][value=correcao]');
  await esp.click('#modal [type=submit]'); await esp.waitForSelector('#modal', { state: 'detached' });
  const banco = await esp.evaluate(() => Object.fromEntries([...window.__banco].filter(([k]) => /^(estudantes|agendamentos)\//.test(k))));
  assert.equal(banco['estudantes/a2'].escola_id, 'monteiro-lobato');
  assert.deepEqual(banco['estudantes/a2'].escolas_anteriores || [], [], 'correção não entra no histórico');
  for (const [k, a] of Object.entries(banco)) if (k.startsWith('agendamentos/') && a.estudante_id === 'a2' && a.status === 'agendado') assert.equal(a.escola_id, 'monteiro-lobato', k + ' acompanha o aluno');
  // transferência registra a escola anterior
  await esp.goto(url + '#/aluno/a2'); await esp.waitForSelector('[data-acao=editar]');
  await esp.click('.perfil-topo [data-acao=editar]'); await esp.waitForSelector('#modal [name=escola_id]');
  await esp.selectOption('#modal [name=escola_id]', 'doutor-joao-souza-lima'); await esp.check('[name=tipo_mudanca][value=transferencia]');
  await esp.click('#modal [type=submit]'); await esp.waitForSelector('#modal', { state: 'detached' });
  const a2 = await esp.evaluate(() => window.__banco.get('estudantes/a2'));
  assert.equal(a2.escola_id, 'doutor-joao-souza-lima');
  assert.deepEqual(a2.escolas_anteriores.map(x => x.escola_id), ['monteiro-lobato']);
  await esp.close();

  assert.deepEqual(erros, []);
  console.log('OK: fluxo de interface completo.');
} catch (e) {
  console.error('FALHA:', e.message, (e.stack||'').split('\n').find(l=>l.includes('tela.local'))); console.error(erros.join('\n')); process.exitCode = 1;
} finally { await navegador.close(); servidor.close(); }
