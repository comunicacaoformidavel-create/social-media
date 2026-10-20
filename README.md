# Compasso Social

Um espaço para organizar o trabalho de social media, da primeira ideia ao relatório. Interface em português, responsiva, com React, TypeScript e banco SQLite persistente.

## Ver funcionando no computador

Instale **Node.js 24 ou superior** e abra um terminal na pasta deste projeto.

```bash
npm ci
npm run dev
```

Abra no navegador o endereço da interface informado pelo Vite no terminal, na **porta 5173**. A API é iniciada junto, na porta 3001. Encerre os dois processos com `Ctrl+C`.

Se o cache padrão do npm não for gravável no ambiente Linux, use `npm ci --cache /tmp/compasso-npm-cache`.

O primeiro início abre um workspace **vazio**, pronto para os seus clientes e conteúdos. Não é necessário cadastrar credenciais externas.

Se você já usava a versão com exemplos, abra **Meu espaço → Limpar dados do app**, digite **LIMPAR** e confirme. A limpeza remove todos os registros do workspace e cria uma cópia JSON em `data/backups/` antes de apagar. O workspace continua vazio após reiniciar. Os exemplos ficam disponíveis apenas para testes, com `COMPASSO_DEMO=true` em um diretório de dados novo.

## O que funciona

- **Visão geral:** indicadores calculados a partir das demandas, agenda da semana, checklist e atividades recentes.
- **Demandas:** quadro com cinco etapas, movimentação por arraste ou seletor, visualização em lista, filtros, prioridades, etiquetas, briefing, responsável, canal e formato.
- **Calendário:** planejamento mensal por cliente e rede, criação de demandas em uma data e edição dos conteúdos.
- **Checklist:** listas por data, tarefas pendentes e concluídas, progresso, inclusão e exclusão.
- **Clientes:** identidade visual, segmento, contato e acompanhamento das demandas.
- **Anotações:** notas coloridas com busca e vínculo opcional a um cliente.
- **Relatórios:** filtros por cliente/período, alcance informado, impressões, engajamento, formatos, melhores publicações, exportação CSV e impressão.
- **Importações:** CSV padronizado com prévia e confirmação; suporte a colunas em português e inglês; validação atômica e prevenção de duplicatas.
- **Backup:** exportação JSON do workspace. A restauração de JSON pela interface ainda não está implementada.

Os dados são salvos no servidor; atualizar a página preserva alterações. O estado de demonstração indica que o workspace foi iniciado com exemplos e não certifica a origem de itens adicionados depois.

## Aprova Aí, Operand e redes sociais

A versão atual permite **importar manualmente um CSV adaptado ao modelo Compasso**, inclusive dados de rotinas mantidas no Aprova Aí ou Operand. Não é uma conexão oficial, não pressupõe um formato de exportação nativo e não pede tokens.

Não há sincronização automática, envio de aprovação a clientes externos nem publicação nas redes sociais. “Agendado” representa planejamento dentro do app; “Publicado” e as métricas devem ser informados manualmente ou importados. O alcance do relatório soma postagens e não representa pessoas únicas. O engajamento é `(curtidas + comentários + salvamentos) ÷ alcance × 100`.

Veja [as condições para uma integração real e o modelo CSV](docs/integrations.md).

## Execução da versão compilada

```bash
npm run build
npm start
```

A API e os arquivos compilados são servidos juntos na **porta 3001**. A variável opcional `PORT` altera essa porta; `DATA_DIR` altera o diretório do banco. Não são necessárias variáveis de ambiente para o uso padrão.

Esta versão funciona em um workspace único, sem login ou separação de contas. Para disponibilizar dados reais em uma URL pública, é necessário adicionar autenticação e controle de acesso ou usar uma camada de acesso privado. O app não foi publicado automaticamente por esta tarefa.

## Persistência

O banco é criado em `data/compasso.sqlite`, fora do Git. Preserve esse diretório entre reinicializações e publicações. Para copiar o banco de forma consistente, encerre o processo do app e copie o diretório `data` inteiro. O download JSON em Integrações serve como exportação dos registros.

O diretório de dados deve ser gravável. Não guarde senhas ou chaves de API nos briefings ou nas anotações.

## Validação

```bash
npm test
npm run build
npm run test:e2e
```

Os testes de backend usam bancos temporários. Os testes de navegador executam a versão compilada em outra porta e em um diretório de dados isolado. O Playwright usa Chromium instalado no sistema quando disponível; fora deste ambiente, instale-o com `npx playwright install chromium`. As capturas e os resultados gerados ficam fora do controle de versão.

## Desenvolvimento neste ambiente

Cada tarefa na nuvem já usa um ambiente isolado. Trabalhe no checkout existente em `/workspace/social-media`; não é necessário criar um Git worktree. Dependências e arquivos compilados podem permanecer no snapshot, mas processos precisam ser iniciados novamente.

Código: `src/`. API, validação, CSV e SQLite: `server/app.mjs`. Entrada do servidor e arquivos de produção: `server/index.mjs`.
