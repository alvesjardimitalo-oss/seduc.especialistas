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

export function nomeComparavel(x){
 return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/\b(escola|municipal|creche|professora|professor|doutor|dr)\b/g,' ')
 .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}
export function encontrarEscola(canonica, cadastradas){
 const canonical=Object.values(escolasImportacao).find(x=>x.id===canonica);
 if(!canonical)return '';
 const igual=cadastradas.find(e=>e.id===canonica);
 if(igual)return igual.id;
 const normal=nomeComparavel(canonical.nome);
 const aproximadas=cadastradas.filter(e=>{
  const n=nomeComparavel(e.nome);
  if(canonica==='creche-wilma-gloria')return n.includes('wilma gloria');
  if(canonica==='creche-sebastiana-duarte-cabral')return n.includes('sebastiana duarte');
  if(canonica==='doutor-joao-souza-lima')return n.includes('joao')&&n.includes('souza lima');
  if(canonica==='professora-terezinha-sarmento')return n.includes('terezinha')&&n.includes('sarmento');
  if(canonica==='prefeito-jose-pedro')return n.includes('jose pedro')&&n.includes('silva');
  if(canonica==='monteiro-lobato')return n.includes('monteiro lobato');
  return n===normal;
 });
 return aproximadas.length===1?aproximadas[0].id:'';
}
export const escolasAlunosEspeciais=Object.freeze({
 'ESCOLA MUNICIPAL DR. JOÃO DE SOUZA LIMA':'doutor-joao-souza-lima',
 'ESCOLA MUNICIPAL PROFESSORA WILMA GLÓRIA NUNES MOURÃO':'creche-wilma-gloria',
 'CRECHE SEBASTIANA DUARTE CABRAL':'creche-sebastiana-duarte-cabral',
 'ESCOLA MUNICIPAL PROFESSORA TEREZINHA SARMENTO DE OLIVEIRA':'professora-terezinha-sarmento'
});
export function conferirAlunosEspeciais(dados){
 if(!dados||dados.esquema!=='seduc_alunos_especiais_v1'||!Array.isArray(dados.alunos))
  throw Error('Arquivo incompatível. Use o JSON privado de alunos 2026.');
 if(!dados.alunos.length||dados.alunos.length>1000)throw Error('Quantidade de registros inválida.');
 const ids=new Set(),registros=[],contagens={};
 for(const x of dados.alunos){
  if(!Object.prototype.hasOwnProperty.call(escolasAlunosEspeciais,x.escola_origem)||escolasAlunosEspeciais[x.escola_origem]!==x.escola_id)
   throw Error('Instituição não reconhecida no relatório.');
  if(typeof x.id!=='string'||!/^alu_[a-f0-9]{24}$/.test(x.id)||ids.has(x.id))throw Error('ID duplicado ou inválido.');
  if(typeof x.nome!=='string'||x.nome.trim().length<3||x.nome.length>180)throw Error('Nome de aluno inválido.');
  if(typeof x.turma!=='string'||!x.turma.trim()||x.turma.length>150)throw Error('Turma inválida.');
  if(typeof x.deficiencia!=='string'||!x.deficiencia.trim()||x.deficiencia.length>140)throw Error('Registro de acompanhamento inválido.');
  if(x.ano_letivo!==2026||!Number.isInteger(x.linha_origem)||x.linha_origem<1)throw Error('Referência inválida.');
  ids.add(x.id);
  contagens[x.escola_id]=(contagens[x.escola_id]||0)+1;
  registros.push({
   id:x.id,
   publico:{nome:x.nome.trim(),escola_id:x.escola_id,nascimento:'',matricula:'',criado_por:null,ativo:true,turma:x.turma.trim(),ano_letivo:2026,origem:'relatorio_alunos_especiais_2026',linha_origem:x.linha_origem},
   privado:{cpf:'',filiacao:'',telefone:'',endereco:'',escola_id:x.escola_id,criado_por:null,deficiencia:x.deficiencia.trim(),fonte_deficiencia:'informado_pela_escola_sem_confirmacao_clinica'}
  });
 }
 return {registros,total:registros.length,contagens,escolas:[...new Set(registros.map(x=>x.publico.escola_id))]};
}
