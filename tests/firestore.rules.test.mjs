import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,collection,getDocs,query,where,writeBatch,serverTimestamp} from 'firebase/firestore';

const env=await initializeTestEnvironment({
 projectId:'demo-seduc-tests',
 firestore:{rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}
});
after(async()=>env.cleanup());
const contexto=uid=>env.authenticatedContext(uid,{email:uid+'@exemplo.test'}).firestore();

await env.withSecurityRulesDisabled(async ctx=>{
 const db=ctx.firestore();
 const docs=[
  ['usuarios/admin',{nome:'Administrador',email:'admin@exemplo.test',ativo:true,perfil:'superadmin',gerenciar:true,escolas:[]}],
  ['usuarios/sec',{nome:'Gestora',email:'sec@exemplo.test',ativo:true,perfil:'secretaria',gerenciar:true,escolas:[]}],
  ['usuarios/secview',{nome:'Secretaria consulta',email:'secview@exemplo.test',ativo:true,perfil:'secretaria',gerenciar:false,escolas:[]}],
  ['usuarios/espA',{nome:'Especialista A',email:'espA@exemplo.test',ativo:true,perfil:'especialista',gerenciar:false,escolas:['a']}],
  ['usuarios/espB',{nome:'Especialista B',email:'espB@exemplo.test',ativo:true,perfil:'especialista',gerenciar:false,escolas:['b']}],
  ['usuarios/dirA',{nome:'Direção A',email:'dirA@exemplo.test',ativo:true,perfil:'direcao',gerenciar:false,escolas:['a']}],
  ['usuarios/pendente',{nome:'Pendente',email:'pendente@exemplo.test',ativo:false,perfil:'pendente',gerenciar:false,escolas:[]}],
  ['escolas/a',{nome:'Escola A',inep:'',telefone:'',endereco:'',email:''}],
  ['escolas/b',{nome:'Escola B',inep:'',telefone:'',endereco:'',email:''}],
  ['alunos/alunoA',{nome:'Aluno fictício A',escola_id:'a',nascimento:'2018-01-01',criado_por:'espA',ativo:true}],
  ['alunos_privado/alunoA',{cpf:'',filiacao:'',telefone:'',endereco:'',escola_id:'a',criado_por:'espA'}],
  ['vinculos/vinculoA',{uid:'espA',escola_id:'a',profissional_id:'profA',cargo:'Especialista',jornada:'20 horas',horarios:[{dia:1,inicio:'08:00',fim:'12:00'}],slots_semana:[64,65,66,67,68,69,70,71],ativo:true}],
  ['atendimentos/atendimentoA',{escola_id:'a',aluno_id:'alunoA',autor_uid:'espA',autor_nome:'Especialista A',status:'realizado'}],
  ['notas_atendimento/atendimentoA',{escola_id:'a',atendimento_id:'atendimentoA',autor_uid:'espA',texto:'Observação fictícia',revisao:1}]
 ];
 for(const [path,data] of docs)await setDoc(doc(db,path),data);
});

