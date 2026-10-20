# Aprova Aí, Operand e importação de relatórios

Verificação realizada em **19 de outubro de 2026**.

O aplicativo oferece um fluxo de **importação manual de CSV**. Ele não se autentica no Aprova Aí ou no Operand, não consulta contas externas, não publica conteúdo nessas plataformas e não faz sincronização automática. Os registros importados passam a fazer parte dos dados locais do aplicativo.

## O que foi possível verificar

| Plataforma | Resultado desta verificação                                                                                                                                                                                                                                                              | Consequência para o aplicativo                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operand    | A tentativa de acessar [o site da Operand](https://www.operand.com.br/) foi bloqueada pelo proxy deste ambiente com `403 Forbidden`. O conteúdo das páginas de suporte e documentação também não pôde ser consultado.                                                                    | Não foi possível confirmar uma API pública, webhooks, plano necessário, autenticação ou formato de exportação. Nenhuma conexão oficial está implementada. |
| Aprova Aí  | Não foi possível confirmar o domínio oficial do produto mencionado pelo usuário nem acessar documentação verificável. Tentativas de consulta a `https://aprova.ai/` e `https://aprovaai.com/` também receberam `403 Forbidden` do proxy; esses endereços são candidatos não confirmados. | Não foi possível confirmar uma API pública, webhooks ou exportação. Nenhuma conexão oficial está implementada.                                            |

Essas limitações de acesso **não comprovam que as plataformas não tenham integrações**. Para implementar um conector real em uma próxima etapa, será necessário confirmar o fornecedor, consultar a documentação oficial atual e verificar os recursos disponíveis no plano da conta. Não há endpoints, permissões ou métodos de autenticação presumidos neste projeto.

## Como usar dados externos agora

Se a plataforma de origem permitir exportar os dados da sua conta, exporte-os e adapte a planilha ao modelo abaixo. Também é possível preencher esse modelo manualmente. A disponibilidade de exportação no Aprova Aí e no Operand não foi verificada nesta sessão.

O arquivo deve usar texto UTF-8, vírgulas ou ponto e vírgula como separador e uma linha de cabeçalho. O limite é de 2 MB e 1.000 demandas por importação:

```csv
title,client,date,status,format,channel,reach,impressions,likes,comments,saves
"Bastidores da coleção","Ateliê Aurora",2026-10-19,published,Reels,Instagram,1820,2460,164,18,32
"Dicas da semana","Café Botânico",2026-10-22,scheduled,Carrossel,Instagram,0,0,0,0,0
```

| Coluna        | Conteúdo                                                      |
| ------------- | ------------------------------------------------------------- |
| `title`       | Título da demanda ou postagem.                                |
| `client`      | Nome do cliente ou marca.                                     |
| `date`        | Data em `AAAA-MM-DD`.                                         |
| `status`      | `idea`, `progress`, `review`, `scheduled` ou `published`.     |
| `format`      | `Post`, `Reels`, `Carrossel` ou `Story`.                      |
| `channel`     | Rede social, por exemplo `Instagram`, `TikTok` ou `LinkedIn`. |
| `reach`       | Alcance, como número inteiro não negativo.                    |
| `impressions` | Impressões, como número inteiro não negativo.                 |
| `likes`       | Curtidas, como número inteiro não negativo.                   |
| `comments`    | Comentários, como número inteiro não negativo.                |
| `saves`       | Salvamentos, como número inteiro não negativo.                |

Os estados correspondem a Ideia, Em produção, Em aprovação, Agendado e Publicado. Um registro com estado `scheduled` apenas organiza a agenda deste aplicativo; ele não agenda a publicação na rede social ou em uma ferramenta externa.

Os números dos relatórios vêm dos dados inseridos ou importados. Sem um conector validado, não representam métricas atualizadas automaticamente. Um valor zero no CSV significa zero informado; não substitui uma métrica desconhecida.

## Próxima etapa para integrações reais

Com documentação oficial acessível, será possível avaliar separadamente leitura de demandas, estados de aprovação, agenda de publicação e métricas disponíveis. A implementação deverá informar a origem dos dados, a última sincronização e eventuais falhas. Tokens e outros segredos deverão ser configurados em um serviço de backend com armazenamento adequado; não devem ser colocados em CSV, no código do navegador ou no armazenamento local deste protótipo.
