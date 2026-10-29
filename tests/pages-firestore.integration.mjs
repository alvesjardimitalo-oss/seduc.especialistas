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
const contextoGoogle=(uid,email)=>env.authenticatedContext(uid,{email,email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();

await env.withSecurityRulesDisabled(async ctx=>{
 const db=ctx.firestore();
 const docs=[
  ['usuarios/admin',{nome:'Administrador',email:'admin@exemplo.test',ativo:true,perfil:'superadmin',gerenciar:true,escolas:[]}],
  ['usuarios/sec',{nome:'Gestora',email:'sec@exemplo.test',ativo:true,perfil:'secretaria',gerenciar:true,escolas:[]}],
  ['usuarios/secview',{nome:'Secretaria consulta',email:'secview@exemplo.test',ativo:true,perfil:'secretaria',gerenciar:false,escolas:[]}],
  ['usuarios/espA',{nome:'Especialista A',email:'espA@exemplo.test',ativo:true,perfil:'especialista',gerenciar:false,escolas:['a']}],
  ['usuarios/espB',{nome:'Especialista B',email:'espB@exemplo.test',ativo:true,perfil:'especialista',gerenciar:false,escolas:['b']}],
  ['usuarios/espC',{nome:'Especialista C',email:'espC@exemplo.test',ativo:true,perfil:'especialista',gerenciar:false,escolas:['a']}],
  ['usuarios/dirA',{nome:'Direção A',email:'dirA@exemplo.test',ativo:true,perfil:'direcao',gerenciar:false,escolas:['a']}],
  ['usuarios/pendente',{nome:'Pendente',email:'pendente@exemplo.test',ativo:false,perfil:'pendente',gerenciar:false,escolas:[]}],
  ['escolas/a',{nome:'Escola A',inep:'',telefone:'',endereco:'',email:''}],
  ['escolas/b',{nome:'Escola B',inep:'',telefone:'',endereco:'',email:''}],
  ['alunos/alunoA',{nome:'Aluno fictício A',escola_id:'a',nascimento:'2018-01-01',criado_por:'espA',ativo:true}],
  ['alunos_privado/alunoA',{cpf:'',filiacao:'',telefone:'',endereco:'',escola_id:'a',criado_por:'espA'}],
  ['vinculos/vinculoA',{uid:'espA',escola_id:'a',profissional_id:'profA',cargo:'Especialista',jornada:'20 horas',horarios:[{dia:1,inicio:'08:00',fim:'12:00'}],slots_semana:[64,65,66,67,68,69,70,71],ativo:true}],
  ['vinculos/vinculoC',{uid:'espC',escola_id:'a',profissional_id:'profC',cargo:'Especialista',jornada:'4 horas',horarios:[{dia:1,inicio:'08:00',fim:'12:00'}],slots_semana:[64,65,66,67,68,69,70,71],ativo:true}],
  ['atendimentos/atendimentoA',{escola_id:'a',aluno_id:'alunoA',autor_uid:'espA',autor_nome:'Especialista A',status:'realizado'}],
  ['notas_atendimento/atendimentoA',{escola_id:'a',atendimento_id:'atendimentoA',autor_uid:'espA',texto:'Observação fictícia',revisao:1}]
 ];
 for(const [path,data] of docs)await setDoc(doc(db,path),data);
});


test('gestão pré-autoriza especialista sem precisar do UID e mantém perfil restrito',async()=>{
 const db=contexto('admin'),email='nova.profissional@exemplo.test';
 const convite={
  nome:'Profissional Convidada',email,perfil:'especialista',
  escolas:['a'],ativo:true,criado_por:'admin',criado_em:serverTimestamp()
 };
 await assertSucceeds(setDoc(doc(db,'convites_usuarios',email),convite));
 await assertSucceeds(getDoc(doc(db,'convites_usuarios',email)));
 await assertFails(setDoc(doc(contexto('espA'),'convites_usuarios','indevido@exemplo.test'),convite));
 await assertFails(updateDoc(doc(db,'convites_usuarios',email),{perfil:'superadmin'}));
 await assertFails(updateDoc(doc(db,'convites_usuarios',email),{criado_por:'outro'}));
});
test('somente Google verificado com o e-mail autorizado pode ativar pré-autorização',async()=>{
 const email='nova.profissional@exemplo.test';
 const dados={
  nome:'Profissional Convidada',email,ativo:true,perfil:'especialista',
  escolas:['a'],gerenciar:false,criado_em:serverTimestamp()
 };
 const google=contextoGoogle('novaProfissional',email);
 await assertSucceeds(getDoc(doc(google,'convites_usuarios',email)));
 await assertSucceeds(setDoc(doc(google,'usuarios','novaProfissional'),dados));
 await assertSucceeds(getDoc(doc(google,'usuarios','novaProfissional')));
 const semConvite=contextoGoogle('outraProfissional','sem.convite@exemplo.test');
 await assertFails(setDoc(doc(semConvite,'usuarios','outraProfissional'),{
  ...dados,email:'sem.convite@exemplo.test'
 }));
 const emailErrado=contextoGoogle('impostora','impostora@exemplo.test');
 await assertFails(getDoc(doc(emailErrado,'convites_usuarios',email)));
 await assertFails(setDoc(doc(emailErrado,'usuarios','impostora'),dados));
});
test('convite suspenso não ativa profissional no primeiro acesso',async()=>{
 const email='profissional.bloqueada@exemplo.test',db=contexto('admin');
 await assertSucceeds(setDoc(doc(db,'convites_usuarios',email),{
  nome:'Profissional Suspensa',email,perfil:'especialista',escolas:['a'],
  ativo:false,criado_por:'admin',criado_em:serverTimestamp()
 }));
 const google=contextoGoogle('suspensa',email);
 await assertFails(setDoc(doc(google,'usuarios','suspensa'),{
  nome:'Profissional Suspensa',email,perfil:'especialista',
  ativo:true,escolas:['a'],gerenciar:false,criado_em:serverTimestamp()
 }));
 await assertSucceeds(setDoc(doc(google,'usuarios','suspensa'),{
  nome:'Profissional Suspensa',email,perfil:'pendente',
  ativo:false,escolas:[],gerenciar:false,criado_em:serverTimestamp()
 }));
});

test('gestão pode criar login de homologação com email fictício e perfil especialista',async()=>{
 const registro={
  nome:'Profissional Teste',email:'teste.profissional.a1@seduc-teste.example',
  ativo:true,perfil:'especialista',escolas:['a'],gerenciar:false,
  conta_teste:true,teste_criado_por:'admin',criado_em:serverTimestamp()
 };
 await assertSucceeds(setDoc(doc(contexto('admin'),'usuarios/testeCriadoA'),registro));
 const userDb=contexto('testeCriadoA');
 await assertSucceeds(getDoc(doc(userDb,'usuarios/testeCriadoA')));
 await assertFails(setDoc(doc(contexto('pendente'),'usuarios/testeAutoAtivado'),{
  ...registro,teste_criado_por:'pendente'
 }));
 await assertFails(setDoc(doc(contexto('espA'),'usuarios/testeCriadoFora'),{
  ...registro,teste_criado_por:'espA'
 }));
 await assertFails(setDoc(doc(contexto('admin'),'usuarios/testeAdminProibido'),{
  ...registro,perfil:'superadmin'
 }));
 await assertFails(setDoc(doc(contexto('admin'),'usuarios/testeEmailExterno'),{
  ...registro,email:'alguem@exemplo.com'
 }));
 await assertFails(setDoc(doc(contexto('admin'),'usuarios/testeSemEscola'),{
  ...registro,escolas:[]
 }));
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
test('logs de login são imutáveis e somente a gestão pode consultá-los',async()=>{
 const db=contexto('espA'),registro=doc(db,'acessos_sistema','loginAuditoria01');
 await assertSucceeds(setDoc(registro,{
  uid:'espA',perfil:'especialista',evento:'login_confirmado',em:serverTimestamp()
 }));
 await assertSucceeds(getDoc(doc(contexto('admin'),'acessos_sistema','loginAuditoria01')));
 await assertFails(getDoc(doc(contexto('espA'),'acessos_sistema','loginAuditoria01')));
 await assertFails(setDoc(doc(contexto('espB'),'acessos_sistema','loginImpostor'),{
  uid:'espA',perfil:'especialista',evento:'login_confirmado',em:serverTimestamp()
 }));
 await assertFails(updateDoc(registro,{evento:'outro'}));
 await assertFails(deleteDoc(registro));
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
 batch.set(doc(db,'agendamentos',id,'historico','agendado'),registro);
 await assertSucceeds(batch.commit());
 await assertSucceeds(getDocs(collection(db,'agendamentos',id,'historico')));
 await assertFails(getDocs(collection(contexto('espB'),'agendamentos',id,'historico')));
 await assertFails(updateDoc(doc(db,'agendamentos',id,'historico','agendado'),{acao:'cancelado'}));
 await assertFails(deleteDoc(doc(db,'agendamentos',id,'historico','agendado')));
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
test('especialista vê colega da mesma escola e agenda sem obter permissão clínica',async()=>{
 await assertSucceeds(getDoc(doc(contexto('espA'),'usuarios/espC')));
 await assertFails(getDoc(doc(contexto('espB'),'usuarios/espC')));
 const uid='espC',id='colegaMesmaEscola',inicio=new Date('2027-11-15T12:00:00Z');
 const db=contexto('espA'),batch=writeBatch(db);
 const slot=doc(db,'agenda_slots',slotId(uid,inicio));
 await assertSucceeds(getDoc(slot));
 batch.set(doc(db,'agendamentos',id),{
  ...novoAgendamento(id,inicio),vinculo_id:'vinculoC',
  autor_uid:uid,autor_nome:'Especialista C',agendado_por_uid:'espA'
 });
 batch.set(slot,{autor_uid:uid,escola_id:'a',agendamento_id:id,inicio,status:'reservado'});
 batch.set(doc(db,'agendamentos',id,'historico','agendado'),{
  acao:'agendado',alvo_tipo:'agendamento',alvo_id:id,escola_id:'a',
  aluno_id:'alunoA',autor_uid:'espA',autor_nome:'Especialista A',
  criado_em:serverTimestamp(),situacao_anterior:'',situacao_nova:'agendado'
 });
 await assertSucceeds(batch.commit());
 const ag=await getDoc(doc(db,'agendamentos',id));
 assert.equal(ag.data().autor_uid,'espC');
 assert.equal(ag.data().agendado_por_uid,'espA');
 await assertFails(updateDoc(doc(db,'agendamentos',id),{status:'em_atendimento',iniciado_em:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(contexto(uid),'agendamentos',id),{status:'em_atendimento',iniciado_em:serverTimestamp()}));
 await assertFails(getDoc(doc(contexto('espB'),'agenda_slots',slot.id)));
});
test('admin agenda para especialista habilitada preservando autoria e trava do horario',async()=>{
 const db=contexto('admin'),id='gestaoAgendamento',inicio=new Date('2027-11-08T11:00:00.000Z'),batch=writeBatch(db);
 const d={...novoAgendamento(id,inicio),autor_uid:'espA',autor_nome:'Especialista A',agendado_por_uid:'admin'};
 batch.set(doc(db,'agendamentos',id),d);
 batch.set(doc(db,'agenda_slots',slotId('espA',inicio)),{
  autor_uid:'espA',escola_id:'a',agendamento_id:id,inicio,status:'reservado'
 });
 batch.set(doc(db,'agendamentos',id,'historico','agendado'),{
  acao:'agendado',alvo_tipo:'agendamento',alvo_id:id,escola_id:'a',
  aluno_id:'alunoA',autor_uid:'admin',autor_nome:'Administrador',
  criado_em:serverTimestamp(),situacao_anterior:'',situacao_nova:'agendado'
 });
 await assertSucceeds(batch.commit());
 const salvo=await assertSucceeds(getDoc(doc(db,'agendamentos',id)));
 assert.equal(salvo.data().autor_uid,'espA');
 assert.equal(salvo.data().agendado_por_uid,'admin');
 const prof=contexto('espA');
 await assertSucceeds(updateDoc(doc(prof,'agendamentos',id),{
  status:'em_atendimento',iniciado_em:serverTimestamp()
 }));
});
test('gestao nao pode criar agendamento sem reserva do horario',async()=>{
 const db=contexto('admin'),inicio=new Date('2027-11-22T11:00:00.000Z');
 await assertFails(setDoc(doc(db,'agendamentos/semHorarioGestao'),{
  ...novoAgendamento('semHorarioGestao',inicio),
  autor_uid:'espA',autor_nome:'Especialista A',agendado_por_uid:'admin'
 }));
});
test('contas sem delegacao e profissionais de outra escola nao criam agendas em nome de terceiros',async()=>{
 const inicio=new Date('2027-11-15T11:00:00Z');
 const dados={...novoAgendamento('negadoGestao',inicio),agendado_por_uid:'secview'};
 const db=contexto('secview'),b=writeBatch(db);
 b.set(doc(db,'agendamentos','negadoGestao'),dados);
 b.set(doc(db,'agenda_slots',slotId('espA',inicio)),{
  autor_uid:'espA',escola_id:'a',agendamento_id:'negadoGestao',inicio,status:'reservado'
 });
 await assertFails(b.commit());
 await assertFails(setDoc(doc(contexto('espB'),'agendamentos/forjarAutoria'),{
  ...dados,autor_uid:'espA',agendado_por_uid:'espB'
 }));
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


// Administrative mutations preserve the responsible clinician and are atomic
// with reservations and an immutable actor-specific history record.
async function prepararGestao(rotulo,status='agendado'){
 const uid='espGestao_'+rotulo,id='gestao-'+rotulo,inicio=new Date('2035-01-01T11:00:00Z');
 const dados={escola_id:'a',aluno_id:'aluno-'+id,vinculo_id:'vinculo-'+id,inicio,duracao_min:60,especialidade:'Teste',autor_uid:uid,autor_nome:'Profissional fictícia',criado_em:new Date('2030-01-01'),status};
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  await setDoc(doc(db,'usuarios',uid),{nome:'Profissional fictícia',email:uid+'@exemplo.test',ativo:true,perfil:'especialista',gerenciar:false,escolas:['a']});
  await setDoc(doc(db,'alunos',dados.aluno_id),{nome:'Aluno fictício',escola_id:'a',ativo:true});
  await setDoc(doc(db,'vinculos','vinculo-'+id),{uid,escola_id:'a',profissional_id:'profGestao',cargo:'Especialista',jornada:'Teste',horarios:[],slots_semana:Array.from({length:336},(_,i)=>i),ativo:true});
  await setDoc(doc(db,'agendamentos',id),dados);
  for(const n of [0,30]){const t=new Date(+inicio+n*60000);await setDoc(doc(db,'agenda_slots',uid+'_'+(+t)),{autor_uid:uid,escola_id:'a',agendamento_id:id,inicio:t,status:'reservado'});}
 });return{id,dados,uid,inicio};
}
function eventoGestao(b,db,id,acao,uid,anterior,atual,aluno){
 b.set(doc(db,'agendamentos',id,'historico',acao),{acao,alvo_tipo:'agendamento',alvo_id:id,escola_id:'a',aluno_id:aluno,autor_uid:uid,autor_nome:'Ator fictício',criado_em:serverTimestamp(),situacao_anterior:anterior,situacao_nova:atual});
}
function cancelarPelaGestao(f,uid,{motivo='Pedido da família',auditar=true}={}){
 const db=contexto(uid),b=writeBatch(db);
 b.update(doc(db,'agendamentos',f.id),{status:'cancelado',motivo_cancelamento:motivo,cancelado_em:serverTimestamp(),alterado_por_uid:uid});
 for(const n of [0,30])b.update(doc(db,'agenda_slots',f.uid+'_'+(+f.inicio+n*60000)),{status:'liberado'});
 if(auditar)eventoGestao(b,db,f.id,'cancelado',uid,'agendado','cancelado',f.dados.aluno_id);
 return b.commit();
}
test('admin cancela consulta de outra profissional com motivo, histórico e liberação dos horários',async()=>{
 const f=await prepararGestao('cancelar');await assertSucceeds(cancelarPelaGestao(f,'admin'));
 const salvo=(await getDoc(doc(contexto('admin'),'agendamentos',f.id))).data();assert.equal(salvo.autor_uid,f.uid);assert.equal(salvo.alterado_por_uid,'admin');
 assert.equal((await getDoc(doc(contexto('admin'),'agendamentos',f.id,'historico','cancelado'))).data().autor_uid,'admin');
 await assertFails(deleteDoc(doc(contexto('admin'),'agendamentos',f.id)));
});
test('secretaria delegada cancela; secretaria sem delegação e especialista de outra conta não cancelam',async()=>{
 await assertSucceeds(cancelarPelaGestao(await prepararGestao('sec'),'sec'));
 await assertFails(cancelarPelaGestao(await prepararGestao('secview'),'secview'));
 await assertFails(cancelarPelaGestao(await prepararGestao('outra'),'espC'));
});
test('gestão não cancela sem motivo, sem auditoria, consulta iniciada ou realizada',async()=>{
 await assertFails(cancelarPelaGestao(await prepararGestao('sem-motivo'),'admin',{motivo:''}));
 await assertFails(cancelarPelaGestao(await prepararGestao('sem-auditoria'),'admin',{auditar:false}));
 await assertFails(cancelarPelaGestao(await prepararGestao('iniciada','em_atendimento'),'admin'));
 await assertFails(cancelarPelaGestao(await prepararGestao('realizada','realizado'),'admin'));
});
test('gestão não libera slot isolado e não inicia atendimento de outra profissional',async()=>{
 const f=await prepararGestao('sem-mudanca');const db=contexto('admin');
 await assertFails(updateDoc(doc(db,'agenda_slots',f.uid+'_'+(+f.inicio)),{status:'liberado'}));
 await assertFails(updateDoc(doc(db,'agendamentos',f.id),{status:'em_atendimento',iniciado_em:serverTimestamp()}));
});
async function remarcarPelaGestao(f,uid,{trocarAutor=false,ocupar=false}={}){
 const db=contexto(uid),novoId=f.id+'-novo',inicio=new Date('2035-01-02T11:00:00Z');
 if(ocupar)await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'agenda_slots',f.uid+'_'+(+inicio)),{autor_uid:f.uid,escola_id:'a',agendamento_id:'outra-consulta',inicio,status:'reservado'}));
 const b=writeBatch(db);
 b.update(doc(db,'agendamentos',f.id),{status:'remarcado',novo_agendamento_id:novoId,remarcado_em:serverTimestamp(),motivo_remarcacao:'Pedido da família',alterado_por_uid:uid});
 for(const n of [0,30])b.update(doc(db,'agenda_slots',f.uid+'_'+(+f.inicio+n*60000)),{status:'liberado'});
 const autor=trocarAutor?'espC':f.uid;
 b.set(doc(db,'agendamentos',novoId),{...f.dados,inicio,autor_uid:autor,criado_em:serverTimestamp(),status:'agendado',remarcado_de:f.id,agendado_por_uid:uid});
 for(const n of [0,30]){const t=new Date(+inicio+n*60000);b.set(doc(db,'agenda_slots',autor+'_'+(+t)),{autor_uid:autor,escola_id:'a',agendamento_id:novoId,inicio:t,status:'reservado'});}
 eventoGestao(b,db,f.id,'reagendado',uid,'agendado','remarcado',f.dados.aluno_id);eventoGestao(b,db,novoId,'agendado',uid,'','agendado',f.dados.aluno_id);
 return b.commit();
}
test('admin e secretaria delegada remarcam mantendo responsável e auditando o ator',async()=>{
 for(const uid of ['admin','sec']){const f=await prepararGestao('remarcar-'+uid);await assertSucceeds(remarcarPelaGestao(f,uid));const salvo=(await getDoc(doc(contexto(uid),'agendamentos',f.id+'-novo'))).data();assert.equal(salvo.autor_uid,f.uid);assert.equal(salvo.agendado_por_uid,uid);}
});
test('remarcação administrativa não troca autora, não aceita conflito nem perfil sem delegação',async()=>{
 await assertFails(remarcarPelaGestao(await prepararGestao('troca-autora'),'admin',{trocarAutor:true}));
 await assertFails(remarcarPelaGestao(await prepararGestao('conflito'),'admin',{ocupar:true}));
 await assertFails(remarcarPelaGestao(await prepararGestao('remarcar-negado'),'secview'));
});