test('conta pendente e visitante não acessam dados escolares',async()=>{
 await assertFails(getDoc(doc(contexto('pendente'),'escolas/a')));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'escolas/a')));
});
test('especialistas enxergam apenas suas escolas e notas autorizadas',async()=>{
 await assertSucceeds(getDoc(doc(contexto('espA'),'alunos/alunoA')));
 await assertSucceeds(getDoc(doc(contexto('espA'),'notas_atendimento/atendimentoA')));
 await assertFails(getDoc(doc(contexto('espB'),'alunos/alunoA')));
 await assertFails(getDoc(doc(contexto('espB'),'notas_atendimento/atendimentoA')));
 await assertFails(getDoc(doc(contexto('espB'),'alunos_privado/alunoA')));
});
test('direção e secretaria leem metadados, mas não observações confidenciais',async()=>{
 await assertSucceeds(getDoc(doc(contexto('dirA'),'atendimentos/atendimentoA')));
 await assertSucceeds(getDoc(doc(contexto('secview'),'atendimentos/atendimentoA')));
 await assertFails(getDoc(doc(contexto('dirA'),'notas_atendimento/atendimentoA')));
 await assertFails(getDoc(doc(contexto('secview'),'notas_atendimento/atendimentoA')));
 await assertSucceeds(getDoc(doc(contexto('admin'),'notas_atendimento/atendimentoA')));
});
test('outras profissionais não alteram nem apagam registros de terceiros',async()=>{
 await assertFails(updateDoc(doc(contexto('espB'),'atendimentos/atendimentoA'),{status:'cancelado'}));
 await assertFails(deleteDoc(doc(contexto('espA'),'atendimentos/atendimentoA')));
});
test('conta pendente não altera o próprio perfil',async()=>{
 await assertFails(updateDoc(doc(contexto('pendente'),'usuarios/pendente'),{perfil:'superadmin',ativo:true}));
});
test('Secretaria delegada não promove para superadmin',async()=>{
 await assertFails(updateDoc(doc(contexto('sec'),'usuarios/espB'),{perfil:'superadmin',ativo:true}));
});
test('CPF não é aceito no cadastro público do aluno',async()=>{
 await assertFails(setDoc(doc(contexto('espA'),'alunos/invalidCPF'),{
  nome:'Aluno fictício',escola_id:'a',nascimento:'2017-01-01',criado_por:'espA',ativo:true,cpf:'00000000000'
 }));
});
test('cadastro familiar completo permanece privado e editável somente na escola autorizada',async()=>{
 const db=contexto('espA');
 const ficha={
  cpf:'',filiacao:'Mãe / Pai',telefone:'(33) 99999-9999',endereco:'Rua Fictícia, Centro',
  escola_id:'a',criado_por:'espA',mae_nome:'Mãe Exemplo',pai_nome:'',pai_nao_declarado:true,
  responsavel_nome:'Mãe Exemplo',responsavel_parentesco:'Mae',
  responsavel_telefone:'(33) 99999-9999',responsavel_telefone_alternativo:'',
  responsavel_email:'',cep:'35170-000',logradouro:'Rua Fictícia',numero:'12',
  complemento:'',bairro:'Centro',cidade:'Cidade Teste',uf:'MG',referencia:''
 };
 await assertSucceeds(setDoc(doc(db,'alunos_privado/alunoA'),ficha));
 await assertSucceeds(getDoc(doc(db,'alunos_privado/alunoA')));
 await assertFails(getDoc(doc(contexto('dirA'),'alunos_privado/alunoA')));
 await assertFails(getDoc(doc(contexto('espB'),'alunos_privado/alunoA')));
 await assertFails(updateDoc(doc(contexto('espB'),'alunos_privado/alunoA'),{mae_nome:'Alteração não autorizada'}));
 await assertSucceeds(updateDoc(doc(db,'alunos_privado/alunoA'),{numero:'13'}));
 await assertFails(updateDoc(doc(db,'alunos_privado/alunoA'),{escola_id:'b'}));
 await assertFails(updateDoc(doc(db,'alunos/alunoA'),{cpf:'12345678909'}));
});
test('registro de ciência dos termos é versionado, exclusivo e imutável',async()=>{
 const id='espA_2026-10-28-v1',dados={
  uid:'espA',versao:'2026-10-28-v1',tipo:'ciencia_termos_uso',aceito_em:serverTimestamp()
 };
 await assertFails(setDoc(doc(contexto('espB'),'termos_aceites/'+id),dados));
 await assertSucceeds(setDoc(doc(contexto('espA'),'termos_aceites/'+id),dados));
 await assertSucceeds(getDoc(doc(contexto('espA'),'termos_aceites/'+id)));
 await assertSucceeds(getDoc(doc(contexto('admin'),'termos_aceites/'+id)));
 await assertFails(getDoc(doc(contexto('espB'),'termos_aceites/'+id)));
 await assertFails(updateDoc(doc(contexto('espA'),'termos_aceites/'+id),{tipo:'outra_aceitacao'}));
 await assertFails(deleteDoc(doc(contexto('espA'),'termos_aceites/'+id)));
});
test('especialista não agenda consulta na escola errada',async()=>{
 await assertFails(setDoc(doc(contexto('espB'),'agendamentos/fora'),{
  escola_id:'a',aluno_id:'alunoA',vinculo_id:'vinculoA',
  autor_uid:'espB',autor_nome:'Especialista B',inicio:new Date('2027-01-01T10:00:00Z'),
  duracao_min:30,especialidade:'Exemplo',criado_em:serverTimestamp(),status:'agendado'
 }));
});
test('autor pode criar atendimento com nota em transação atômica',async()=>{
 const db=contexto('espA');
 const batch=writeBatch(db);
 batch.set(doc(db,'atendimentos/novo'),{
  escola_id:'a',aluno_id:'alunoA',vinculo_id:'vinculoA',
  autor_uid:'espA',autor_nome:'Especialista A',inicio:new Date('2027-01-01T10:00:00Z'),
  data:new Date('2027-01-01T10:00:00Z'),duracao_min:30,
  especialidade:'Exemplo',criado_em:serverTimestamp(),status:'realizado'
 });
 batch.set(doc(db,'notas_atendimento/novo'),{
  escola_id:'a',atendimento_id:'novo',autor_uid:'espA',texto:'Registro fictício',revisao:1
 });
 await assertSucceeds(batch.commit());
});
test('autor edita nota com trilha de alteração imutável',async()=>{
 const db=contexto('espA');
 const batch=writeBatch(db);
 batch.update(doc(db,'notas_atendimento/atendimentoA'),{texto:'Revisão fictícia',revisao:2,atualizado_em:serverTimestamp()});
 batch.set(doc(db,'notas_versoes/atendimentoA-2'),{
  atendimento_id:'atendimentoA',escola_id:'a',autor_uid:'espA',editado_por:'espA',texto_anterior:'Observação fictícia',
  texto_novo:'Revisão fictícia',justificativa:'Correção de registro',versao:2,em:serverTimestamp()
 });
 await assertSucceeds(batch.commit());
 await assertFails(deleteDoc(doc(db,'notas_versoes/atendimentoA-2')));
});

