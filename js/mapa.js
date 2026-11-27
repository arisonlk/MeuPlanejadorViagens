/*
 * Meu Planejador de Viagens - mapa e rotas.
 * Serviços utilizados (gratuitos, sem chave de API):
 *   - Leaflet + OpenStreetMap para exibição do mapa;
 *   - Nominatim para busca de cidades e endereços;
 *   - OSRM para cálculo e desenho da rota.
 *
 * Política do Nominatim respeitada neste arquivo: no máximo 1 requisição por segundo,
 * busca iniciada apenas pelo usuário (mínimo de 3 caracteres), debounce de 500 ms,
 * cache local, sem consultas em massa e sem tentativa de definir User-Agent pelo navegador
 * (o navegador envia o Referer da página quando ela é servida por HTTP).
 */
(function () {
    'use strict';

    const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
    const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';
    const INTERVALO_MINIMO_ENTRE_BUSCAS_MS = 1100;
    const ESPERA_APOS_DIGITAR_MS = 500;
    const MINIMO_CARACTERES = 3;
    const TEMPO_LIMITE_MS = 15000;
    const CENTRO_BRASIL = [-14.2, -51.9];
    const ZOOM_INICIAL = 4;

    document.addEventListener('DOMContentLoaded', function () {
        const elementos = {
            mapa: document.getElementById('mapa-leaflet'),
            origem: document.getElementById('origem'),
            destino: document.getElementById('destino'),
            sugestoes: {
                origem: document.getElementById('sugestoes-origem'),
                destino: document.getElementById('sugestoes-destino')
            },
            botaoCalcular: document.getElementById('botao-calcular-rota'),
            botaoLimpar: document.getElementById('botao-limpar-rota'),
            botaoInverter: document.getElementById('botao-inverter'),
            aviso: document.getElementById('aviso-rota'),
            resultados: document.getElementById('resultados-rota'),
            distancia: document.getElementById('resultado-distancia'),
            duracao: document.getElementById('resultado-duracao'),
            nomeOrigem: document.getElementById('resultado-origem'),
            nomeDestino: document.getElementById('resultado-destino')
        };

        if (!elementos.mapa) return;

        const entradas = { origem: elementos.origem, destino: elementos.destino };
        const selecoes = { origem: null, destino: null };
        const marcadores = { origem: null, destino: null };
        const resultados = { origem: [], destino: [] };
        const indiceAtivo = { origem: -1, destino: -1 };
        const timers = { origem: null, destino: null };
        const controladoresBusca = { origem: null, destino: null };
        const cacheBuscas = new Map();

        let mapa = null;
        let grupoRotas = null;
        let controladorRota = null;
        let ultimaBuscaEm = 0;
        let filaBuscas = Promise.resolve();
        let classeAviso = '';

        function utilitarios() {
            if (!window.PlanejadorViagens) window.PlanejadorViagens = {};
            return window.PlanejadorViagens;
        }

        function formatarDecimal(valor, casas) {
            const api = utilitarios();
            if (typeof api.formatarDecimal === 'function') return api.formatarDecimal(valor, casas);
            const numero = Number(valor);
            if (!Number.isFinite(numero)) return '0';
            return new Intl.NumberFormat('pt-BR', {
                minimumFractionDigits: casas,
                maximumFractionDigits: casas
            }).format(numero);
        }

        function formatarDuracao(segundos) {
            const totalMinutos = Math.round(Number(segundos) / 60);
            if (!Number.isFinite(totalMinutos) || totalMinutos < 0) return '—';
            const horas = Math.floor(totalMinutos / 60);
            const minutos = totalMinutos % 60;
            if (horas === 0) return minutos + ' min';
            if (minutos === 0) return horas + ' h';
            return horas + ' h ' + minutos + ' min';
        }

        function definirAviso(mensagem, tipo) {
            if (!elementos.aviso) return;
            elementos.aviso.textContent = mensagem;
            elementos.aviso.className = 'aviso-rota ' + tipo;
            elementos.aviso.hidden = false;
            classeAviso = tipo;
        }

        function limparAviso() {
            if (!elementos.aviso) return;
            elementos.aviso.textContent = '';
            elementos.aviso.hidden = true;
            elementos.aviso.className = 'aviso-rota';
            classeAviso = '';
        }

        function limparAvisoInformativo() {
            if (classeAviso === 'info') limparAviso();
        }

        function resumirNome(item) {
            const endereco = item.address || {};
            const local = endereco.city || endereco.town || endereco.village ||
                endereco.municipality || endereco.county || endereco.suburb || '';
            const uf = endereco.state_code || endereco.state || '';
            const pais = endereco.country || '';
            const partes = [local, uf, pais].filter(Boolean);
            if (partes.length) return partes.join(', ');
            return String(item.display_name || 'Local selecionado').split(',').slice(0, 2).join(',').trim();
        }

        function inicializarMapa() {
            if (typeof L === 'undefined') {
                definirAviso('O mapa não pôde ser carregado. Verifique sua conexão com a internet e recarregue a página.', 'erro');
                return false;
            }

            try {
                mapa = L.map('mapa-leaflet', {
                    center: CENTRO_BRASIL,
                    zoom: ZOOM_INICIAL,
                    zoomControl: true,
                    attributionControl: true
                });

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Busca: <a href="https://nominatim.org/">Nominatim</a> | Rota: OSRM'
                }).addTo(mapa);

                grupoRotas = L.layerGroup().addTo(mapa);
                return true;
            } catch (erro) {
                definirAviso('Não foi possível iniciar o mapa. Verifique sua conexão e tente novamente.', 'erro');
                return false;
            }
        }

        /* Executa tarefas em fila, garantindo intervalo mínimo entre buscas no Nominatim. */
        function agendarBusca(tarefa) {
            const execucao = filaBuscas.then(async function () {
                const agora = Date.now();
                const espera = Math.max(0, INTERVALO_MINIMO_ENTRE_BUSCAS_MS - (agora - ultimaBuscaEm));
                if (espera > 0) await new Promise(function (resolve) { setTimeout(resolve, espera); });
                ultimaBuscaEm = Date.now();
                return tarefa();
            });
            filaBuscas = execucao.catch(function () { /* a fila continua mesmo após um erro */ });
            return execucao;
        }

        function buscarComLimite(url, opcoes) {
            const controladorLocal = new AbortController();
            let expirou = false;

            function abortarLocal() { controladorLocal.abort(); }
            if (opcoes.signal) {
                if (opcoes.signal.aborted) controladorLocal.abort();
                else opcoes.signal.addEventListener('abort', abortarLocal);
            }

            const temporizador = setTimeout(function () {
                expirou = true;
                controladorLocal.abort();
            }, TEMPO_LIMITE_MS);

            return fetch(url, Object.assign({}, opcoes, { signal: controladorLocal.signal }))
                .then(function (resposta) {
                    if (!resposta.ok) throw new Error('O serviço respondeu com erro ' + resposta.status + '.');
                    return resposta.json();
                })
                .catch(function (erro) {
                    if (expirou) throw new Error('O serviço demorou para responder.');
                    throw erro;
                })
                .finally(function () {
                    clearTimeout(temporizador);
                    if (opcoes.signal) opcoes.signal.removeEventListener('abort', abortarLocal);
                });
        }

        function buscarLocais(termo, sinal) {
            const parametros = new URLSearchParams({
                q: termo,
                format: 'jsonv2',
                addressdetails: '1',
                limit: '6',
                'accept-language': 'pt-BR'
            });
            return buscarComLimite(NOMINATIM_URL + '?' + parametros.toString(), {
                signal: sinal,
                headers: { 'Accept-Language': 'pt-BR' }
            }).then(function (dados) {
                if (!Array.isArray(dados)) throw new Error('Resposta inesperada do serviço de busca.');
                return dados.filter(function (item) {
                    return Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon));
                });
            });
        }

        function fecharSugestoes(tipo) {
            const caixa = elementos.sugestoes[tipo];
            if (!caixa) return;
            caixa.hidden = true;
            caixa.innerHTML = '';
            resultados[tipo] = [];
            indiceAtivo[tipo] = -1;
            if (entradas[tipo]) {
                entradas[tipo].setAttribute('aria-expanded', 'false');
                entradas[tipo].removeAttribute('aria-activedescendant');
            }
        }

        function destacarSugestao(tipo, indice) {
            const itens = Array.prototype.slice.call(elementos.sugestoes[tipo].querySelectorAll('.sugestao-item'));
            itens.forEach(function (item, posicao) {
                const selecionada = posicao === indice;
                item.classList.toggle('selecionada', selecionada);
                item.setAttribute('aria-selected', selecionada ? 'true' : 'false');
            });
            if (itens[indice]) {
                itens[indice].scrollIntoView({ block: 'nearest' });
                if (entradas[tipo]) entradas[tipo].setAttribute('aria-activedescendant', itens[indice].id);
            } else if (entradas[tipo]) {
                entradas[tipo].removeAttribute('aria-activedescendant');
            }
        }

        function mostrarSugestoes(tipo, dados) {
            const caixa = elementos.sugestoes[tipo];
            if (!caixa) return;
            caixa.innerHTML = '';
            resultados[tipo] = dados;
            indiceAtivo[tipo] = -1;

            if (!dados.length) {
                const mensagem = document.createElement('div');
                mensagem.className = 'sugestao-mensagem';
                mensagem.textContent = 'Nenhum local encontrado. Tente outro termo.';
                caixa.appendChild(mensagem);
            } else {
                dados.forEach(function (item, indice) {
                    const botao = document.createElement('button');
                    botao.type = 'button';
                    botao.className = 'sugestao-item';
                    botao.id = 'sugestao-' + tipo + '-' + indice;
                    botao.setAttribute('role', 'option');
                    botao.setAttribute('aria-selected', 'false');
                    botao.textContent = item.display_name;

                    const detalhe = document.createElement('small');
                    detalhe.textContent = [item.category, item.type].filter(Boolean).join(' · ') || resumirNome(item);
                    botao.appendChild(detalhe);

                    botao.addEventListener('mousedown', function (evento) { evento.preventDefault(); });
                    botao.addEventListener('click', function () { selecionarResultado(tipo, indice); });
                    caixa.appendChild(botao);
                });
            }

            caixa.hidden = false;
            entradas[tipo].setAttribute('aria-expanded', 'true');
        }

        function executarBusca(tipo, termo) {
            const chave = termo.trim().toLocaleLowerCase('pt-BR');
            if (cacheBuscas.has(chave)) {
                mostrarSugestoes(tipo, cacheBuscas.get(chave));
                return;
            }

            if (controladoresBusca[tipo]) controladoresBusca[tipo].abort();
            const controlador = new AbortController();
            controladoresBusca[tipo] = controlador;

            definirAviso('Consultando o serviço de busca...', 'info');

            agendarBusca(function () { return buscarLocais(termo, controlador.signal); })
                .then(function (dados) {
                    if (controlador.signal.aborted) return;
                    cacheBuscas.set(chave, dados);
                    mostrarSugestoes(tipo, dados);
                    limparAvisoInformativo();
                })
                .catch(function (erro) {
                    if (erro && erro.name === 'AbortError') return;
                    fecharSugestoes(tipo);
                    definirAviso('Serviço de busca indisponível no momento. Verifique sua conexão e tente novamente.', 'erro');
                });
        }

        function adicionarMarcador(tipo) {
            const ponto = selecoes[tipo];
            if (!mapa || !ponto) return;

            if (marcadores[tipo]) mapa.removeLayer(marcadores[tipo]);

            const letra = tipo === 'origem' ? 'O' : 'D';
            const icone = L.divIcon({
                className: 'marcador-simbolo',
                html: '<div class="marcador-rota marcador-' + tipo + '"><span>' + letra + '</span></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 29]
            });

            marcadores[tipo] = L.marker([ponto.lat, ponto.lon], {
                icon: icone,
                title: ponto.curto,
                alt: (tipo === 'origem' ? 'Origem: ' : 'Destino: ') + ponto.curto
            }).addTo(mapa);
        }

        function ajustarMapaParaPontos() {
            if (!mapa) return;
            if (selecoes.origem && selecoes.destino) {
                const limites = L.latLngBounds(
                    [selecoes.origem.lat, selecoes.origem.lon],
                    [selecoes.destino.lat, selecoes.destino.lon]
                );
                mapa.fitBounds(limites.pad(0.25), { maxZoom: 12 });
            } else if (selecoes.origem || selecoes.destino) {
                const ponto = selecoes.origem || selecoes.destino;
                mapa.setView([ponto.lat, ponto.lon], 10);
            }
        }

        function invalidarRota() {
            const api = utilitarios();
            const tinhaRota = Boolean(api.estado && api.estado.rota);
            if (grupoRotas) grupoRotas.clearLayers();
            if (elementos.resultados) elementos.resultados.hidden = true;
            if (api.estado) api.estado.rota = null;
            if (tinhaRota) document.dispatchEvent(new CustomEvent('rota:invalidada'));
        }

        function selecionarResultado(tipo, indice) {
            const item = resultados[tipo][indice];
            if (!item) return;

            const lat = Number(item.lat);
            const lon = Number(item.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                definirAviso('O local selecionado não possui coordenadas válidas.', 'erro');
                return;
            }

            selecoes[tipo] = {
                nome: item.display_name,
                curto: resumirNome(item),
                lat: lat,
                lon: lon
            };
            entradas[tipo].value = selecoes[tipo].curto;
            fecharSugestoes(tipo);
            invalidarRota();
            adicionarMarcador(tipo);
            ajustarMapaParaPontos();
            limparAviso();
        }

        function aoDigitar(tipo) {
            if (timers[tipo]) clearTimeout(timers[tipo]);
            if (controladoresBusca[tipo]) controladoresBusca[tipo].abort();
            fecharSugestoes(tipo);
            selecoes[tipo] = null;
            if (marcadores[tipo] && mapa) {
                mapa.removeLayer(marcadores[tipo]);
                marcadores[tipo] = null;
            }
            invalidarRota();

            const termo = entradas[tipo].value.trim();
            if (termo.length < MINIMO_CARACTERES) return;

            timers[tipo] = setTimeout(function () {
                executarBusca(tipo, termo);
            }, ESPERA_APOS_DIGITAR_MS);
        }

        function aoPressionarTecla(tipo, evento) {
            const caixa = elementos.sugestoes[tipo];
            if (caixa.hidden) return;
            const itens = Array.prototype.slice.call(caixa.querySelectorAll('.sugestao-item'));

            if (evento.key === 'Escape') {
                fecharSugestoes(tipo);
                return;
            }
            if (!itens.length || (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp' && evento.key !== 'Enter')) return;

            evento.preventDefault();
            if (evento.key === 'ArrowDown') {
                indiceAtivo[tipo] = (indiceAtivo[tipo] + 1) % itens.length;
                destacarSugestao(tipo, indiceAtivo[tipo]);
            } else if (evento.key === 'ArrowUp') {
                indiceAtivo[tipo] = (indiceAtivo[tipo] - 1 + itens.length) % itens.length;
                destacarSugestao(tipo, indiceAtivo[tipo]);
            } else if (evento.key === 'Enter') {
                const indice = indiceAtivo[tipo] >= 0 ? indiceAtivo[tipo] : 0;
                selecionarResultado(tipo, indice);
            }
        }

        function preencherResultados(distanciaKm, duracaoSegundos) {
            elementos.distancia.textContent = formatarDecimal(distanciaKm, 1) + ' km';
            elementos.duracao.textContent = formatarDuracao(duracaoSegundos);
            elementos.nomeOrigem.textContent = selecoes.origem.curto;
            elementos.nomeDestino.textContent = selecoes.destino.curto;
            elementos.resultados.hidden = false;
        }

        function desenharRota(coordenadas) {
            const pontos = coordenadas.map(function (par) { return [Number(par[1]), Number(par[0])]; });
            if (!pontos.length) throw new Error('A rota não possui geometria.');

            grupoRotas.clearLayers();
            grupoRotas.addLayer(L.polyline(pontos, { color: '#ffffff', weight: 9, opacity: 0.85 }));
            const linha = L.polyline(pontos, { color: '#0e6b6b', weight: 5, opacity: 0.95 });
            grupoRotas.addLayer(linha);
            mapa.fitBounds(linha.getBounds().pad(0.12), { maxZoom: 14 });
        }

        async function calcularRota() {
            if (!mapa) return;

            if (!selecoes.origem || !selecoes.destino) {
                definirAviso('Selecione a origem e o destino a partir das sugestões antes de calcular.', 'erro');
                return;
            }

            if (selecoes.origem.lat === selecoes.destino.lat && selecoes.origem.lon === selecoes.destino.lon) {
                definirAviso('Origem e destino são o mesmo local. Escolha outro destino.', 'erro');
                return;
            }

            if (controladorRota) controladorRota.abort();
            const controladorLocal = new AbortController();
            controladorRota = controladorLocal;

            const origem = selecoes.origem;
            const destino = selecoes.destino;
            const url = OSRM_URL + origem.lon + ',' + origem.lat + ';' + destino.lon + ',' + destino.lat +
                '?overview=full&geometries=geojson&steps=false&alternatives=false';

            elementos.botaoCalcular.disabled = true;
            elementos.botaoCalcular.textContent = 'Calculando...';
            definirAviso('Calculando a rota...', 'info');

            function falha(mensagem) {
                const erro = new Error(mensagem);
                erro.amigavel = true;
                throw erro;
            }

            try {
                const dados = await buscarComLimite(url, { signal: controladorLocal.signal });
                const rota = dados && Array.isArray(dados.routes) ? dados.routes[0] : null;

                if (!rota) falha('Nenhuma rota encontrada entre os pontos informados.');

                const distanciaKm = Number(rota.distance) / 1000;
                const duracaoSegundos = Number(rota.duration);
                if (!Number.isFinite(distanciaKm) || !Number.isFinite(duracaoSegundos)) {
                    falha('O serviço não retornou distância e duração válidas.');
                }
                if (!rota.geometry || !Array.isArray(rota.geometry.coordinates)) {
                    falha('O serviço não retornou um trajeto válido.');
                }

                desenharRota(rota.geometry.coordinates);
                preencherResultados(distanciaKm, duracaoSegundos);

                const detalhes = {
                    origem: origem,
                    destino: destino,
                    distanciaKm: distanciaKm,
                    duracaoSegundos: duracaoSegundos,
                    distanciaTexto: formatarDecimal(distanciaKm, 1) + ' km',
                    duracaoTexto: formatarDuracao(duracaoSegundos)
                };

                const api = utilitarios();
                if (api.estado) api.estado.rota = detalhes;
                document.dispatchEvent(new CustomEvent('rota:calculada', { detail: detalhes }));
                definirAviso('Rota calculada com sucesso. A distância e a duração são estimativas do OSRM.', 'sucesso');
            } catch (erro) {
                if (erro && erro.name !== 'AbortError' && controladorRota === controladorLocal) {
                    const mensagem = erro && erro.amigavel
                        ? erro.message
                        : 'Serviço de rotas indisponível no momento. Verifique a conexão e tente novamente em instantes.';
                    definirAviso(mensagem, 'erro');
                }
            } finally {
                if (controladorRota === controladorLocal) {
                    elementos.botaoCalcular.disabled = false;
                    elementos.botaoCalcular.textContent = 'Calcular rota';
                    controladorRota = null;
                }
            }
        }

        function inverter() {
            const textoOrigem = entradas.origem.value;
            entradas.origem.value = entradas.destino.value;
            entradas.destino.value = textoOrigem;

            const selecaoOrigem = selecoes.origem;
            selecoes.origem = selecoes.destino;
            selecoes.destino = selecaoOrigem;

            fecharSugestoes('origem');
            fecharSugestoes('destino');

            if (marcadores.origem && mapa) mapa.removeLayer(marcadores.origem);
            if (marcadores.destino && mapa) mapa.removeLayer(marcadores.destino);
            marcadores.origem = null;
            marcadores.destino = null;
            adicionarMarcador('origem');
            adicionarMarcador('destino');

            invalidarRota();
            ajustarMapaParaPontos();

            if (selecoes.origem && selecoes.destino) calcularRota();
            else definirAviso('Origem e destino invertidos. Selecione os locais nas sugestões para calcular.', 'info');
        }

        function limpar() {
            if (controladorRota) controladorRota.abort();
            Object.keys(controladoresBusca).forEach(function (tipo) {
                if (controladoresBusca[tipo]) controladoresBusca[tipo].abort();
                if (timers[tipo]) clearTimeout(timers[tipo]);
            });

            Object.keys(entradas).forEach(function (tipo) {
                entradas[tipo].value = '';
                selecoes[tipo] = null;
                fecharSugestoes(tipo);
                if (marcadores[tipo] && mapa) mapa.removeLayer(marcadores[tipo]);
                marcadores[tipo] = null;
            });

            invalidarRota();
            limparAviso();
            if (mapa) mapa.setView(CENTRO_BRASIL, ZOOM_INICIAL);
        }

        Object.keys(entradas).forEach(function (tipo) {
            const entrada = entradas[tipo];
            entrada.addEventListener('input', function () { aoDigitar(tipo); });
            entrada.addEventListener('keydown', function (evento) { aoPressionarTecla(tipo, evento); });
        });

        document.addEventListener('click', function (evento) {
            Object.keys(entradas).forEach(function (tipo) {
                const caixa = elementos.sugestoes[tipo];
                if (caixa && !caixa.hidden && !caixa.contains(evento.target) && evento.target !== entradas[tipo]) {
                    fecharSugestoes(tipo);
                }
            });
        });

        if (elementos.botaoCalcular) elementos.botaoCalcular.addEventListener('click', calcularRota);
        if (elementos.botaoLimpar) elementos.botaoLimpar.addEventListener('click', limpar);
        if (elementos.botaoInverter) elementos.botaoInverter.addEventListener('click', inverter);

        /* API somente leitura para módulos que precisam do mesmo mapa, sem nova instância. */
        function normalizarNome(texto) {
            return String(texto === null || texto === undefined ? '' : texto).trim().toLocaleLowerCase('pt-BR');
        }

        function obterCoordenadaEmCache(nome) {
            const alvo = normalizarNome(nome);
            if (!alvo) return null;

            const candidatos = [];
            cacheBuscas.forEach(function (itens, chave) {
                if (chave === alvo || chave.indexOf(alvo) >= 0 || alvo.indexOf(chave) >= 0) {
                    itens.forEach(function (item) { candidatos.push(item); });
                }
            });
            Object.keys(selecoes).forEach(function (tipo) {
                if (selecoes[tipo]) {
                    candidatos.push({
                        display_name: selecoes[tipo].nome || selecoes[tipo].curto,
                        lat: selecoes[tipo].lat,
                        lon: selecoes[tipo].lon
                    });
                }
            });

            const encontrado = candidatos.find(function (item) {
                const nomeItem = normalizarNome(item.display_name);
                return nomeItem === alvo || nomeItem.indexOf(alvo) >= 0 || alvo.indexOf(nomeItem) >= 0;
            });
            if (!encontrado) return null;

            const lat = Number(encontrado.lat);
            const lon = Number(encontrado.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            return { lat: lat, lon: lon, nome: encontrado.display_name || nome };
        }

        function copiarSelecao(ponto) {
            if (!ponto) return null;
            return { nome: ponto.nome, curto: ponto.curto, lat: ponto.lat, lon: ponto.lon };
        }

        const apiMapa = utilitarios();
        if (!apiMapa.mapa) apiMapa.mapa = {};
        apiMapa.mapa.obterInstancia = function () { return mapa; };
        apiMapa.mapa.obterCoordenada = obterCoordenadaEmCache;
        apiMapa.mapa.obterSelecoes = function () {
            return { origem: copiarSelecao(selecoes.origem), destino: copiarSelecao(selecoes.destino) };
        };

        inicializarMapa();
    });
})();
