// Indicadores calculados apenas sobre os registros já autorizados da sessão.
const municipal = new Intl.DateTimeFormat('en-CA', {
 timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'
});
export function diaMunicipal(valor){
 const data=valor?.toDate?valor.toDate():new Date(valor);
 if(valor==null||!Number.isFinite(data.getTime()))return '';
 const partes=Object.fromEntries(municipal.formatToParts(data).map(p=>[p.type,p.value]));
 return partes.year+'-'+partes.month+'-'+partes.day;
}
export function filtrarRegistros(registros,filtros={}){
 if(filtros.de&&filtros.ate&&filtros.de>filtros.ate)throw Error('A data final deve ser igual ou posterior à inicial.');
 return registros.filter(r=>{
  if(filtros.aluno&&r.aluno_id!==filtros.aluno)return false;
  if(filtros.escola&&r.escola_id!==filtros.escola)return false;
  if(filtros.profissional&&r.autor_uid!==filtros.profissional)return false;
  if(filtros.especialidade&&r.especialidade!==filtros.especialidade)return false;
  if(filtros.de||filtros.ate){
   const dia=diaMunicipal(r.data??r.inicio);
   if(!dia||(filtros.de&&dia<filtros.de)||(filtros.ate&&dia>filtros.ate))return false;
  }
  return true;
 });
}
export function resumirRelatorio(atendimentos,agendamentos,filtros={}){
 const visitas=filtrarRegistros(atendimentos,filtros);
 const agenda=filtrarRegistros(agendamentos,filtros);
 const realizados=visitas.filter(a=>a.status==='realizado');
 return {
  realizados:realizados.length,
  alunos:new Set(realizados.map(a=>a.aluno_id).filter(Boolean)).size,
  agendados:agenda.filter(a=>a.status==='agendado').length,
  faltas:agenda.filter(a=>a.status==='falta_aluno').length
 };
}