test('frequência registra entrada e saída com carimbos do servidor',async()=>{
 const db=contexto('espA');
 const partes=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const dia=partes.year+'-'+partes.month+'-'+partes.day;
 const ref=doc(db,'frequencias/espA_a_'+dia);
 await assertSucceeds(setDoc(ref,{
  uid:'espA',escola_id:'a',vinculo_id:'vinculoA',
  dia,entrada:serverTimestamp(),saida:null,status:'aberta'
 }));
 await assertSucceeds(updateDoc(ref,{saida:serverTimestamp(),status:'fechada'}));
 await assertFails(updateDoc(ref,{saida:serverTimestamp(),status:'fechada'}));
 await assertFails(deleteDoc(ref));
});
test('dados privados só são gravados junto do aluno público autorizado',async()=>{
 const db=contexto('espA');
 const batch=writeBatch(db);
 batch.set(doc(db,'alunos/novoAluno'),{
  nome:'Aluno fictício novo',nascimento:'2018-01-01',matricula:'SIMULADA',
  escola_id:'a',criado_por:'espA',ativo:true
 });
 batch.set(doc(db,'alunos_privado/novoAluno'),{
  cpf:'',filiacao:'',telefone:'',endereco:'',escola_id:'a',criado_por:'espA'
 });
 await assertSucceeds(batch.commit());
 await assertFails(getDoc(doc(contexto('dirA'),'alunos_privado/novoAluno')));
 await assertSucceeds(updateDoc(doc(db,'alunos/novoAluno'),{ativo:false}));
});


