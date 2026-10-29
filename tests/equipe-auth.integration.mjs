// Integration against local Auth + Firestore emulators. No real accounts or data.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,collection,getDocs,query,where,writeBatch,runTransaction,updateDoc,deleteDoc,serverTimestamp} from 'firebase/firestore';
const projectId='demo-seduc-tests',results=[];
const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const app=initializeApp({projectId,apiKey:'fake-emulator-key',authDomain:projectId+'.firebaseapp.com'},'equipe-auth');
const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
const senha='TesteLocal!2026',contas={};
async function check(nome,fn){await fn();results.push({teste:nome,resultado:'aprovado'});console.log('PASS '+nome);}
async function negado(p){await assert.rejects(p,e=>e.code==='permission-denied');}
try{
 for(const [nome,perfil,ativo,escolas] of [['especialista','especialista',true,['equipe-a']],['colega','especialista',true,['equipe-a']],['outra','especialista',true,['equipe-b']],['admin','superadmin',true,[]],['pendente','pendente',false,[]],['desativada','especialista',false,['equipe-a']]]){
  const email=nome+'.equipe@seduc-teste.example';let usuario;
  try{usuario=(await createUserWithEmailAndPassword(auth,email,senha)).user;}catch(e){if(e.code!=='auth/email-already-in-use')throw e;usuario=(await signInWithEmailAndPassword(auth,email,senha)).user;}
  contas[nome]={uid:usuario.uid,email,perfil,ativo,escolas};await signOut(auth);
 }
 const horarios=Array.from({length:7},(_,dia)=>({dia,inicio:'07:00',fim:'17:00'}));
 await env.withSecurityRulesDisabled(async c=>{
  const raw=c.firestore();
  for(const [nome,u] of Object.entries(contas)){
   await setDoc(doc(raw,'usuarios',u.uid),{nome:'Equipe '+nome,email:u.email,perfil:u.perfil,ativo:u.ativo,escolas:u.escolas,gerenciar:u.perfil==='superadmin'});
   await setDoc(doc(raw,'termos_aceites',u.uid+'_2026-10-28-v1'),{uid:u.uid,versao:'2026-10-28-v1',aceito_em:new Date()});
  }
  for(const id of ['a','b']){
   const uid=contas[id==='a'?'especialista':'outra'].uid;
   await setDoc(doc(raw,'escolas','equipe-'+id),{nome:'Escola Fictícia '+id.toUpperCase(),tipo:'escola'});
   await setDoc(doc(raw,'alunos','equipe-aluno-'+id),{nome:'Aluno Fictício '+id.toUpperCase(),escola_id:'equipe-'+id,ativo:true,nascimento:'2017-01-01',criado_por:uid});
   await setDoc(doc(raw,'profissionais','equipe-prof-'+id),{nome:'Profissional Fictícia '+id.toUpperCase(),especialidade:'Psicopedagogia',uid,escolas:['equipe-'+id]});
   await setDoc(doc(raw,'vinculos','equipe-vinculo-'+id),{profissional_id:'equipe-prof-'+id,uid,escola_id:'equipe-'+id,cargo:'Psicopedagogia',jornada:'70 horas',horarios,slots_semana:horarios.flatMap(h=>Array.from({length:20},(_,i)=>h.dia*48+14+i)),ativo:true});
  }
  await setDoc(doc(raw,'vinculos','equipe-vinculo-colega'),{profissional_id:'equipe-prof-colega',uid:contas.colega.uid,escola_id:'equipe-a',cargo:'Fonoaudiologia',jornada:'70 horas',horarios,slots_semana:horarios.flatMap(h=>Array.from({length:20},(_,i)=>h.dia*48+14+i)),ativo:true});
 });
 await check('login rejeita senha incorreta',()=>assert.rejects(signInWithEmailAndPassword(auth,contas.especialista.email,'SenhaErrada!')));
 await check('login válido consulta somente escola autorizada',async()=>{
  await signInWithEmailAndPassword(auth,contas.especialista.email,senha);
  assert.equal((await getDoc(doc(db,'usuarios',auth.currentUser.uid))).data().ativo,true);
  assert.equal((await getDocs(query(collection(db,'alunos'),where('escola_id','==','equipe-a')))).size,1);
  await negado(getDoc(doc(db,'alunos','equipe-aluno-b')));await negado(getDocs(collection(db,'usuarios')));
 });
 const uid=contas.especialista.uid,inicio=new Date('2035-01-08T13:00:00Z'),id='equipe-agendada',at='agenda_'+id;
 const dados={aluno_id:'equipe-aluno-a',escola_id:'equipe-a',vinculo_id:'equipe-vinculo-a',inicio,duracao_min:30,especialidade:'Psicopedagogia',autor_uid:uid,autor_nome:'Equipe especialista',criado_em:serverTimestamp(),status:'agendado'};
 await env.withSecurityRulesDisabled(async c=>{for(const caminho of ['agendamentos/'+id,'agenda_slots/'+uid+'_'+inicio.getTime(),'atendimentos/'+at,'notas_atendimento/'+at])await deleteDoc(doc(c.firestore(),caminho));});
 await check('agendamento reserva horário atomicamente',async()=>{
  const b=writeBatch(db);b.set(doc(db,'agendamentos',id),dados);b.set(doc(db,'agenda_slots',uid+'_'+inicio.getTime()),{autor_uid:uid,escola_id:'equipe-a',agendamento_id:id,inicio,status:'reservado'});await b.commit();
 });
 await check('início antecipado preserva horário agendado',async()=>{
  await updateDoc(doc(db,'agendamentos',id),{status:'em_atendimento',iniciado_em:serverTimestamp()});
  const a=(await getDoc(doc(db,'agendamentos',id))).data();assert.ok(a.iniciado_em.toMillis()<inicio.getTime());assert.equal(a.inicio.toMillis(),inicio.getTime());
 });
 await check('outra conta não acessa nem conclui a consulta',async()=>{
  await signOut(auth);await signInWithEmailAndPassword(auth,contas.outra.email,senha);
  await negado(getDoc(doc(db,'agendamentos',id)));await negado(updateDoc(doc(db,'agendamentos',id),{status:'realizado'}));
  await signOut(auth);await signInWithEmailAndPassword(auth,contas.especialista.email,senha);
 });
 await check('conclusão grava consulta e nota em conjunto',async()=>{
  const b=writeBatch(db);b.update(doc(db,'agendamentos',id),{status:'realizado',finalizado_em:serverTimestamp(),atendimento_id:at});
  const {status,criado_em,...base}=dados;b.set(doc(db,'atendimentos',at),{...base,criado_em:serverTimestamp(),data:serverTimestamp(),status:'realizado',agendamento_id:id,evolucao_observada:'avanco_observado'});
  b.set(doc(db,'notas_atendimento',at),{escola_id:'equipe-a',atendimento_id:at,autor_uid:uid,texto:'Motivo / objetivo:\nConsulta fictícia de acompanhamento\n\nAtividades e procedimentos:\nLeitura e jogo de palavras, exclusivamente para teste.\n\nObservações e resposta:\nParticipação simulada com apoio.\n\nOrientações e encaminhamentos:\nRetomar a leitura e conferir o registro da outra especialidade.',revisao:1});await b.commit();
  assert.equal((await getDoc(doc(db,'atendimentos',at))).data().status,'realizado');
 });
 await check('matrícula atual salva turma, turno e professor com histórico versionado',async()=>{
  const ref=doc(db,'matriculas_atuais','equipe-aluno-a');
  await runTransaction(db,async tx=>{const anterior=await tx.get(ref),revisao=anterior.exists()?anterior.data().revisao+1:1;
   const m={aluno_id:'equipe-aluno-a',escola_id:'equipe-a',numero:'LOCAL-A',ano_letivo:2026,turma:'4º A',turno:'manha',professor:'Professora Fictícia',revisao,atualizado_por:uid,atualizado_em:serverTimestamp()};tx.set(ref,m);tx.set(doc(db,'matriculas_atuais','equipe-aluno-a','historico',String(revisao)),m);});
  assert.equal((await getDoc(ref)).data().professor,'Professora Fictícia');
 });
 await check('consultório reúne atendimentos de dois especialistas autorizados',async()=>{
  await signOut(auth);await signInWithEmailAndPassword(auth,contas.colega.email,senha);
  const b=writeBatch(db),ref=doc(collection(db,'atendimentos'));
  b.set(ref,{aluno_id:'equipe-aluno-a',escola_id:'equipe-a',vinculo_id:'equipe-vinculo-colega',autor_uid:contas.colega.uid,autor_nome:'Equipe colega',inicio:new Date(),data:new Date(),duracao_min:30,especialidade:'Fonoaudiologia',criado_em:serverTimestamp(),status:'realizado'});
  b.set(doc(db,'notas_atendimento',ref.id),{escola_id:'equipe-a',atendimento_id:ref.id,autor_uid:contas.colega.uid,texto:'Atendimento fictício de outra especialidade.',revisao:1});await b.commit();
  await signOut(auth);await signInWithEmailAndPassword(auth,contas.especialista.email,senha);
  const lista=await getDocs(query(collection(db,'atendimentos'),where('escola_id','==','equipe-a')));assert.ok(lista.docs.some(d=>d.data().autor_uid===contas.colega.uid));assert.ok(lista.docs.some(d=>d.data().autor_uid===uid));
 });
 await check('contas pendente e desativada não listam alunos',async()=>{
  for(const nome of ['pendente','desativada']){await signOut(auth);await signInWithEmailAndPassword(auth,contas[nome].email,senha);await negado(getDocs(query(collection(db,'alunos'),where('escola_id','==','equipe-a'))));}
 });
 await check('logout remove credencial e bloqueia leitura',async()=>{await signOut(auth);assert.equal(auth.currentUser,null);await negado(getDoc(doc(db,'alunos','equipe-aluno-a')));});
 mkdirSync(new URL('../.test-results/',import.meta.url),{recursive:true});
 writeFileSync(new URL('../.test-results/equipe-auth.json',import.meta.url),JSON.stringify({ambiente:'emuladores locais',resultados:results},null,2));
 console.log('AUTH INTEGRATION: '+results.length+' cenários aprovados');
}finally{await signOut(auth);await deleteApp(app);await env.cleanup();}
