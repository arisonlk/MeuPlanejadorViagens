# Meu Planejador de Viagens

Aplicação web estática, em português, para planejar viagens de carro, calcular custos e organizar a programação. Todo o processamento acontece no navegador: não há backend, banco de dados, login nem serviço pago.

## Funcionalidades

O site possui oito módulos, acessíveis pelo menu lateral:

1. **Início** — visão geral e atalhos.
2. **Mapa e Rotas** — origem, destino e paradas com Leaflet/OpenStreetMap; busca de coordenadas e cálculo de rota.
3. **Combustível** — consumo urbano/rodoviário/misto, litros, preço por litro, custo total e custo por km.
4. **Tempo e Velocidade** — comparação de duração para 80, 120 e 140 km/h.
5. **Pedágios e Despesas** — cadastro de pedágios e outras despesas por categoria.
6. **Resumo Financeiro** — consolidação dos custos, custo por km e valor por viajante.
7. **Histórico de Viagens** — salvamento local de viagens, detalhes e exportação em PDF.
8. **Painel da Viagem** — orçamento, custo realizado, saldo, percentual utilizado, lançamentos, categorias, atividades, cidades, gráficos, programação e exportação em PDF.

Os cálculos aprovados nas etapas anteriores foram preservados. O custo do Painel da Viagem parte do resumo financeiro; registros importados são exibidos como visualização e não são somados uma segunda vez.

## Dados e privacidade

- Os dados ficam somente no **LocalStorage do navegador**, nas chaves `mpv.veiculo`, `mpv.despesas`, `mpv.historico`, `mpv.tripDashboard`, `mpv.tripActivities` e `mpv.tripCities`.
- Nada é enviado para servidores próprios. A interface consulta apenas serviços públicos externos para mapa, geocodificação e rotas (OpenStreetMap, Nominatim e OSRM) e carrega Leaflet/jsPDF por CDN.
- Não há senhas, tokens, chaves de API ou login.

## Executar localmente

Basta abrir o arquivo `index.html` no navegador.

Se preferir servir por HTTP (recomendado para persistência estável do LocalStorage):

Abra um terminal dentro da pasta do projeto e execute:

```powershell
python -m http.server 8130 --bind 127.0.0.1
```

Depois acesse `http://127.0.0.1:8130/index.html`.

Não é necessário PHP, Node, banco de dados nem qualquer processo de build. Para usar mapa e PDF é preciso ter conexão com a internet na primeira carga desses recursos.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub (o repositório deve ser criado por você; nenhum foi criado automaticamente).
2. Envie para a branch principal os arquivos desta pasta: `index.html`, `css/`, `js/`, `README.md`, `.nojekyll` e `.gitignore`.
3. Em **Settings → Pages**, escolha **Deploy from a branch**, a branch principal e a pasta **/ (root)**.
4. Acesse `https://<usuario>.github.io/<nome-do-repositorio>/`.

Todos os caminhos internos são relativos (`css/style.css`, `js/*.js`), portanto funcionam tanto na raiz de um domínio quanto em um subdiretório de projeto do GitHub Pages. O arquivo `.nojekyll` evita processamento Jekyll e é inofensivo quando não há pastas com `_`.

## Estrutura

```
index.html
README.md
.nojekyll
.gitignore
css/
  style.css
js/
  app.js
  mapa.js
  combustivel.js
  velocidade.js
  despesas.js
  resumo.js
  historico.js
  tripDashboard.js
```

## Limitações

- Recursos externos (mapa, Nominatim, OSRM e jsPDF) exigem internet e estão sujeitos às políticas de uso desses serviços; se falharem, o restante do site continua funcionando e mensagens claras são exibidas.
- Os dados são locais a cada navegador/dispositivo: não há sincronização entre máquinas.
- PDFs são gerados no navegador; a primeira geração depende do carregamento do jsPDF pela CDN.