const slotId=(uid,data)=>uid+'_'+data.getTime();
const novoAgendamento=(id,inicio,duracao=30)=>({
 escola_id:'a',aluno_id:'alunoA',vinculo_id:'vinculoA',
 inicio,duracao_min:duracao,especialidade:'Atendimento fictício',
 autor_uid:'espA',autor_nome:'Especialista A',criado_em:serverTimestamp(),status:'agendado'
});
function addLocks(db,batch,id,inicio,duracao){
 for(const t of [inicio,...(duracao===60?[new Date(inicio.getTime()+1800000)]:[])]){
  batch.set(doc(db,'agenda_slots',slotId('espA',t)),{autor_uid:'espA',escola_id:'a',agendamento_id:id,inicio:t,status:'reservado'});
 }
}
test('log de agendamento é imutável, vinculado ao autor e ao registro',async()=>{
 const db=contexto('espA'),id='auditAgenda',inicio=new Date('2027-12-13T12:00:00Z'),batch=writeBatch(db);
 batch.set(doc(db,'agendamentos',id),novoAgendamento(id,inicio));
 addLocks(db,batch,id,inicio,30);
 const registro={
  acao:'agendado',alvo_tipo:'agendamento',alvo_id:id,escola_id:'a',
  aluno_id:'alunoA',autor_uid:'espA',autor_nome:'Especialista A',
  criado_em:serverTimestamp(),situacao_anterior:'',situacao_nova:'agendado'
 };
 batch.set(doc(db,'agendamentos',id,'historico','evento1'),registro);
 await assertSucceeds(batch.commit());
 await assertSucceeds(getDocs(collection(db,'agendamentos',id,'historico')));
 await assertFails(getDocs(collection(contexto('espB'),'agendamentos',id,'historico')));
 await assertFails(updateDoc(doc(db,'agendamentos',id,'historico','evento1'),{acao:'cancelado'}));
 await assertFails(deleteDoc(doc(db,'agendamentos',id,'historico','evento1')));
 await assertFails(setDoc(doc(db,'agendamentos',id,'historico','falso'),{
  ...registro,acao:'concluido',criado_em:serverTimestamp(),situacao_nova:'realizado'
 }));
});
test('auditoria de aluno é restrita ao profissional da escola e equipe gestora',async()=>{
 const db=contexto('espA'),ref=doc(db,'alunos','alunoA','historico','evento1');
 await assertSucceeds(setDoc(ref,{
  acao:'aluno_atualizado',alvo_tipo:'aluno',alvo_id:'alunoA',escola_id:'a',
  aluno_id:'alunoA',autor_uid:'espA',autor_nome:'Especialista A',
  criado_em:serverTimestamp(),situacao_anterior:'cadastrado',situacao_nova:'atualizado'
 }));
 await assertSucceeds(getDoc(ref));
 await assertSucceeds(getDoc(doc(contexto('admin'),'alunos','alunoA','historico','evento1')));
 await assertFails(getDoc(doc(contexto('espB'),'alunos','alunoA','historico','evento1')));
});
test('agendamento sem reservas transacionais é proibido',async()=>{
 const inicio=new Date('2027-11-01T12:00:00.000Z');
 await assertFails(setDoc(doc(contexto('espA'),'agendamentos/semLocks'),novoAgendamento('semLocks',inicio)));
});
test('cria reserva de 60 minutos com dois locks na mesma transação',async()=>{
 const db=contexto('espA'),inicio=new Date('2027-11-01T12:00:00.000Z'),batch=writeBatch(db);
 batch.set(doc(db,'agendamentos/seguro60'),novoAgendamento('seguro60',inicio,60));
 addLocks(db,batch,'seguro60',inicio,60);
 await assertSucceeds(batch.commit());
});
test('a mesma profissional não consegue sobrepor intervalos reservados',async()=>{
 const db=contexto('espA'),inicio=new Date('2027-11-01T12:30:00.000Z'),batch=writeBatch(db);
 batch.set(doc(db,'agendamentos/choque'),novoAgendamento('choque',inicio));
 addLocks(db,batch,'choque',inicio,30);
 await assertFails(batch.commit());
});
test('cancelamento libera ambos os slots e permite novo agendamento',async()=>{
 const db=contexto('espA'),inicio=new Date('2027-11-01T12:00:00.000Z');
 const liberar=writeBatch(db);
 liberar.update(doc(db,'agendamentos/seguro60'),{status:'cancelado'});
 for(const t of [inicio,new Date(inicio.getTime()+1800000)]){
  liberar.update(doc(db,'agenda_slots',slotId('espA',t)),{status:'liberado'});
 }
 await assertSucceeds(liberar.commit());
 const novo=writeBatch(db);
 novo.set(doc(db,'agendamentos/reagendado'),novoAgendamento('reagendado',inicio,30));
 addLocks(db,novo,'reagendado',inicio,30);
 await assertSucceeds(novo.commit());
});
test('profissional inicia e conclui consulta pelo agendamento sem duplicar atendimentos',async()=>{
 const db=contexto('espA'),id='consultaIntegrada',inicio=new Date('2027-11-15T12:00:00.000Z');
 const criar=writeBatch(db);
 criar.set(doc(db,'agendamentos',id),novoAgendamento(id,inicio));
 addLocks(db,criar,id,inicio,30);
 await assertSucceeds(criar.commit());
 await assertFails(updateDoc(doc(contexto('espB'),'agendamentos',id),{status:'em_atendimento',iniciado_em:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(db,'agendamentos',id),{status:'em_atendimento',iniciado_em:serverTimestamp()}));
 await assertFails(updateDoc(doc(db,'agendamentos',id),{status:'cancelado'}));
 await assertFails(updateDoc(doc(db,'agendamentos',id),{status:'realizado',finalizado_em:serverTimestamp(),atendimento_id:'agenda_'+id}));
 const atendimento={
  escola_id:'a',aluno_id:'alunoA',vinculo_id:'vinculoA',
  inicio,duracao_min:30,especialidade:'Atendimento fictício',
  autor_uid:'espA',autor_nome:'Especialista A',criado_em:serverTimestamp(),
  data:serverTimestamp(),status:'realizado',agendamento_id:id
 };
 await assertFails(setDoc(doc(db,'atendimentos','agenda_'+id),atendimento));
 const concluir=writeBatch(db);
 concluir.update(doc(db,'agendamentos',id),{status:'realizado',finalizado_em:serverTimestamp(),atendimento_id:'agenda_'+id});
 concluir.set(doc(db,'atendimentos','agenda_'+id),atendimento);
 concluir.set(doc(db,'notas_atendimento','agenda_'+id),{
  escola_id:'a',atendimento_id:'agenda_'+id,autor_uid:'espA',
  texto:'Consulta fictícia iniciada pelo agendamento.',revisao:1
 });
 await assertSucceeds(concluir.commit());
 const ag=await assertSucceeds(getDoc(doc(db,'agendamentos',id)));
 const visita=await assertSucceeds(getDoc(doc(db,'atendimentos','agenda_'+id)));
 assert.equal(ag.data().status,'realizado');
 assert.equal(visita.data().agendamento_id,id);
 await assertFails(updateDoc(doc(db,'agendamentos',id),{status:'em_atendimento'}));
 await assertFails(updateDoc(doc(db,'agendamentos',id),{status:'cancelado'}));
 await assertFails(deleteDoc(doc(db,'atendimentos','agenda_'+id)));
 await assertFails(getDoc(doc(contexto('dirA'),'notas_atendimento/agenda_'+id)));
});
test('atendimento vinculado exige agendamento iniciado e conclusão atômica',async()=>{
 const db=contexto('espA');
 await assertFails(setDoc(doc(db,'atendimentos/agenda_fantasma'),{
  escola_id:'a',aluno_id:'alunoA',vinculo_id:'vinculoA',
  inicio:new Date('2027-11-15T12:00:00.000Z'),duracao_min:30,especialidade:'Atendimento fictício',
  autor_uid:'espA',autor_nome:'Especialista A',criado_em:serverTimestamp(),
  data:serverTimestamp(),status:'realizado',agendamento_id:'fantasma'
 }));
});

test('registra ausencia e libera horario com seguranca',async()=>{
 const dt=new Date('2026-10-26T12:00:00.000Z'),id='registroAusencia';
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'agendamentos',id),{...novoAgendamento(id,dt),criado_em:new Date('2026-10-25T12:00:00Z')});
  await setDoc(doc(db,'agenda_slots',slotId('espA',dt)),{autor_uid:'espA',escola_id:'a',agendamento_id:id,inicio:dt,status:'reservado'});
 });
 const db=contexto('espA');
 await assertFails(updateDoc(doc(contexto('espB'),'agendamentos',id),{status:'falta_aluno'}));
 const batch=writeBatch(db);
 batch.update(doc(db,'agendamentos',id),{status:'falta_aluno',motivo_falta:'Registro de teste',falta_registrada_em:serverTimestamp()});
 batch.update(doc(db,'agenda_slots',slotId('espA',dt)),{status:'liberado'});
 await assertSucceeds(batch.commit());
 const snap=await getDoc(doc(db,'agendamentos',id));
 assert.equal(snap.data().status,'falta_aluno');
 const nextDate=new Date('2027-11-22T12:00:00.000Z'),newId='reagendadoAposAusencia';
 const reagendar=writeBatch(db);
 reagendar.update(doc(db,'agendamentos',id),{novo_agendamento_id:newId,remarcado_em:serverTimestamp(),motivo_remarcacao:'Nova data solicitada'});
 reagendar.set(doc(db,'agendamentos',newId),{...novoAgendamento(newId,nextDate),remarcado_de:id});
 addLocks(db,reagendar,newId,nextDate,30);
 await assertSucceeds(reagendar.commit());
 const refeito=await getDoc(doc(db,'agendamentos',newId));
 assert.equal(refeito.data().remarcado_de,id);
});
test('slots não podem ser liberados sem cancelar o agendamento',async()=>{
 const db=contexto('espA'),inicio=new Date('2027-11-01T12:00:00.000Z');
 await assertFails(updateDoc(doc(db,'agenda_slots',slotId('espA',inicio)),{status:'liberado'}));
});

