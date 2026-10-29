const operacao=['Painel','Alunos','Agenda','Atendimentos','Tutorial'];
const gestao=['Painel','Escolas','Profissionais','Alunos','Agenda','Atendimentos','Frequência','Relatórios','Servidores','Usuários','Auditoria','Tutorial'];
export function paginasPermitidas(p){
 if(!p?.ativo||p.excluido)return [];
 if(p.perfil==='superadmin')return [...gestao];
 if(p.perfil==='especialista')return [...operacao];
 if(p.perfil==='secretaria')return p.gerenciar?[...gestao]:gestao.filter(n=>!['Usuários','Servidores','Auditoria','Frequência'].includes(n));
 if(p.perfil==='direcao')return [...operacao,'Relatórios'];
 if(p.perfil==='visualizador')return ['Painel','Relatórios','Tutorial'];
 return [];
}
export function podeAbrirPagina(p,pagina){return pagina==='Ficha do aluno'?paginasPermitidas(p).includes('Alunos'):paginasPermitidas(p).includes(pagina);}
export function cacheVazio(){return Object.fromEntries(['escolas','profissionais','vinculos','alunos','agendamentos','atendimentos','notas_atendimento','usuarios','convites_usuarios','frequencias','servidores','alunos_necessidades','relatorios_alunos','metas_alunos','revisoes_metas','alunos_diagnosticos','consultas_excluidas','matriculas_atuais'].map(k=>[k,[]]));}
