import {diaMunicipal} from './relatorios.mjs';
export const estadosMeta=Object.freeze({definida:'Definida',em_desenvolvimento:'Em desenvolvimento',atingida:'Atingida',revisar:'Requer revisão'});
const ms=v=>{const d=v?.toDate?v.toDate():new Date(v);return Number.isFinite(d.getTime())?d.getTime():0};
export function metasAtuais(metas=[],revisoes=[]){
 const substituidas=new Set(metas.map(m=>m.substitui_id).filter(Boolean));
 return metas.filter(m=>!substituidas.has(m.id)).map(m=>{
  const historico=revisoes.filter(r=>r.meta_id===m.id).slice().sort((a,b)=>ms(b.criado_em)-ms(a.criado_em)||String(b.id).localeCompare(String(a.id)));
  return {...m,status:historico[0]?.status||'definida',revisoes:historico};
 });
}
export function indicadoresConsultas(atendimentos=[],agendamentos=[]){
 const realizados=atendimentos.filter(r=>r.status==='realizado');
 const agrupar=(items,chave)=>{const mapa=new Map();for(const r of items){const c=chave(r);if(c)mapa.set(c,(mapa.get(c)||0)+1)}return [...mapa].map(([rotulo,total])=>({rotulo,total})).sort((a,b)=>a.rotulo.localeCompare(b.rotulo,'pt-BR'))};
 return {
  meses:agrupar(realizados,r=>diaMunicipal(r.inicio??r.data).slice(0,7)),
  especialidades:agrupar(realizados,r=>r.especialidade||'Não informada'),
  profissionais:[...new Set(realizados.map(r=>r.autor_uid).filter(Boolean))].map(uid=>({
   uid,rotulo:realizados.find(r=>r.autor_uid===uid)?.autor_nome||'Profissional',
   total:realizados.filter(r=>r.autor_uid===uid).length
  })).sort((a,b)=>b.total-a.total||a.rotulo.localeCompare(b.rotulo,'pt-BR')),
  realizados:realizados.length,
  faltas:agendamentos.filter(r=>r.status==='falta_aluno').length
 };
}
export function analisarAcompanhamento(metas=[],revisoes=[],agendamentos=[],agora=new Date()){
 const atuais=metasAtuais(metas,revisoes);
 const alertas=[];
 if(!atuais.length)alertas.push('Ainda não há metas individuais registradas. A equipe e a Secretaria podem definir o ponto de partida e o critério de alcance.');
 const atrasadas=atuais.filter(m=>m.status!=='atingida'&&ms(m.prazo)<ms(agora));
 if(atrasadas.length)alertas.push(atrasadas.length+' meta(s) com prazo de revisão vencido. Conferir evidências e reavaliar o plano.');
 const semRevisao=atuais.filter(m=>!m.revisoes.length);
 if(semRevisao.length)alertas.push(semRevisao.length+' meta(s) sem registro de evolução. Registrar evidências antes de concluir sobre o desenvolvimento.');
 const faltas=agendamentos.filter(r=>r.status==='falta_aluno').length;
 if(faltas)alertas.push(faltas+' ausência(s) registrada(s). A equipe pode verificar barreiras de acesso e necessidade de reagendamento.');
 if(!alertas.length)alertas.push('Nenhuma pendência identificada pelos critérios registrados. A análise profissional continua necessária.');
 return {metas:atuais,alertas,estados:Object.entries(estadosMeta).map(([id,rotulo])=>({id,rotulo,total:atuais.filter(m=>m.status===id).length}))};
}
export function validarMeta(d){
 const campos={titulo:150,linha_base:1000,criterio:1000};
 const r={};
 for(const [k,limite]of Object.entries(campos)){
  if(typeof d[k]!=='string'||!d[k].trim()||d[k].trim().length>limite)throw Error('Preencha '+k+' com até '+limite+' caracteres.');
  r[k]=d[k].trim();
 }
 const prazo=new Date(d.prazo);
 if(!Number.isFinite(prazo.getTime()))throw Error('Informe uma data de revisão válida.');
 return {...r,prazo};
}
