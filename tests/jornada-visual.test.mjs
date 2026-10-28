import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {jornadaDosCampos,conferirJornadaVisual,DIAS_JORNADA} from '../assets/js/jornada-visual.mjs';
import {gerarSlotsSemana} from '../assets/js/validacoes.mjs';
import {criarEmailAgendamento} from '../assets/js/notificacoes-email.mjs';
const source=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
test('editor visual contém os sete dias e vários turnos por dia',()=>{
 assert.equal(DIAS_JORNADA.length,7);
 assert.deepEqual(DIAS_JORNADA.map(x=>x.dia),[1,2,3,4,5,6,0]);
 const dados={dia_1:'sim',inicio_1_1:'08:00',fim_1_1:'12:00',turno2_1:'sim',inicio_1_2:'13:00',fim_1_2:'17:00',dia_4:'sim',inicio_4_1:'07:30',fim_4_1:'12:30'};
 const res=jornadaDosCampos(dados);
 assert.equal(res.horarios.length,3);
 assert.equal(res.totalMinutos,13*60);
 assert.equal(res.jornada,'13 horas semanais');
 assert.equal(gerarSlotsSemana(res.horarios).length,26);
});
test('intervalos inválidos e sobrepostos são rejeitados',()=>{
 assert.throws(()=>jornadaDosCampos({}),/pelo menos um dia/);
 assert.throws(()=>jornadaDosCampos({dia_1:'sim',inicio_1_1:'12:00',fim_1_1:'08:00'}),/posterior/);
 assert.throws(()=>jornadaDosCampos({dia_1:'sim',inicio_1_1:'08:15',fim_1_1:'12:00'}),/30 minutos/);
 assert.throws(()=>jornadaDosCampos({dia_1:'sim',inicio_1_1:'08:00',fim_1_1:'12:00',turno2_1:'sim',inicio_1_2:'11:30',fim_1_2:'17:00'}),/sobrepostos/);
 assert.equal(conferirJornadaVisual([{dia:5,inicio:'13:00',fim:'17:00'}]).jornada,'4 horas semanais');
});
test('criação e edição de vínculo usam o mesmo editor, sem digitar códigos',()=>{
 assert.ok(source.includes('function editorJornadaVisual()'));
 assert.ok(source.includes('function configurarEditorJornada('));
 assert.ok(source.includes('async function abrirFormularioVinculo()'));
 assert.ok(source.includes("modal('Vincular profissional e jornada'"));
 assert.ok(source.includes("modal('Redefinir local e jornada'"));
 assert.ok(source.includes("jornadaDosCampos(d)"));
 assert.ok(!source.includes("field('horarios_texto'"));
 assert.ok(source.includes("id=\\"jornada-semana-util\\""));
});
test('especialista da mesma escola pode ser escolhida sem substituir autor do agendamento',()=>{
 assert.ok(source.includes("profissional.value=elegiveis.some(p=>p.uid===anterior)?anterior:padrao"));
 assert.ok(source.includes("if(isAgenda&&especialistaUid!==user.uid)payload.agendado_por_uid=user.uid"));
 assert.ok(source.includes("abrirNotificacaoAgendamento"));
});
test('aviso por e-mail não contém prontuário nem dados sensíveis',()=>{
 const m=criarEmailAgendamento({
  aluno:'Aluno Exemplo',escola:'Escola Central',profissional:'Profissional Exemplo',
  inicio:new Date(2027,2,1,9,30),duracaoMin:60,
  especialidade:'Psicopedagogia',remetente:'SEDUC',destinatario:'especialista@exemplo.com'
 });
 assert.match(m.corpo,/Aluno: Aluno Exemplo/);
 assert.match(m.corpo,/Escola: Escola Central/);
 assert.match(m.corpo,/Horário: 09:30/);
 assert.doesNotMatch(m.corpo,/CPF:/);
 assert.doesNotMatch(m.corpo,/diagnóstico:/i);
 assert.match(m.mailto,/^mailto:/);
});
test('tutorial da gestão e orientações LGPD podem ser ocultados por usuário',()=>{
 assert.ok(source.includes('function manualAdministrativoSEDUC()'));
 assert.ok(source.includes('Profissionais → Adicionar vínculo de atendimento'));
 assert.ok(source.includes("seduc-tutorial-oculto-'+(user?.uid||'usuario')"));
 assert.ok(source.includes('LGPD e segurança da informação'));
});
