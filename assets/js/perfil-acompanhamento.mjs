import {consultasDoAluno,filtrarConsultas} from './aluno-historico.mjs';
export const podeExcluirConsulta=(perfil,uid,r)=>Boolean(perfil?.ativo&&(perfil.perfil==='superadmin'||(perfil.perfil==='especialista'&&r.autor_uid===uid)));
export const consultaEncerrada=r=>['cancelado','realizado','remarcado','falta_aluno','falta_profissional'].includes(r.status);
export function aplicarExclusoes(cache){
 const excluidas=(cache.consultas_excluidas||[]).filter(e=>e.ativo);
 const ids=new Set(excluidas.filter(e=>e.tipo==='agendamentos').map(e=>e.registro_id));
 const visitas=new Set(excluidas.filter(e=>e.tipo==='atendimentos').map(e=>e.registro_id));
 return {...cache,agendamentos:cache.agendamentos.filter(r=>!ids.has(r.id)&&!visitas.has(r.atendimento_id)),atendimentos:cache.atendimentos.filter(r=>!visitas.has(r.id)&&!ids.has(r.agendamento_id))};
}
export function consultasUnificadas(id,atendimentos=[],agenda=[],f={}){
 const ligadas=new Set(atendimentos.filter(a=>a.agendamento_id).map(a=>a.agendamento_id));
 return consultasDoAluno(id,atendimentos,agenda.filter(a=>!ligadas.has(a.id)),f);
}
export function perfisAcompanhados(alunos,atendimentos,agenda,f={}){
 const visitas=filtrarConsultas(atendimentos,alunos,f),agendamentos=filtrarConsultas(agenda,alunos,f);
 const ids=new Set([...visitas,...agendamentos].map(r=>r.aluno_id));
 return alunos.filter(a=>ids.has(a.id)).map(aluno=>({aluno,consultas:consultasUnificadas(aluno.id,visitas,agendamentos)})).sort((a,b)=>a.aluno.nome.localeCompare(b.aluno.nome,'pt-BR'));
}
