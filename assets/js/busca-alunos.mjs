// Busca local dos alunos já autorizados e carregados pelo Firestore.
// O filtro por escola é obrigatório para evitar selecionar alunos de outra instituição.
export function normalizarBuscaAluno(valor=''){
 return String(valor??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
}
export function buscarAlunosDisponiveis(alunos=[],escolaId='',termo='',limite=10){
 if(!escolaId)return {total:0,alunos:[]};
 const palavras=normalizarBuscaAluno(termo).split(' ').filter(Boolean);
 const correspondentes=alunos.filter(a=>{
  if(a.escola_id!==escolaId||a.ativo===false)return false;
  const nome=normalizarBuscaAluno(a.nome);
  const matricula=normalizarBuscaAluno(a.matricula);
  return palavras.every(p=>nome.includes(p)||matricula.includes(p));
 }).sort((a,b)=>String(a.nome??'').localeCompare(String(b.nome??''),'pt-BR'));
 return {total:correspondentes.length,alunos:correspondentes.slice(0,Math.max(1,Math.min(30,Number(limite)||10)))};
}