test('regras do servidor recusam consultas fora da jornada semanal',async()=>{
 const db=contexto('espA'),inicio=new Date('2027-11-02T12:00:00.000Z');
 const batch=writeBatch(db);
 batch.set(doc(db,'agendamentos/foraJornada'),novoAgendamento('foraJornada',inicio));
 addLocks(db,batch,'foraJornada',inicio,30);
 await assertFails(batch.commit());
});

test('frequência não pode ser registrada com data falsificada',async()=>{
 const db=contexto('espA');
 await assertFails(setDoc(doc(db,'frequencias/espA_a_2025-01-01'),{
  uid:'espA',escola_id:'a',vinculo_id:'vinculoA',
  dia:'2025-01-01',entrada:serverTimestamp(),saida:null,status:'aberta'
 }));
});

test('superadmin cadastra servidor com contato protegido; direção não lê quadro',async()=>{
 const db=contexto('admin'),batch=writeBatch(db);
 batch.set(doc(db,'servidores/srv_abcdef12345678901234'),{
  nome:'Funcionário fictício',cargo:'Auxiliar',escola_id:'a',
  ano:2026,escola_origem:'Escola de Teste',linha_origem:9,ativo:true
 });
 batch.set(doc(db,'servidores_privado/srv_abcdef12345678901234'),{
  celular:'',telefone:'',escola_id:'a'
 });
 await assertSucceeds(batch.commit());
 await assertSucceeds(getDoc(doc(db,'servidores/srv_abcdef12345678901234')));
 await assertFails(getDoc(doc(contexto('dirA'),'servidores/srv_abcdef12345678901234')));
 await assertFails(getDoc(doc(contexto('espA'),'servidores_privado/srv_abcdef12345678901234')));
});
test('especialista não pode importar servidor nem dados privados',async()=>{
 const db=contexto('espA');
 await assertFails(setDoc(doc(db,'servidores/srv_aaaaaaaaaaaaaaaaaaaa'),{
  nome:'Teste bloqueado',cargo:'Auxiliar',escola_id:'a',
  ano:2026,escola_origem:'Escola A',linha_origem:1,ativo:true
 }));
});

