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

| Aba             | Colunas                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `Animais`       | `id`, `tag`, `sex`, `born`, `weight`, `owner`, `_reserved` (coluna antiga, sem uso), `status` |
| `Participantes` | `id`, `name`, `color`                                                                         |
| `Lancamentos`   | `id`, `date`, `kind`, `category`, `description`, `amount`, `investor`                         |
| `Configuracoes` | `chave`, `valor`                                                                              |

Cadastre primeiro os participantes, depois os animais. `owner` referencia o `id` do participante. As datas são textos ISO `AAAA-MM-DD`; pesos e valores são números, sem símbolos monetários. Preserve nomes de abas e cabeçalhos. `status`: `ativo`, `vendido`, `morto`; `sex`: `F`, `M`; `kind`: `despesa`, `receita`, `aporte`. Os IDs são gerados pela aplicação.

A inicialização prepara 10 mil linhas de animais, 20 mil de lançamentos e de movimentações, e 500 de participantes. O leitor usa esses limites para evitar leituras ilimitadas: amplie os intervalos e a grade se a operação crescer. Use abas exclusivas da aplicação, sem fórmulas, linhas mescladas ou tabelas auxiliares no meio dos registros.

O acesso aos dados exige uma sessão com senha compartilhada da fazenda, cookie HttpOnly, SameSite Strict e duração de 24 horas. Em HTTPS, o cookie usa Secure. A troca da senha invalida sessões anteriores. Não há perfis individuais de usuário. O bloqueio de tentativas é em memória e por instância; uma implantação pública de maior porte deve usar autenticação individual e controle de acesso da plataforma.

## Câmera do curral

A página privada `/curral`, disponível no menu, reserva o espaço para a futura câmera da Fazenda Calumbi. Ela exibe explicitamente que o equipamento ainda não foi instalado. Não há transmissão, gravação, captura de imagens ou conexão com equipamentos nesta versão. A implementação do vídeo dependerá do modelo da câmera, da conexão na propriedade e do serviço escolhido; as credenciais deverão permanecer no servidor.

## Rebanho por integrante e grafo animado

Na projeção, escolha **Toda a fazenda** ou um integrante. O simulador preserva o proprietário de cada coorte: idade, sexo, crias, mortalidade, vendas, descarte e valor dos animais são calculados por dono. As crias projetadas seguem a propriedade da matriz; isso não cria animais reais automaticamente. Uma pessoa com apenas machos não recebe uma parcela fictícia dos nascimentos das matrizes de outras pessoas.

A lotação é compartilhada: excedentes são vendidos começando pelos mais jovens, proporcionalmente entre donos de animais da mesma idade. A ordem dos participantes não favorece ninguém. Custos anuais e aportes são rateados pelo rebanho médio (início + fim do ano) de cada integrante. O caixa continua sendo da fazenda, e sua parcela visual é distribuída pela participação ao fim do ano; não é um saldo pessoal. Se não houver animais, despesas fixas permanecem no caixa comum sem rateio por cabeça.

O grafo é uma rede radial: a Calumbi e uma vaquinha animada ficam no núcleo; cada integrante tem um ramo colorido; as vaquinhas menores representam animais agrupados por ano de nascimento, sexo e fase de vida. O botão **Ver evolução** e o controle de ano mostram a rede crescendo ou diminuindo. É possível arrastar a rede, ampliar, restaurar o enquadramento e clicar num integrante para ver seus números. Cada vaquinha representa até a quantidade indicada na legenda; o último grupo pode ser fracionário. As recém-nascidas têm até 11 meses, as jovens vão até o limiar de idade adulta configurado e as adultas começam nesse limiar. Cada passo anual aumenta as idades em 12 meses; novas crias começam com zero meses. Clicar numa vaquinha mostra a faixa de idade do grupo. O desenho central usa apenas geometria SVG com escala explícita, sem SVG aninhado sujeito a redimensionamento por CSS. Os vínculos do grafo organizam a projeção e não representam parentesco real. A interface respeita a preferência de movimento reduzido do dispositivo. Os modos **Radial** e **De cima para baixo** alternam entre rede radial e organização hierárquica (fazenda → integrantes → animais). Selecionar um integrante no grafo ou na legenda o isola com seu rebanho e aproxima o enquadramento; clicar numa vaquinha mostra apenas aquele nó com zoom. Use **Todos** ou os atalhos de retorno para recuperar o contexto. A seleção e as idades são mantidas ao avançar os anos; grupos que saem da projeção exibem um aviso, sem mostrar dados antigos.

IDs de animais novos são UUIDs gerados no servidor (ou no navegador, na demonstração). O brinco é uma identificação legível e única no cadastro. O ID aparece na ficha e permanece nas compras, transferências e baixas. Eventos referenciam esse ID, permitindo acompanhar a trajetória do animal.

## Como os cálculos funcionam

- **Participação:** cabeças ativas do participante ÷ total de cabeças ativas. Custos mensais atuais usam essa proporção. Aportes projetados usam a participação no rebanho médio de cada ano. Venda ou morte altera as cotas. As crias precisam ser cadastradas com seu proprietário; não há transferência automática de propriedade.
- **Patrimônio estimado:** peso vivo × rendimento de carcaça ÷ 15 × preço da arroba. É uma equivalência simplificada, aplicada a todas as categorias. O patrimônio proporcional por participante é o valor total rateado por cabeça, que pode diferir da avaliação dos seus animais individuais.
- **Arroba:** R$ 375 é a hipótese inicial, baseada na faixa de R$ 350–400 informada pelo proprietário. A pesquisa não confirmou uma cotação atual específica do Agreste. Não há atualização automática. Referência para consulta: [Scot](https://www.scotconsultoria.com.br/cotacoes/).
- **Reprodução:** coortes anuais por idade e sexo; fêmeas aptas no início do ano geram crias pela taxa de natalidade. Novas crias têm proporção de sexos 50/50; a retenção de fêmeas é configurável. Matrizes são descartadas no limite de idade, machos são vendidos na idade indicada e excedentes de lotação são vendidos começando pelas coortes mais recentes. Mortalidade de adultos e bezerros é aplicada separadamente. A mortalidade de recém-nascidos é descontada no nascimento. Valores fracionários representam expectativas, não animais cadastrados. A aplicação não simula gestações individuais.
- **Pesos projetados:** ganho de 90 kg por ano até 450 kg (fêmeas) ou 550 kg (machos); crias começam com 120 kg. Fêmeas não retidas são avaliadas com 180 kg. São hipóteses simplificadas, que exigem calibração com dados reais.
- **Caixa:** saldo inicial + receitas + aportes − despesas registradas. Nas projeções, vendas são receitas e custos anuais usam a média do rebanho inicial e final, mais custo fixo, com inflação. A reserva alvo soma meses de operação e valor esperado das perdas do ano. O aporte é o necessário para cobrir os custos e atingir essa reserva após as vendas. Fêmeas retidas fazem a reposição; não há compra automática de animais mortos.
- **Cenários:** base; seca (natalidade −20%, custo por cabeça +35%, arroba −10%, mortalidade de bezerros ×1,5); favorável (natalidade +10%, limitada a 95%, arroba +10%). Os multiplicadores são relativos à premissa, não pontos percentuais.
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
