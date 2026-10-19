# Calumbi — gestão visual de rebanho Nelore

Aplicação em Next.js 16, React 19 e TypeScript. Mapa ilustrativo em SVG, rebanho individual, cotas por cabeça, livro de caixa, reserva e projeções de 5, 10 e 15 anos. Interface responsiva em português.

## Executar

Requer Node.js 22.18 ou superior.

```sh
npm ci
# Defina APP_PASSWORD no .env antes de iniciar.
npm run dev
```

Abra http://localhost:3000 e entre com a senha `APP_PASSWORD` definida no `.env`. O app exige login mesmo no modo de demonstração. Sem credenciais Google, o app abre em **modo demonstração**, com 48 animais e quatro participantes fictícios. Alterações ficam no `localStorage` desse navegador. Dados de demonstração nunca são enviados à planilha.

```sh
npm run typecheck
npm test
npm run build
npm start
```

## Senha de acesso

A senha fica exclusivamente no servidor, em `.env`:

```dotenv
APP_PASSWORD=sua-senha-forte
```

O `.env` já está ignorado pelo Git. A senha local está configurada no `.env`; consulte o arquivo para vê-la ou substituí-la. Reinicie o servidor após alterar a senha. Na hospedagem, configure `APP_PASSWORD` nas variáveis de ambiente. Não use prefixo `NEXT_PUBLIC_`.

Sem uma sessão válida, as páginas redirecionam para `/login` e as APIs recusam acesso. Isso também protege o modo de demonstração. Sem `APP_PASSWORD` configurada, o login permanece bloqueado. O botão **Sair** encerra a sessão. Arquivos estáticos de interface e a página de login permanecem acessíveis para permitir a autenticação; os dados são protegidos no servidor.

## Conectar uma planilha privada

