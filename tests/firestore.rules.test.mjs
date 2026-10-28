import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc,collection,getDocs,writeBatch,serverTimestamp} from 'firebase/firestore';

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
  ['vinculos/vinculoA',{uid:'espA',escola_id:'a',profissional_id:'profA',cargo:'Especialista',jornada:'20 horas',horarios:[{dia:1,inicio:'08:00',fim:'12:00'}],ativo:true}],
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
 const ref=doc(db,'frequencias/espA_a_2026-10-28');
 await assertSucceeds(setDoc(ref,{
  uid:'espA',escola_id:'a',vinculo_id:'vinculoA',
  dia:'2026-10-28',entrada:serverTimestamp(),saida:null,status:'aberta'
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