test('dados de acompanhamento são segregados e não acessíveis à direção',async()=>{
 const db=contexto('admin'),batch=writeBatch(db);
 batch.set(doc(db,'alunos/alu_0123456789abcdef01234567'),{
  nome:'Estudante fictício',escola_id:'a',nascimento:'',matricula:'',criado_por:'admin',ativo:true
 });
 batch.set(doc(db,'alunos_privado/alu_0123456789abcdef01234567'),{
  cpf:'',filiacao:'',telefone:'',endereco:'',escola_id:'a',criado_por:'admin'
 });
 batch.set(doc(db,'alunos_necessidades/alu_0123456789abcdef01234567'),{
  aluno_id:'alu_0123456789abcdef01234567',escola_id:'a',turma:'Infantil',
  registro_escolar:'Informação escolar fictícia',ano_letivo:2026,origem:'relatorio_escolar_2026',
  importado_por:'admin',criado_em:serverTimestamp()
 });
 await assertSucceeds(batch.commit());
 await assertSucceeds(getDoc(doc(db,'alunos_necessidades/alu_0123456789abcdef01234567')));
 await assertSucceeds(getDoc(doc(contexto('espA'),'alunos_necessidades/alu_0123456789abcdef01234567')));
 await assertFails(getDoc(doc(contexto('dirA'),'alunos_necessidades/alu_0123456789abcdef01234567')));
 await assertFails(getDoc(doc(contexto('espB'),'alunos_necessidades/alu_0123456789abcdef01234567')));
 await assertSucceeds(getDocs(query(collection(contexto('espA'),'alunos_necessidades'),where('escola_id','==','a'))));
 await assertFails(getDocs(query(collection(contexto('espB'),'alunos_necessidades'),where('escola_id','==','a'))));
 await assertFails(updateDoc(doc(db,'alunos_necessidades/alu_0123456789abcdef01234567'),{registro_escolar:'Alteração não auditada'}));
});

