// Combina o quadro importado com as fichas profissionais sem transformar
// servidores administrativos automaticamente em especialistas de atendimento.
export function montarListaProfissionais(servidores=[],profissionais=[],vinculos=[],escolas=[]){
 const porId=new Map(profissionais.map(p=>[p.id,p]));
 const resultado=servidores.map(s=>{
  const p=porId.get(s.id);
  const autorizados=p?vinculos.filter(v=>v.profissional_id===p.id&&v.ativo===true):[];
  return {
   id:s.id,nome:s.nome,cargo:s.cargo||'',escola_id:s.escola_id,
   origem:'servidor',profissional_id:p?.id||null,especialidade:p?.especialidade||'',
   habilitado:autorizados.length>0,
   vinculos:autorizados
  };
 });
 const ids=new Set(servidores.map(s=>s.id));
 for(const p of profissionais){
  if(ids.has(p.id))continue;
  const relacionados=vinculos.filter(v=>v.profissional_id===p.id&&v.ativo===true);
  resultado.push({
   id:p.id,nome:p.nome,cargo:'',escola_id:relacionados[0]?.escola_id||p.escolas?.[0]||'',
   origem:'profissional',profissional_id:p.id,especialidade:p.especialidade||'',
   habilitado:relacionados.length>0,vinculos:relacionados
  });
 }
 return resultado.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')||a.id.localeCompare(b.id));
}
