// Leitura e validação do arquivo local de servidores da Educação.
// Nenhum dado pessoal é enviado a GitHub ou outro serviço nesta etapa.
export const escolasImportacao = Object.freeze({
 'ESCOLA MUNICIPAL DR. JOÃO DE SOUZA LIMA': {id:'doutor-joao-souza-lima',nome:'Escola Municipal Doutor João de Souza Lima',tipo:'escola'},
 'ESCOLA MUNICIPAL PROFESSORA WILMA GLÓRIA NUNES MOURÃO': {id:'creche-wilma-gloria',nome:'Creche Municipal Wilma Glória Nunes Mourão',tipo:'creche'},
 'CRECHE SEBASTIANA DUARTE CABRAL': {id:'creche-sebastiana-duarte-cabral',nome:'Creche Sebastiana Duarte Cabral',tipo:'creche'},
 'ESCOLA MUNICIPAL PROFESSORA TEREZINHA SARMENTO DE OLIVEIRA': {id:'professora-terezinha-sarmento',nome:'Escola Municipal Professora Terezinha Sarmento de Oliveira',tipo:'escola'},
 'ESCOLA MUNICIPAL PREFEITO JOSÉ PEDRO DA SILVA': {id:'prefeito-jose-pedro',nome:'Escola Municipal Prefeito José Pedro da Silva',tipo:'escola'},
 'ESCOLA MUNICIPAL MONTEIRO LOBATO': {id:'monteiro-lobato',nome:'Escola Municipal Monteiro Lobato',tipo:'escola'}
});
export function conferirImportacao(dados) {
 if(!dados || dados.esquema!=='seduc_servidores_v2' || !Array.isArray(dados.servidores))throw Error('Arquivo de importação incompatível. Use o JSON revisado fornecido para o SEDUC.');
 if(dados.servidores.length<1 || dados.servidores.length>1000)throw Error('Quantidade de registros inválida.');
 const ids=new Set(),contagens={},records=[];
 for(const registro of dados.servidores){
  const escola=escolasImportacao[registro.escola_origem];
  if(!escola || registro.escola_id!==escola.id)throw Error('Instituição não reconhecida no arquivo.');
  if(typeof registro.id!=='string' || !/^srv_[a-z0-9]{12,80}$/.test(registro.id) || ids.has(registro.id))throw Error('Identificador duplicado ou inválido.');
  if(typeof registro.nome!=='string' || registro.nome.trim().length<3 || registro.nome.length>180)throw Error('Nome de servidor ausente ou inválido.');
  if(typeof registro.cargo!=='string'||registro.cargo.length>180)throw Error('Cargo inválido.');
  if(Number(registro.ano)!==2026)throw Error('Ano do registro diferente de 2026.');
  for(const c of ['celular','telefone']) if(registro[c]!=null && typeof registro[c]!=='string')throw Error('Contato inválido.');
  ids.add(registro.id);
  contagens[escola.id]=(contagens[escola.id]||0)+1;
  records.push({
   id:registro.id,
   publico:{nome:registro.nome.trim(),cargo:registro.cargo.trim(),escola_id:escola.id,ano:2026,escola_origem:registro.escola_origem,linha_origem:Number(registro.linha_origem)||0,ativo:true},
   privado:{celular:registro.celular||'',telefone:registro.telefone||'',escola_id:escola.id}
  });
 }
 return {registros:records,total:records.length,contagens,escolas:Object.values(escolasImportacao)};
}
