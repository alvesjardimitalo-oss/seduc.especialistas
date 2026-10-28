# SEDUC Especialistas

Sistema Municipal de Atendimentos Especializados da Rede Municipal de Ensino de Frei Inocêncio/MG.

**Estado:** MVP em homologação, **não habilitado para dados reais de alunos**. A versão em desenvolvimento está na branch `feature/mvp-especialistas`.

## O que já existe no MVP
- Interface baseada na identidade visual do SISDIFI (projeto e dados independentes).
- Login Google com contas pendentes até aprovação.
- Escolas, quadro de servidores importados, fichas profissionais, vínculos e jornadas de trabalho.
- A aba **Profissionais** reúne os servidores importados e as fichas de especialistas em uma única lista. Servidores importados não recebem automaticamente permissão de atendimento.
- Cadastro, edição e arquivamento de alunos sem apagar registros históricos.
- Agenda com reservas atômicas de 30 ou 60 minutos, verificação da jornada no Firestore e cancelamento com liberação de horários.
- Atendimento imediato com data/hora automática, texto de até 1.000 caracteres e histórico.
- Notas privadas com versões de edição, frequência declaratória e relatórios agregados.
- Gestão de permissões, inclusive delegação para a Secretaria da Educação.

## Firebase
O projeto Web `seduc-especialistas` informado pela administração **já está configurado no arquivo** [firebase-config.js](assets/js/firebase-config.js). A configuração Web é pública por definição, mas **as regras de segurança Firestore e o controle de usuários são obrigatórios**.

Isso **não** significa que os produtos do Firebase já foram habilitados no console: para funcionar, é necessário habilitar Authentication/Google, criar Firestore em modo de produção, configurar os domínios de autenticação, publicar e testar as regras em `firestore.rules`, além de provisionar manualmente o superadministrador.

Consulte o [guia de implantação e homologação](docs/IMPLANTACAO-MVP.md) e a [especificação funcional](docs/ESPECIFICACAO.md).

## Testes de desenvolvimento
O GitHub Actions executa validações de sintaxe, regras de negócio e permissões com dados fictícios no emulador Firestore.

> **LGPD:** nunca adicionar aqui CPF, filiação, endereço de alunos, dados de saúde, contas de serviço ou credenciais administrativas. O repositório é público apenas para código. A sobreposição e a jornada dos agendamentos já são verificadas no Firestore. Ainda faltam revisão formal de segurança, auditoria de acessos, tratamento de afastamentos e validação de atendimentos imediatos antes da produção.
