// Estado da sessão e permissões de interface (o servidor reforça tudo em firestore.rules).
import * as dados from './dados.js';
import { mapaAcompanhamento } from './dominio.js';

export const S = {
  user: null, perfil: null,
  escolas: [], usuarios: [], estudantes: [],
  atendimentos: null,          // metadados (carregados sob demanda)
  rota: { pagina: 'painel', id: '', aba: '' },
  instituicao: '',             // escola escolhida após o login ('' = todas)
  filtrosAlunos: { busca: '', escola: '', situacao: 'ativo', especialidade: '' },
  agendaSemana: '', agendaProf: '',
  filtrosRelatorio: null
};

const p = () => S.perfil || {};
export const pode = {
  clinico: () => p().perfil === 'especialista' || p().perfil === 'superadmin',
  registrar: () => p().perfil === 'especialista',
  gerenciar: () => p().perfil === 'superadmin' || (p().perfil === 'secretaria' && p().gerenciar === true),
  gestao: () => ['superadmin', 'secretaria'].includes(p().perfil),
  agendar: () => ['especialista', 'secretaria', 'superadmin', 'direcao'].includes(p().perfil),
  cadastrarAluno: () => p().perfil === 'especialista' || pode.gerenciar() || p().perfil === 'direcao',
  admin: () => p().perfil === 'superadmin'
};

export const nomeEscola = id => S.escolas.find(e => e.id === id)?.nome || 'Escola não informada';
export const escolaCurta = id => nomeEscola(id).replace(/^(Escola|Creche) Municipal /, '').replace(/^Creche /, 'Creche ');
export const especialistas = () => S.usuarios.filter(u => u.perfil === 'especialista' && u.ativo === true && !u.excluido)
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
export const estudante = id => S.estudantes.find(e => e.id === id);
export const escolasVisiveis = () => p().perfil === 'direcao' ? S.escolas.filter(e => (p().escolas || []).includes(e.id)) : S.escolas;
/** Instituições que a pessoa atende (especialista: as vinculadas no perfil; sem vínculo, todas). */
export const escolasDaPessoa = () => {
  const ids = p().escolas || [];
  if (p().perfil === 'direcao' || (p().perfil === 'especialista' && ids.length)) return S.escolas.filter(e => ids.includes(e.id));
  return S.escolas;
};
export const escolaAtual = () => S.instituicao;
/** Especialistas que atendem uma escola (sem escolas vinculadas = atende todas). */
export const especialistasDaEscola = escolaId => especialistas().filter(u => !escolaId || !(u.escolas || []).length || u.escolas.includes(escolaId));
export const escopoEscolas = () => p().perfil === 'direcao' ? (p().escolas || []) : null;

export async function carregarBase() {
  const [escolas, usuarios, estudantes] = await Promise.all([dados.listarEscolas(), dados.listarUsuarios(), dados.listarEstudantes(p())]);
  S.escolas = escolas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  S.usuarios = usuarios; S.estudantes = estudantes; S.atendimentos = null;
}

/** Metadados de todos os atendimentos visíveis (para situação do acompanhamento). */
export async function garantirAtendimentos(forcar = false) {
  if (S.atendimentos && !forcar) return S.atendimentos;
  S.atendimentos = await dados.listarAtendimentos({ escolas: escopoEscolas() || undefined });
  S.acompanhamento = mapaAcompanhamento(S.atendimentos);
  return S.atendimentos;
}
export function invalidarAtendimentos() { S.atendimentos = null; }
