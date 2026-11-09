// Estado da sessão e permissões de interface (o servidor reforça tudo em firestore.rules).
import * as dados from './dados.js';
import { mapaAcompanhamento, iconeEscola, normalizar } from './dominio.js';
import { esc } from './ui.js';

export const S = {
  user: null, perfil: null,
  escolas: [], usuarios: [], estudantes: [], bloqueios: [],
  atendimentos: null,          // metadados (carregados sob demanda)
  rota: { pagina: 'painel', id: '', aba: '' },
  instituicao: '',             // escola escolhida após o login ('' = todas)
  filtrosAlunos: { busca: '', escola: '', situacao: 'ativo', especialidade: '' },
  agendaSemana: '', agendaProf: '',
  filtrosRelatorio: null,
  pedidos: null                // fila de espera (carregada sob demanda)
};

const p = () => S.perfil || {};
/** Perfis ligados a escolas específicas (direção e equipe pedagógica). */
export const perfilEscolar = () => ['direcao', 'secretaria_escolar', 'pedagogico'].includes(p().perfil);
export const pode = {
  clinico: () => ['especialista', 'superadmin', 'secretaria'].includes(p().perfil),
  registrar: () => p().perfil === 'especialista',
  // Hierarquia: Administração e Secretaria de Educação podem tudo.
  gerenciar: () => ['superadmin', 'secretaria'].includes(p().perfil),
  gestao: () => ['superadmin', 'secretaria'].includes(p().perfil),
  agendar: () => ['especialista', 'secretaria', 'superadmin', 'direcao', 'secretaria_escolar'].includes(p().perfil),
  cadastrarAluno: () => p().perfil === 'especialista' || pode.gerenciar() || perfilEscolar(),
  admin: () => ['superadmin', 'secretaria'].includes(p().perfil)
};

export const nomeEscola = id => S.escolas.find(e => e.id === id)?.nome || 'Escola não informada';
export const escolaCurta = id => nomeEscola(id).replace(/^(Escola|Creche) Municipal /, '').replace(/^Creche /, 'Creche ');
/** Selo da escola: logotipo oficial ou, sem logotipo, as iniciais do nome. */
export function seloEscola(id, classe = '') {
  const e = S.escolas.find(x => x.id === id), logo = iconeEscola(e);
  const nome = e?.nome || 'Escola';
  if (logo) return '<span class="selo-escola ' + classe + '"><img src="' + logo + '" alt="Logotipo: ' + esc(nome) + '" loading="lazy"></span>';
  const sig = normalizar(escolaCurta(id)).split(' ').filter(p => p.length > 2 && !['dos', 'das', 'municipal'].includes(p)).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '?';
  return '<span class="selo-escola sem-logo ' + classe + '" aria-hidden="true">' + sig + '</span>';
}
export const especialistas = () => S.usuarios.filter(u => u.perfil === 'especialista' && u.ativo === true && !u.excluido)
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
export const estudante = id => S.estudantes.find(e => e.id === id);
export const escolasVisiveis = () => perfilEscolar() ? S.escolas.filter(e => (p().escolas || []).includes(e.id)) : S.escolas;
/** Instituições que a pessoa atende (especialista: as vinculadas no perfil; sem vínculo, todas). */
export const escolasDaPessoa = () => {
  const ids = p().escolas || [];
  if (perfilEscolar() || (p().perfil === 'especialista' && ids.length)) return S.escolas.filter(e => ids.includes(e.id));
  return S.escolas;
};
export const escolaAtual = () => S.instituicao;
/** Especialistas que atendem uma escola (sem escolas vinculadas = atende todas). */
export const especialistasDaEscola = escolaId => especialistas().filter(u => !escolaId || !(u.escolas || []).length || u.escolas.includes(escolaId));
export const escopoEscolas = () => perfilEscolar() ? (p().escolas || []) : null;

export async function carregarBase() {
  const [escolas, usuarios, estudantes, bloqueios] = await Promise.all([dados.listarEscolas(), dados.listarUsuarios(), dados.listarEstudantes(p()), dados.listarBloqueios().catch(() => [])]);
  S.bloqueios = bloqueios;
  S.escolas = escolas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  S.usuarios = usuarios; S.estudantes = estudantes; S.atendimentos = null; S.pedidos = null;
}

/** Metadados de todos os atendimentos visíveis (para situação do acompanhamento). */
export async function garantirAtendimentos(forcar = false) {
  if (S.atendimentos && !forcar) return S.atendimentos;
  S.atendimentos = await dados.listarAtendimentos({ escolas: escopoEscolas() || undefined });
  S.acompanhamento = mapaAcompanhamento(S.atendimentos);
  return S.atendimentos;
}
export function invalidarAtendimentos() { S.atendimentos = null; }