const relatorioFicticio=()=>({aluno_id:'alunoA',escola_id:'a',vinculo_id:'vinculoA',autor_uid:'espA',autor_nome:'Especialista A',especialidade:'Fonoaudiologia',titulo:'Evolução fictícia',texto:'Acompanhamento fictício',criado_em:serverTimestamp()});
test('relatório permanece vinculado ao aluno e Secretaria pode consultar sem editar',async()=>{
 const db=contexto('espA');
 await assertSucceeds(setDoc(doc(db,'relatorios_alunos/relA'),relatorioFicticio()));
 await assertSucceeds(getDoc(doc(contexto('secview'),'relatorios_alunos/relA')));
 await assertSucceeds(getDocs(collection(contexto('secview'),'relatorios_alunos')));
 await assertSucceeds(getDocs(query(collection(db,'relatorios_alunos'),where('escola_id','in',['a']))));
 for(const uid of ['espB','dirA','pendente'])await assertFails(getDoc(doc(contexto(uid),'relatorios_alunos/relA')));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'relatorios_alunos/relA')));
 for(const uid of ['secview','espA','espB']){
  await assertFails(updateDoc(doc(contexto(uid),'relatorios_alunos/relA'),{texto:'Substituído'}));
  await assertFails(deleteDoc(doc(contexto(uid),'relatorios_alunos/relA')));
 }
});
test('relatórios recusam autoria falsa, escola incorreta, órfãos, schema e datas adulteradas',async()=>{
 const db=contexto('espA');
 const ataques=[
  {autor_uid:'espB'},{autor_nome:'Outra pessoa'},{escola_id:'b'},{aluno_id:'inexistente'},
  {vinculo_id:'inexistente'},{criado_em:new Date('2000-01-01')},{texto:5},
  {texto:'x'.repeat(5001)},{titulo:'x'.repeat(151)},{titulo:''},{especialidade:''},
  {extra:'não permitido'},{escola_id:3}
 ];
 for(let i=0;i<ataques.length;i++)await assertFails(setDoc(doc(db,'relatorios_alunos/ataque'+i),{...relatorioFicticio(),...ataques[i]}));
 const incompleto=relatorioFicticio();delete incompleto.titulo;
 await assertFails(setDoc(doc(db,'relatorios_alunos/incompleto'),incompleto));
 await assertFails(setDoc(doc(contexto('secview'),'relatorios_alunos/autoriaSecretaria'),relatorioFicticio()));
});
test('Secretaria consulta profissionais sem obter dados privados nem permissão de escrita',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'profissionais/profA'),{nome:'Especialista A',uid:'espA',especialidade:'Fonoaudiologia',escolas:['a']})});
 await assertSucceeds(getDocs(collection(contexto('secview'),'profissionais')));
 await assertFails(updateDoc(doc(contexto('secview'),'profissionais/profA'),{nome:'Alterado'}));
 await assertFails(getDoc(doc(contexto('secview'),'profissionais_privado/profA')));
});
test('Secretaria com gestão redefine local preservando vínculo anterior e histórico',async()=>{
 const db=contexto('sec');
 await assertSucceeds(updateDoc(doc(db,'vinculos/vinculoA'),{ativo:false}));
 await assertSucceeds(setDoc(doc(db,'vinculos/vinculoNovoLocal'),{uid:'espA',escola_id:'b',profissional_id:'profA',cargo:'Especialista',jornada:'20 horas',horarios:[],slots_semana:[],ativo:true}));
 const anterior=await assertSucceeds(getDoc(doc(db,'atendimentos/atendimentoA')));
 assert.equal(anterior.data().escola_id,'a');
 await assertFails(deleteDoc(doc(db,'vinculos/vinculoA')));
 await assertFails(updateDoc(doc(contexto('secview'),'vinculos/vinculoNovoLocal'),{ativo:false}));
});

