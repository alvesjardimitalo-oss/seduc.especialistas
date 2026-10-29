// Sínteses determinísticas: não inferem diagnósticos nem evolução clínica por linguagem livre.
export const dataRegistro=x=>{
 if(!x)return 0;
 if(typeof x.toMillis==='function')return x.toMillis();
 if(typeof x.toDate==='function')return x.toDate().getTime();
 if(typeof x.seconds==='number')return x.seconds*1000;
 const valor=x instanceof Date?x.getTime():new Date(x).getTime();
 return Number.isFinite(valor)?valor:0;
};
export const etiquetasEvolucao=Object.freeze({
 nao_avaliada:'Não avaliada',
 avanco_observado:'Avanço observado pela profissional',
 sem_mudanca_observada:'Sem mudança observada',
 reavaliacao_necessaria:'Reavaliação necessária'
});
export function resumirAluno(alunoId,atendimentos=[],agendamentos=[],revisoes=[]){
 const consultas=atendimentos.filter(x=>x.aluno_id===alunoId&&x.status==='realizado');
 const agenda=agendamentos.filter(x=>x.aluno_id===alunoId);
 const faltas=agenda.filter(x=>x.status==='falta_aluno'||x.status==='falta_profissional');
 const avaliacoes=consultas.filter(x=>x.evolucao_observada&&x.evolucao_observada!=='nao_avaliada');
 const avancos=avaliacoes.filter(x=>x.evolucao_observada==='avanco_observado').length;
 const semMudanca=avaliacoes.filter(x=>x.evolucao_observada==='sem_mudanca_observada').length;
 const reavaliacao=avaliacoes.filter(x=>x.evolucao_observada==='reavaliacao_necessaria').length;
 const revisoesAluno=revisoes.filter(x=>x.aluno_id===alunoId);
 const metasAtingidas=revisoesAluno.filter(x=>x.status==='atingida').length;
 const profissionais=[...new Set([...consultas,...agenda].map(x=>x.autor_nome||x.autor_uid).filter(Boolean))];
 const especialidades=[...new Set([...consultas,...agenda].map(x=>x.especialidade).filter(Boolean))];
 const datas=consultas.map(x=>dataRegistro(x.data||x.inicio)).filter(Boolean);
 return {
  consultas:consultas.length,faltasAluno:faltas.filter(x=>x.status==='falta_aluno').length,
  faltasProfissional:faltas.filter(x=>x.status==='falta_profissional').length,
  agendados:agenda.filter(x=>x.status==='agendado').length,
  emAtendimento:agenda.filter(x=>x.status==='em_atendimento').length,
  remarcados:agenda.filter(x=>x.status==='remarcado'||Boolean(x.novo_agendamento_id)).length,
  ultimaConsulta:datas.length?Math.max(...datas):null,
  primeiraConsulta:datas.length?Math.min(...datas):null,
  profissionais,especialidades,
  evolucao:{avaliacoes:avaliacoes.length,avancos,semMudanca,reavaliacao,metasAtingidas,revisoes:revisoesAluno.length,
   descricao:!avaliacoes.length&&!revisoesAluno.length
    ?'Sem evolução documentada por avaliação profissional. A quantidade de consultas não permite concluir se houve progresso.'
    :'Evolução baseada exclusivamente nas classificações preenchidas por profissionais e nas revisões de metas registradas.'}
 };
}
export function agruparConsultasPorAluno(atendimentos=[],alunos=[],agendamentos=[],revisoes=[]){
 const grupos=new Map();
 for(const a of atendimentos){
  if(!a.aluno_id)continue;
  if(!grupos.has(a.aluno_id))grupos.set(a.aluno_id,[]);
  grupos.get(a.aluno_id).push(a);
 }
 return [...grupos].map(([id,consultas])=>({
  alunoId:id,aluno:alunos.find(a=>a.id===id)||{id,nome:'Aluno não disponível'},
  consultas:consultas.sort((a,b)=>dataRegistro(b.data||b.inicio)-dataRegistro(a.data||a.inicio)),
  resumo:resumirAluno(id,atendimentos,agendamentos,revisoes)
 })).sort((a,b)=>a.aluno.nome.localeCompare(b.aluno.nome,'pt-BR'));
}
