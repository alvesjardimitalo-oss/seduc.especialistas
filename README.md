# SEDUC Especialistas

Prontuário eletrônico da equipe de **Fonoaudiologia, Neuropsicologia e Psicopedagogia** que atende os alunos das 6 escolas e creches da Rede Municipal de Ensino de Frei Inocêncio/MG.

O sistema segue o modelo de acompanhamento do SUS. Cada criança tem um cadastro e um **prontuário único e compartilhado**. As próprias profissionais registram cada atendimento, que aparece no perfil do aluno como um **card expansível** com o que foi trabalhado, o que foi desenvolvido e as orientações.

> **Estado:** versão 2 em homologação. Use apenas dados fictícios até publicar as regras, testar com a equipe e formalizar a política de LGPD com a Prefeitura.

## Fluxo

Login (e-mail e senha, ou Google) → termo de LGPD (primeiro acesso) → escolha da instituição → **painel de consultas** com busca por aluno ou código, filtro de data e de profissional, e botão **+** (agendar, registrar, cadastrar aluno).
Cada consulta tem um **código único** (ex.: `C261030-7K3F`) e abre numa janela ampliada que pergunta **"O aluno compareceu?"**: *Sim* abre o registro da consulta (até **500 caracteres**); *Não* registra a falta e oferece **reagendar**. A consulta registrada pode ser **editada** pela autora (a versão anterior fica guardada).

## Como funciona

| Quem | O que faz |
|---|---|
| **Especialista** (fono, neuropsico, psicopedagoga) | Cadastra alunos, registra atendimentos no prontuário, agenda nos próprios horários, emite relatórios. Lê o prontuário completo de **todos** os alunos da rede, porque a equipe é única. Só corrige os próprios registros. |
| **Secretaria de Educação** | Vê a agenda, os indicadores e os relatórios gerenciais. Com a opção *gerenciar*, também libera contas, define jornadas e cadastra escolas e alunos. **Não lê o texto clínico.** |
| **Direção escolar** | Cadastra os alunos da própria escola com o motivo do encaminhamento e agenda nos horários livres da equipe. Acompanha datas, faltas e a evolução. **Não lê o texto clínico.** |
| **Administração** | Faz tudo o que a Secretaria faz e ainda pode anular registros com justificativa. |

- **Prontuário:** é uma linha do tempo de cards, filtrável por especialidade. Cada card registra o tipo (avaliação, sessão, reavaliação, devolutiva, orientação à escola ou alta), a evolução observada e três textos: *trabalhado*, *desenvolvido* e *orientações*.
- **Nada é apagado.** Retificar guarda a versão anterior, que fica imutável. Anular deixa o card riscado e exige um motivo. Isso atende à guarda de prontuário exigida pelo CFFa (Res. 649/2022) e pelo CFP (Res. 001/2009).
- **Situação do aluno:** é calculada a partir dos registros. Pode ser *aguardando 1º atendimento*, *em acompanhamento* (por especialidade) ou *alta*.
- **Jornada por profissional:** cada profissional tem dias e horários próprios, com o local informativo de cada período. Só é possível agendar dentro da jornada. Os horários são reservados atomicamente, então duas pessoas nunca marcam o mesmo horário.
- **Registro sem agendamento:** também é possível registrar um atendimento já feito sem que ele tenha sido agendado.
- **Relatórios:** há três tipos.
  - Prontuário impresso ou em PDF, com assinatura.
  - Relatório descritivo, parecer ou devolutiva, que pode ser preenchido a partir dos atendimentos do período.
  - Relatório gerencial por escola, especialidade e profissional, que exporta CSV sem nomes de alunos.

## Estrutura

```
index.html                página única (GitHub Pages)
css/app.css               interface
css/impressao.css         documentos impressos
js/app.js                 login, menu e rotas
js/dominio.js             regras de negócio puras (testadas)
js/dados.js               gravações no Firestore (lotes e transações)
js/formularios.js         cadastro, registro, agendamento
js/paginas/*.js           painel, alunos, prontuário, agenda, relatórios, equipe, escolas
firestore.rules           permissões (a segurança real fica aqui)
tests/                    domínio, regras (emulador) e interface (Chromium)
```

Coleções: `usuarios`, `convites`, `escolas`, `estudantes`, `estudantes_privado` (contato e motivo do encaminhamento), `estudantes_clinico` (somente a equipe), `atendimentos` (metadados), `atendimentos_registro` (texto, somente a equipe), `atendimentos_versoes`, `agendamentos`, `reservas`, `relatorios`.

## Implantação

Siga o guia em [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md). Resumo:

1. Publique as regras e os índices pelo workflow **Publicar regras do Firestore** (aba Actions). O banco atual só tem dados de teste; as regras novas substituem as da versão anterior.
2. Em GitHub → Settings → Pages, aponte a publicação para esta branch (ou para `main`, depois do merge).
3. Entre com a conta de administrador, adicione as escolas em **Escolas** e autorize as especialistas por e-mail em **Equipe**, com especialidade e jornada.

## Testes

```bash
npm test               # regras de negócio
npm run test:regras    # permissões no emulador do Firestore (Java 21+)
npm run test:tela      # fluxo completo no Chromium com simulador em memória
```

O GitHub Actions roda os três a cada envio.

> **LGPD:** o repositório é público apenas para o código. Nunca envie ao GitHub dados de alunos, famílias, profissionais ou atendimentos, nem os arquivos JSON de importação.