const metaFicticia=()=>({aluno_id:'alunoA',escola_id:'a',vinculo_id:'',substitui_id:'',titulo:'Meta individual fictícia',linha_base:'Ponto de partida fictício',criterio:'Critério definido pela equipe',prazo:new Date('2027-02-01'),autor_uid:'sec',autor_nome:'Gestora',criado_em:serverTimestamp()});
test('Secretaria com gestão define metas e equipe registra evidências preservadas',async()=>{
 const db=contexto('sec');
 await assertSucceeds(setDoc(doc(db,'metas_alunos/metaA'),metaFicticia()));
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'vinculos/vinculoMetas'),{uid:'espA',escola_id:'a',ativo:true})});
 await assertSucceeds(setDoc(doc(contexto('espA'),'revisoes_metas/revisaoA'),{
  meta_id:'metaA',aluno_id:'alunoA',escola_id:'a',vinculo_id:'vinculoMetas',
  status:'em_desenvolvimento',evidencia:'Observação fictícia',autor_uid:'espA',autor_nome:'Especialista A',criado_em:serverTimestamp()
 }));
 await assertSucceeds(getDocs(collection(contexto('secview'),'metas_alunos')));
 await assertSucceeds(getDocs(query(collection(contexto('espA'),'metas_alunos'),where('escola_id','in',['a']))));
 await assertSucceeds(getDocs(query(collection(contexto('espA'),'revisoes_metas'),where('escola_id','in',['a']))));
 await assertSucceeds(setDoc(doc(db,'metas_alunos/metaNova'),{...metaFicticia(),substitui_id:'metaA',titulo:'Critério revisto'}));
 await assertSucceeds(getDoc(doc(db,'metas_alunos/metaA')));
 for(const uid of ['espB','dirA','pendente']){
  await assertFails(getDoc(doc(contexto(uid),'metas_alunos/metaA')));
  await assertFails(getDoc(doc(contexto(uid),'revisoes_metas/revisaoA')));
 }
 for(const uid of ['sec','espA']){
  await assertFails(updateDoc(doc(contexto(uid),'metas_alunos/metaA'),{criterio:'Sobrescrito'}));
  await assertFails(deleteDoc(doc(contexto(uid),'revisoes_metas/revisaoA')));
 }
});
test('metas e revisões recusam troca de autoria, órfãos, campos inválidos e autoatribuição de gestão',async()=>{
 const db=contexto('sec');
 const ataques=[{autor_uid:'espA'},{autor_nome:'Outra pessoa'},{aluno_id:'ausente'},{escola_id:'b'},
  {substitui_id:'ausente'},{titulo:'x'.repeat(151)},{linha_base:'x'.repeat(1001)},{criterio:5},
  {extra:true},{prazo:'amanhã'},{criado_em:new Date('2000-01-01')}];
 for(let i=0;i<ataques.length;i++)await assertFails(setDoc(doc(db,'metas_alunos/ataqueMeta'+i),{...metaFicticia(),...ataques[i]}));
 const falta=metaFicticia();delete falta.criterio;
 await assertFails(setDoc(doc(db,'metas_alunos/incompleta'),falta));
 await assertFails(setDoc(doc(contexto('secview'),'metas_alunos/semGestao'),{...metaFicticia(),autor_uid:'secview',autor_nome:'Secretaria consulta'}));
 await assertFails(setDoc(doc(contexto('espB'),'metas_alunos/outraEscola'),{...metaFicticia(),autor_uid:'espB',autor_nome:'Especialista B',vinculo_id:'vinculoMetas'}));
 const revisao={meta_id:'metaA',aluno_id:'alunoA',escola_id:'a',vinculo_id:'',status:'atingida',evidencia:'Evidência fictícia',autor_uid:'sec',autor_nome:'Gestora',criado_em:serverTimestamp()};
 await assertSucceeds(setDoc(doc(db,'revisoes_metas/secretaria'),revisao));
 for(const [i,patch]of [{meta_id:'ausente'},{aluno_id:'outro'},{status:'diagnosticado'},{evidencia:'x'.repeat(2001)},{autor_uid:'outro'},{extra:1}].entries()){
  await assertFails(setDoc(doc(db,'revisoes_metas/ataque'+i),{...revisao,...patch}));
 }
 await assertFails(updateDoc(doc(db,'revisoes_metas/secretaria'),{status:'revisar'}));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'metas_alunos/metaA')));
});