1. No [Google Cloud](https://console.cloud.google.com/), crie ou selecione um projeto e ative a **Google Sheets API**.
2. Em IAM → Contas de serviço, crie uma conta de serviço e gere uma chave JSON. Não coloque esse arquivo no repositório.
3. Crie uma planilha Google Sheets vazia. Compartilhe **somente essa planilha**, como editor, com o endereço `client_email` da conta de serviço. Não é necessário tornar a planilha pública nem conceder acesso à sua conta Google inteira.
4. Copie `.env.example` para `.env.local`. Preencha o ID da planilha (o trecho entre `/d/` e `/edit` da URL), `client_email` e `private_key` do JSON. Para a chave, preserve os `\n` dentro das aspas. Mantenha a senha `APP_PASSWORD` no `.env` (não é necessário duplicá-la no `.env.local`). Credenciais são exclusivas do servidor; nenhuma variável usa `NEXT_PUBLIC_`.
5. Execute:

```sh
npm run sheets:init
npm run dev
```

O inicializador cria apenas abas ausentes e cabeçalhos de abas vazias; não apaga dados existentes e não importa exemplos. A integração lê e escreve pelo servidor, usando JWT da conta de serviço e a API REST do Google. Não há banco SQL ou serviço de banco adicional.

| Aba             | Colunas                                                                               |
| --------------- | ------------------------------------------------------------------------------------- |
| `Animais`       | `id`, `tag`, `sex`, `born`, `weight`, `owner`, `_reserved` (metadados JSON), `status` |
| `Participantes` | `id`, `name`, `color`                                                                 |
| `Lancamentos`   | `id`, `date`, `kind`, `category`, `description`, `amount`, `investor`                 |
| `Configuracoes` | `chave`, `valor`                                                                      |

Cadastre primeiro os participantes, depois os animais. `owner` referencia o `id` do participante. As datas são textos ISO `AAAA-MM-DD`; pesos e valores são números, sem símbolos monetários. Preserve nomes de abas e cabeçalhos. `status`: `ativo`, `vendido`, `morto`; `sex`: `F`, `M`; `kind`: `despesa`, `receita`, `aporte`. Os IDs são gerados pela aplicação.

A inicialização prepara 10 mil linhas de animais, 20 mil de lançamentos e de movimentações, e 500 de participantes. O leitor usa esses limites para evitar leituras ilimitadas: amplie os intervalos e a grade se a operação crescer. Use abas exclusivas da aplicação, sem fórmulas, linhas mescladas ou tabelas auxiliares no meio dos registros.

O acesso aos dados exige uma sessão com senha compartilhada da fazenda, cookie HttpOnly, SameSite Strict e duração de 24 horas. Em HTTPS, o cookie usa Secure. A troca da senha invalida sessões anteriores. Não há perfis individuais de usuário. O bloqueio de tentativas é em memória e por instância; uma implantação pública de maior porte deve usar autenticação individual e controle de acesso da plataforma.

## Câmera do curral

A página privada `/curral`, disponível no menu, reserva o espaço para a futura câmera da Fazenda Calumbi. Ela exibe explicitamente que o equipamento ainda não foi instalado. Não há transmissão, gravação, captura de imagens ou conexão com equipamentos nesta versão. A implementação do vídeo dependerá do modelo da câmera, da conexão na propriedade e do serviço escolhido; as credenciais deverão permanecer no servidor.

## Rebanho por integrante e grafo animado

Na projeção, escolha **Toda a fazenda** ou um integrante. O simulador preserva o proprietário de cada coorte: idade, sexo, crias, mortalidade, vendas, descarte e valor dos animais são calculados por dono. As crias projetadas seguem a propriedade da matriz; isso não cria animais reais automaticamente. Uma pessoa com apenas machos não recebe uma parcela fictícia dos nascimentos das matrizes de outras pessoas.

A lotação é compartilhada: excedentes são vendidos começando pelos mais jovens, proporcionalmente entre donos de animais da mesma idade. A ordem dos participantes não favorece ninguém. Custos anuais e aportes são rateados pelo rebanho médio (início + fim do ano) de cada integrante. O caixa continua sendo da fazenda, e sua parcela visual é distribuída pela participação ao fim do ano; não é um saldo pessoal. Se não houver animais, despesas fixas permanecem no caixa comum sem rateio por cabeça.

O grafo abre como **Árvore genealógica**, com mãe acima e crias abaixo, separando as famílias por participante. Cada cria projetada mantém o ID da mãe que a originou na simulação; a relação persiste quando a filha cresce e gera novas crias. Os animais reais sem registro de mãe iniciam raízes independentes, sem parentesco inventado. Cada nó mostra identificação, ano de nascimento (`Nasc.`) ou nascimento previsto (`Prev.`) e idade. Nascimentos reais com idade estimada usam `≈`. Números fracionários nos nós projetados são expectativas por sexo, não gêmeos nem novos registros reais.

Clique numa vaquinha para enquadrar as descendentes e o caminho das ancestrais, ou use o filtro **Família pela matriz**. Ancestrais que saíram do rebanho permanecem apagadas quando necessárias para conectar descendentes vivas; têm contagem zero e não alteram patrimônio ou custos. Linhas contínuas ligam mãe e cria; tracejadas ligam o participante às raízes sem mãe conhecida. A visualização radial segue disponível. O controle de ano mantém o parentesco e envelhece as crias; **Ver evolução** anima a mudança. Zoom, arraste, enquadramento e filtros por participante continuam disponíveis. O desenho das vacas usa geometria SVG com escala explícita e respeita movimento reduzido.

IDs de animais novos são UUIDs gerados no servidor (ou no navegador, na demonstração). O brinco é uma identificação legível e única no cadastro. O ID aparece na ficha e permanece nas compras, transferências e baixas. Eventos referenciam esse ID, permitindo acompanhar a trajetória do animal.

## Como os cálculos funcionam

- **Participação:** cabeças ativas do participante ÷ total de cabeças ativas. Custos mensais atuais usam essa proporção. Aportes projetados usam a participação no rebanho médio de cada ano. Venda ou morte altera as cotas. As crias precisam ser cadastradas com seu proprietário; não há transferência automática de propriedade.
- **Patrimônio estimado:** peso vivo × rendimento de carcaça ÷ 15 × preço da arroba. É uma equivalência simplificada, aplicada a todas as categorias. O patrimônio proporcional por participante é o valor total rateado por cabeça, que pode diferir da avaliação dos seus animais individuais.
- **Arroba:** R$ 375 é a hipótese inicial, baseada na faixa de R$ 350–400 informada pelo proprietário. A pesquisa não confirmou uma cotação atual específica do Agreste. Não há atualização automática. Referência para consulta: [Scot](https://www.scotconsultoria.com.br/cotacoes/).
- **Reprodução:** prazos de parto por coorte em dias, com apresentação anual. O ciclo padrão soma 90 dias do parto à nova concepção e 295 de gestação: 385 dias (12,7 meses), não 466 dias. A idade de entrada é a idade da primeira concepção; a gestação é somada antes da primeira cria, sem arredondar a maturidade para a próxima virada de ano. O sucesso por ciclo é 100% como premissa base editável, não garantia. Novas crias têm proporção de sexos 50/50; a retenção de fêmeas é configurável. Matrizes são descartadas no limite de idade, machos são vendidos na idade indicada e excedentes de lotação são vendidos começando pelas coortes mais recentes. Mortalidade de adultos e bezerros é aplicada separadamente. A mortalidade de recém-nascidos é descontada no nascimento. Valores fracionários representam expectativas, não animais cadastrados. Sem datas de concepção ou último parto, matrizes aptas são consideradas aptas a conceber hoje; prenhez confirmada também usa uma gestação inteira por falta da fase gestacional. Recém-nascidos entram com 30 kg e crescem no tempo restante até a fotografia anual.
- **Pesos projetados:** ganho de 90 kg por ano até 450 kg (fêmeas) ou 550 kg (machos); crias começam com 30 kg. Fêmeas não retidas são avaliadas com 180 kg. São hipóteses simplificadas, que exigem calibração com dados reais.
- **Caixa:** saldo inicial + receitas + aportes − despesas registradas. Nas projeções, vendas são receitas e custos anuais usam a média do rebanho inicial e final, mais custo fixo, com inflação. A reserva alvo soma meses de operação e valor esperado das perdas do ano. O aporte é o necessário para cobrir os custos e atingir essa reserva após as vendas. Fêmeas retidas fazem a reposição; não há compra automática de animais mortos.
- **Cenários:** base; seca (natalidade −20%, custo por cabeça +35%, arroba −10%, mortalidade de bezerros ×1,5); favorável (natalidade +10%, limitada a 100%, arroba +10%). Os multiplicadores são relativos à premissa, não pontos percentuais.
- **Fibonacci:** comparação matemática normalizada ao rebanho inicial, excluída do cálculo financeiro. Não é uma lei da reprodução bovina. [Embrapa: gestação e intervalo entre partos](https://cloud.cnpgc.embrapa.br/sac/2012/04/02/qual-e-a-duracao-da-gestacao-e-qual-o-intervalo-medio-entre-partos-em-gado-de-corte/).

A simulação não inclui impostos, crédito, valorização da terra, sazonalidade mensal ou preços específicos de bezerros, matrizes e reprodutores. O mapa é ilustrativo, sem área real, georreferenciamento ou produtividade de pasto medida.

## Operação e limites

Compra, despesa e histórico são gravados em uma chamada atômica de `batchUpdate`; o mesmo vale para venda/receita/histórico e para troca de proprietário/histórico. A aba `Movimentacoes` é criada automaticamente na primeira movimentação se estiver ausente, mantendo compatibilidade com planilhas existentes. Seu esquema é `id`, `date`, `kind`, `animalId`, `tag`, `fromOwner`, `toOwner`, `amount`, `note`. Leituras de planilhas antigas funcionam sem essa aba. Os registros existentes são localizados por ID antes de alterar a situação, inclusive após ordenação da planilha. O Sheets não oferece transações com comparação condicional: duas gravações simultâneas do mesmo animal ainda podem competir. Para a operação simples desta versão, faça movimentações com um operador por vez e evite alterações concorrentes diretas nas abas.

Não há edição/exclusão de lançamentos na interface. Movimentações de animais são registradas a partir desta versão; os animais antigos não têm histórico retroativo. Correções podem ser feitas na planilha preservando os IDs e o esquema; atualize o app depois. Use **Comprar gado** para cadastrar o animal e registrar a despesa juntos; não lance essa despesa novamente. Use **Vender** diretamente na linha do animal para dar baixa e registrar a receita na mesma operação. **Transferir** troca o integrante proprietário preservando o ID e sem movimentar o caixa da fazenda. No cadastro de nascimentos, registre cada cria com sexo, peso, proprietário e data reais. Registros de venda/morte alteram o rebanho atual imediatamente, mesmo quando a data da saída é retroativa.

A integração Google está implementada, mas depende das credenciais e da planilha do proprietário para validação real. Nunca compartilhe a chave privada no chat. Configure-a localmente ou no gerenciador de variáveis de ambiente da hospedagem.

## Organização

- `components/dashboard.tsx`: telas, formulários e fluxo da demonstração/Sheets.
- `components/farm-map.tsx`: mapa ilustrativo do rebanho.
- `components/charts.tsx`: gráficos SVG sem serviço externo.
- `lib/model.ts`: cotas, patrimônio, custos e projeção.
- `lib/actions.ts`: validação e atualização de registros.
- `lib/sheets.ts`: autenticação Google, leitura, gravação e inicialização.
- `app/api/`: API protegida e sessão.
- `lib/model.test.ts`: testes de invariantes do modelo financeiro e do rebanho.

Idade e compra são informações separadas. No cadastro, compra e edição, selecione nascimento conhecido ou idade aproximada em meses na data da avaliação. A opção de sugestão por peso é uma interpolação ilustrativa de referências de crescimento Nelore (30 kg ao nascer; 181,30 / 244,51 / 327,54 kg aos 205 / 365 / 550 dias). Referências: https://old.cnpgc.embrapa.br/publicacoes/doc/doc95/04medidas.html e https://www.alice.cnptia.embrapa.br/handle/doc/325931. Não é uma curva validada para Calumbi nem determina idade individual; alimentação, sexo, genética e manejo alteram o peso. Fora de 30–327,54 kg, informe a idade aproximada pelo histórico do vendedor ou avaliação do animal. A data aproximada é persistida para envelhecer com o calendário e alimentar as projeções, sem recalcular a idade a cada nova pesagem.

Os metadados de idade, data de entrada e situação reprodutiva ficam em JSON na coluna G já reservada da aba Animais. As demais colunas e dados antigos são preservados; não precisa rodar o seed. Registros antigos não são reinterpretados automaticamente: corrija pelo botão Editar se o nascimento salvo era a compra. Prenhez confirmada conta uma cria esperada após o tempo de gestação configurado a partir de hoje; depois segue o intervalo parto–concepção mais gestação e o sucesso configurado por ciclo. O modelo aplica a mortalidade de bezerros e não prevê data de parto nem perdas gestacionais específicas. Inseminação sem confirmação não garante nascimento.

Bases antigas sem os dois parâmetros do ciclo usam automaticamente 295 dias de gestação e 90 até a nova concepção. Se ainda tiverem o antigo valor de exemplo `birthRate=78`, a leitura o atualiza para 100; outras taxas são preservadas. Salvar as premissas grava os novos parâmetros na planilha. Taxas explicitamente salvas com parâmetros de ciclo, inclusive 78%, são preservadas. Não é necessário executar o seed.

A navegação da árvore usa páginas de seis famílias completas, intercalando participantes na visão geral. As famílias são distribuídas em linhas e o enquadramento automático preserva uma escala mínima legível, adaptada ao tamanho da tela. Árvores maiores podem ser exploradas por arraste; elas não são reduzidas até os rótulos desaparecerem. A roda do mouse ou gesto vertical do trackpad amplia no ponto do cursor, sem rolar a página enquanto estiver sobre o desenho. Os botões +/− ampliam no centro e o botão restaurar recupera o enquadramento legível. Com o desenho focado pelo teclado, + e − ajustam o zoom e 0 restaura a visão.

Na **Visão geral**, o grafo mostra exclusivamente os animais ativos cadastrados, com os mesmos filtros, zoom, arraste e seleção individual da árvore. Não tem controle de anos nem evolução; não chama a inferência de crias. As idades são as do cadastro.

Na aba **Projeções**, `projectFromPurchases` reconstrói nascimentos hipotéticos desde a data de compra antes de avançar para o futuro. Assim, a base do ano atual já contém crias esperadas de compras antigas, ainda que não estejam cadastradas. Os nós aparecem como **Inferido**, com mãe e ano, e o primeiro ano mostra nascimentos estimados até hoje. Para os lotes legados da Calumbi, sem idade corrigida, o relato do proprietário é usado somente na simulação: 24 meses na compra em 2023 e 36 meses em 2025; registros com metadados de idade corrigida prevalecem. Não há inferência histórica para outros animais sem data de compra. As matrizes cadastradas são conhecidas como vivas hoje e não são removidas retroativamente por mortalidade simulada. Descendentes inferidas passam por perdas, retenção, venda por idade e limite atual de lotação. A propriedade histórica é atribuída ao participante atual, como hipótese; o modelo não reconcilia nascimentos reais sem vínculo de mãe.

Essa reconstrução ocorre em memória: não cadastra crias, não escreve no Google Sheets e não credita vendas inferidas ao caixa real. As projeções financeiras futuras partem do saldo real atual, considerando o estoque inicial inferido. O relógio reprodutivo avança desde a compra, sem reiniciar a gestação a cada visita à página. A inferência não conhece a fase da prenhez na compra; o primeiro prazo pressupõe uma gestação inteira após a entrada/idade de primeira concepção, quando não existe histórico mais preciso.

## Aba Testes

Abra **Testes** no menu (`/?section=tests`) para simular, sem gravar dados:

1. Quantidade e preço unitário de vacas para cada participante. Idade, peso vivo em kg/@ e prenhez são premissas comuns às novas vacas.
2. Opcionalmente, um lote de 1 a 500 bois compartilhados: quantidade, preço por animal, peso e idade por animal, finalidade de reprodução ou engorda e divisão igual ou proporcional às cotas após comprar as vacas.
3. Custo por cabeça, custo fixo mensal e horizonte de 1 a 15 anos, somente para este teste.

O resultado compara situação atual, compras individuais e compras com os bois. Cada pessoa vê compra das vacas, parcela dos bois, capital inicial, manutenção mensal, aportes futuros e capital total estimado. A curva compara o rebanho das etapas para toda a fazenda ou um participante. Os valores mostram o último teste calculado, com aviso para recalcular após alterar os campos. O teste é temporário e não é salvo no Sheets ou no navegador.

Cada boi conta como uma cabeça, com frações de propriedade. Quantidade × preço por animal define o investimento do lote; sua despesa é rateada em centavos pelo método dos maiores restos para fechar o preço total. Reprodutores não entram na regra de venda dos machos nem na venda automática por lotação, mas sofrem a mortalidade configurada. A compra dos bois não aumenta automaticamente a natalidade. A aplicação do cadastro continua com propriedade individual; frações compartilhadas são usadas somente no teste.

As compras são financiadas pelos aportes iniciais exibidos no resultado, sem consumir o caixa real. Os aportes futuros são adicionais à compra e seguem o mesmo modelo de receitas, custos, perdas e reserva da projeção. Cotas e manutenção mensal usam o rebanho cadastrado e as novas compras; a curva e os aportes futuros também incluem a inferência de crias desde as compras antigas. A capacidade escolhida no teste limita o estoque projetado por vendas elegíveis, e a interface informa quando a compra pressiona essa lotação. Sem cabeças, os custos fixos e aportes são distribuídos igualmente entre os participantes.


### Vendas e retorno no teste

Após calcular, o teste mostra também o grafo genealógico do cenário selecionado, com anos e filtro por participante. O quadro de retorno segue o mesmo cenário e filtro.

A venda ocorre uma vez a cada período futuro de 12 meses: todas as crias elegíveis, de ambos os sexos, são vendidas a partir de 6@. Não há retenção de fêmeas para reposição neste cenário. Matrizes existentes permanecem até descarte ou venda adicional por lotação; reprodutores são preservados. A lotação máxima é editável e nunca autoriza vender abaixo de 6@: excessos impossíveis de resolver são exibidos na tabela.

Premissas editáveis: bezerro R$450/@, novilha R$370/@ (ponto médio da faixa R$350–390 informada), retenção de 10% de cada venda para o caixa, ganho diário de 0,5 kg e base da arroba (carcaça ou peso vivo). A base inicial é carcaça: kg vivo × rendimento ÷ 15; com rendimento de 50%, 6@ são 180 kg vivos. O ganho é aproximado, comum aos animais, limitado aos pesos máximos do modelo. Fêmeas de 12 a 35 meses usam o preço de novilha; machos até 23 meses e fêmeas abaixo de 12 meses usam o de bezerro. Adultos usam a arroba da fazenda. Preços permanecem constantes; os custos seguem a inflação cadastrada.

A receita bruta é dividida em caixa retido e distribuição ao dono dos animais vendidos. Somente a parcela retida entra no caixa e financia despesas e reservas; o restante dos custos exige aporte. O saldo de dinheiro acumulado deduz compras do teste e aportes futuros das distribuições. A taxa de retorno em caixa usa como base o valor estimado do rebanho inicial mais compras e aportes; não é uma TIR nem inclui liquidação do patrimônio final, impostos ou taxas. Inferências anteriores à data do teste continuam seguindo as premissas históricas da aba Projeções e não geram dinheiro real.
