// Boletim de novidades: o que mudou e por quê, mostrado uma vez a cada pessoa afetada.
// Ao publicar um boletim novo, troque VERSAO_NOVIDADES e a lista NOVIDADES.
// Módulo só de dados (sem DOM): também é importado pelo teste de interface.
export const VERSAO_NOVIDADES = '2026-11-25';
export const TITULO_NOVIDADES = 'Novidades de novembro de 2026';

const GESTAO = ['superadmin', 'secretaria'], ESCOLA = ['direcao', 'secretaria_escolar', 'pedagogico'];
/** para: perfis que veem o item ('todos' = qualquer perfil ativo). link: tela onde conferir. */
export const NOVIDADES = [
  { para: ['especialista'], titulo: 'Atendimento em grupo: vários alunos, registro individual', link: '#/painel',
    oque: 'Em “Registrar atendimento”, escolha o tipo “Atendimento em grupo” e marque todos os alunos que participaram. A consulta é a mesma (data, horário e duração); depois de salvar o primeiro, o sistema abre o registro do próximo aluno já preenchido com o horário, e cada um recebe o próprio registro no prontuário.',
    porque: 'Para atender mais alunos no mesmo horário sem misturar as informações: o relatório de cada aluno continua individual.' },
  { para: 'todos', titulo: 'Seleção de aluno funciona no Mac', 
    oque: 'A lista de alunos virou uma lista própria: basta clicar no nome (ele fica marcado em verde) ou digitar parte do nome e apertar Enter.',
    porque: 'No Safari do Mac a lista antiga não marcava o aluno clicado.' },
  { para: ['especialista'], titulo: 'Anotação sigilosa da neuropsicologia', link: '#/painel',
    oque: 'O registro da neuropsicóloga tem um campo “Anotação sigilosa” (até 1.000 caracteres). No prontuário, o botão “🔒 Anotação sigilosa” mostra o texto somente para ela.',
    porque: 'Há informações que precisam ser preservadas: o campo não aparece para as outras especialistas, direção, secretaria ou administração, nem em relatórios, impressões ou versões anteriores.' },
  { para: [...GESTAO, 'direcao', 'secretaria_escolar'], titulo: 'Acompanhamento do dia, em tempo real', link: '#/acompanhamento',
    oque: 'Novo item no menu: cada consulta de hoje aparece com a situação atual — próxima, aluno chegou, em atendimento, realizada, não compareceu ou passou do horário sem registro — e muda sozinha, sem recarregar a página.',
    porque: 'Antes a consulta continuava como “Agendada” até alguém abrir a agenda, mesmo depois do horário. Agora a administração vê na hora o que foi realizado, as faltas e o que ainda precisa de registro.' },
  { para: ['especialista'], titulo: 'Início do atendimento registrado', link: '#/painel',
    oque: 'Ao clicar em “Atender” (ou em “Sim — registrar consulta”), o sistema guarda o horário de início; ao salvar o registro, a consulta é finalizada como realizada.',
    porque: 'Para a coordenação acompanhar o dia sem precisar perguntar: o que está em atendimento, o que terminou e o que ainda falta registrar. Nada muda no seu registro.' },
  { para: ['especialista'], titulo: 'Seu painel ganhou “Minha semana”, “Meu mês” e “Como estão meus alunos”', link: '#/painel',
    oque: 'No Painel, a semana aparece em quadradinhos de meia hora da sua jornada (agendada, realizada, sem registro, falta ou livre) com a escola de cada dia. Abaixo, o mês mostra agenda ocupada, comparecimento e horas cumpridas, e a lista de alunos mostra as últimas evoluções registradas, com quem precisa de atenção primeiro.',
    porque: 'Para ver de relance os horários livres, as consultas que ainda precisam de registro e os alunos que regrediram ou estão estáveis há muito tempo, sem abrir a agenda nem cada prontuário. Nenhum texto clínico aparece nesses quadros.' },
  { para: ['especialista'], titulo: 'Relatórios: evolução dos seus atendimentos', link: '#/relatorios',
    oque: 'Em Relatórios há um novo quadro “Evolução observada”, com a proporção de atendimentos em que o aluno avançou, ficou estável ou regrediu.',
    porque: 'Para acompanhar o resultado do seu trabalho no período, além da quantidade de atendimentos.' },
  { para: [...GESTAO, ...ESCOLA], titulo: 'Relatórios ampliados e organizados em abas', link: '#/relatorios',
    oque: 'Relatórios agora tem abas: Visão geral (números com a variação sobre o período anterior e o caminho dos alunos, da fila até a alta), Por escola e profissional, Evolução dos alunos (inclui quem regrediu em dois atendimentos seguidos), Agenda e presença (faltas, cancelamentos e ocupação da agenda) e a lista de atendimentos.',
    porque: 'Para acompanhar a rede sem montar planilhas: onde a fila está parada, onde há mais faltas, quais horários estão ociosos e quais alunos precisam de atenção. A direção vê apenas a própria escola.' },
  { para: 'todos', titulo: 'Menu e letras renovados',
    oque: 'O menu lateral tem novo visual, com destaque na tela atual, e o sistema usa uma letra mais legível (Inter). O fundo do menu vai até o fim da página e, em telas baixas, o menu rola.',
    porque: 'Em alguns notebooks o menu ficava cortado e aparecia uma faixa branca embaixo. A letra nova melhora a leitura em telas pequenas e em projetores, e funciona mesmo sem internet.' },
  { para: 'todos', titulo: 'Avisos não ficam mais um em cima do outro',
    oque: 'Quando o sistema mostra mais de um aviso ao mesmo tempo, eles aparecem empilhados.',
    porque: 'Antes os avisos se sobrepunham e o texto ficava ilegível.' },
  { para: 'todos', titulo: 'Mais proteção nos computadores compartilhados',
    oque: 'Ao clicar em Sair com o sistema aberto em outra aba, aparece um aviso pedindo para fechar todas as abas.',
    porque: 'Nesse caso a cópia local dos dados não pode ser apagada e informações de alunos ficariam no computador da escola (LGPD).' },
  { para: 'todos', titulo: 'Planilhas (CSV) mais seguras',
    oque: 'Nomes e textos que começam com “=”, “+”, “-” ou “@” saem nas planilhas como texto.',
    porque: 'Um nome cadastrado com esses sinais podia virar fórmula ao abrir a planilha no Excel ou LibreOffice.' }
];
/** Itens do boletim que afetam o perfil. */
export const novidadesPara = perfil => NOVIDADES.filter(n => n.para === 'todos' || n.para.includes(perfil));
/** Chave (por pessoa) da preferência "não exibir mais" neste navegador. */
export const chaveNovidades = uid => 'seduc:novidades:' + uid;
