/*
 * Meu Planejador de Viagens - painel avançado de viagens.
 * Todos os dados ficam no LocalStorage do navegador. Nenhum cálculo aprovado
 * é repetido: o custo base vem de estado.resumo e os lançamentos importados
 * apenas visualizam registros já contabilizados, sem somá-los outra vez.
 */
(function () {
    'use strict';

    const CHAVE_VIAGEM = 'mpv.tripDashboard';
    const CHAVE_ATIVIDADES = 'mpv.tripActivities';
    const CHAVE_CIDADES = 'mpv.tripCities';
    const NS_SVG = 'http://www.w3.org/2000/svg';

    const CATEGORIAS_INICIAIS = [
        'Hospedagem',
        'Avião',
        'Ônibus',
        'Transporte',
        'Estacionamento',
        'Internet e comunicação',
        'Ingressos',
        'Atividades',
        'Seguro',
        'Alimentação',
        'Outras despesas'
    ];

    const CORES = [
        '#0e6b6b', '#e8a13a', '#6aa9e0', '#9b7ede', '#62b98c',
        '#d97a7a', '#5f8fa8', '#c49a3a', '#7d7fb5', '#3f9c8f', '#a9b6c4'
    ];

    document.addEventListener('DOMContentLoaded', function () {
        const secao = document.getElementById('painel-viagem');
        if (!secao) return;

        const campos = {
            viagem: {
                formulario: document.getElementById('formulario-painel-viagem'),
                nome: document.getElementById('painel-nome'),
                inicio: document.getElementById('painel-data-inicial'),
                fim: document.getElementById('painel-data-final'),
                orcamento: document.getElementById('painel-orcamento'),
                moeda: document.getElementById('painel-moeda'),
                aviso: document.getElementById('aviso-painel-viagem')
            },
            indicadores: {
                inicio: document.getElementById('painel-kpi-inicio'),
                fim: document.getElementById('painel-kpi-fim'),
                orcamento: document.getElementById('painel-kpi-orcamento'),
                realizado: document.getElementById('painel-kpi-realizado'),
                saldo: document.getElementById('painel-kpi-saldo'),
                percentual: document.getElementById('painel-kpi-percentual'),
                base: document.getElementById('painel-kpi-base-resumo'),
                novos: document.getElementById('painel-kpi-novos'),
                historico: document.getElementById('painel-kpi-historico'),
                barra: document.getElementById('painel-barra-orcamento'),
                aviso: document.getElementById('aviso-painel-calculos')
            },
            integracao: {
                importar: document.getElementById('botao-importar-despesas'),
                irHistorico: document.getElementById('botao-ir-historico')
            },
            lancamento: {
                formulario: document.getElementById('formulario-lancamento'),
                descricao: document.getElementById('lancamento-descricao'),
                categoria: document.getElementById('lancamento-categoria'),
                valor: document.getElementById('lancamento-valor'),
                data: document.getElementById('lancamento-data'),
                situacao: document.getElementById('lancamento-situacao'),
                planejado: document.getElementById('lancamento-planejado'),
                salvar: document.getElementById('botao-salvar-lancamento'),
                cancelar: document.getElementById('botao-cancelar-lancamento'),
                aviso: document.getElementById('aviso-lancamento'),
                lista: document.getElementById('lista-lancamentos'),
                total: document.getElementById('total-lancamentos'),
                limpar: document.getElementById('botao-limpar-lancamentos')
            },
            categoria: {
                formulario: document.getElementById('formulario-categoria'),
                nome: document.getElementById('categoria-nome'),
                salvar: document.getElementById('botao-salvar-categoria'),
                cancelar: document.getElementById('botao-cancelar-categoria'),
                aviso: document.getElementById('aviso-categoria'),
                lista: document.getElementById('lista-categorias')
            },
            atividade: {
                formulario: document.getElementById('formulario-atividade'),
                data: document.getElementById('atividade-data'),
                inicio: document.getElementById('atividade-hora-inicial'),
                fim: document.getElementById('atividade-hora-final'),
                duracao: document.getElementById('atividade-duracao'),
                cidade: document.getElementById('atividade-cidade'),
                tipo: document.getElementById('atividade-tipo'),
                descricao: document.getElementById('atividade-descricao'),
                observacoes: document.getElementById('atividade-observacoes'),
                salvar: document.getElementById('botao-salvar-atividade'),
                cancelar: document.getElementById('botao-cancelar-atividade'),
                aviso: document.getElementById('aviso-atividade'),
                filtroData: document.getElementById('filtro-atividade-data'),
                filtroCidade: document.getElementById('filtro-atividade-cidade'),
                lista: document.getElementById('lista-atividades'),
                limpar: document.getElementById('botao-limpar-atividades')
            },
            cidade: {
                formulario: document.getElementById('formulario-cidade'),
                nome: document.getElementById('cidade-nome'),
                dias: document.getElementById('cidade-dias'),
                latitude: document.getElementById('cidade-latitude'),
                longitude: document.getElementById('cidade-longitude'),
                usarCoordenada: document.getElementById('botao-usar-coordenada'),
                salvar: document.getElementById('botao-salvar-cidade'),
                cancelar: document.getElementById('botao-cancelar-cidade'),
                aviso: document.getElementById('aviso-cidade'),
                lista: document.getElementById('lista-cidades'),
                limpar: document.getElementById('botao-limpar-cidades'),
                centralizar: document.getElementById('botao-centralizar-cidades'),
                avisoMapa: document.getElementById('aviso-mapa-painel')
            },
            graficos: {
                horas: document.getElementById('grafico-horas-dia'),
                orcamento: document.getElementById('grafico-orcamento-realizado'),
                categorias: document.getElementById('grafico-categorias'),
                legendaCategorias: document.getElementById('legenda-categorias'),
                pagos: document.getElementById('grafico-pagos-pendentes'),
                pago: document.getElementById('indicador-pago'),
                pendente: document.getElementById('indicador-pendente'),
                percentualPago: document.getElementById('indicador-percentual-pago'),
                percentualPendente: document.getElementById('indicador-percentual-pendente'),
                diasCidade: document.getElementById('grafico-dias-cidade')
            },
            exportacao: {
                botao: document.getElementById('botao-exportar-painel-pdf'),
                aviso: document.getElementById('aviso-painel-pdf')
            }
        };

        let viagem = {
            nome: '',
            dataInicial: '',
            dataFinal: '',
            orcamento: 0,
            moeda: 'BRL'
        };
        let lancamentos = [];
        let categorias = CATEGORIAS_INICIAIS.slice();
        let atividades = [];
        let cidades = [];
        let ocultas = [];
        let sincronizarImportacoes = false;
        let editandoLancamento = null;
        let editandoCategoria = null;
        let editandoAtividade = null;
        let editandoCidade = null;
        let grupoCidades = null;
        let temporizadorAviso = null;

        function api() {
            if (!window.PlanejadorViagens) window.PlanejadorViagens = {};
            return window.PlanejadorViagens;
        }

        function estado() {
            const util = api();
            if (!util.estado) util.estado = {};
            return util.estado;
        }

        function texto(valor) {
            return typeof valor === 'string' ? valor : '';
        }

        function numero(valor) {
            const bruto = String(valor === null || valor === undefined ? '' : valor)
                .trim().replace(/\s/g, '').replace(',', '.');
            return bruto === '' ? NaN : Number(bruto);
        }

        function numeroPositivo(valor) {
            const resultado = numero(valor);
            return Number.isFinite(resultado) && resultado > 0 ? resultado : 0;
        }

        function dataValida(valor) {
            return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
        }

        function horaValida(valor) {
            return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
        }

        function gerarId() {
            return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        }

        function formatarMoeda(valor) {
            const util = api();
            if (typeof util.formatarMoeda === 'function') return util.formatarMoeda(valor);
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor));
        }

        function formatarDecimal(valor, casas) {
            const util = api();
            if (typeof util.formatarDecimal === 'function') return util.formatarDecimal(valor, casas);
            return new Intl.NumberFormat('pt-BR', {
                minimumFractionDigits: casas,
                maximumFractionDigits: casas
            }).format(Number(valor));
        }

        function formatarData(valor) {
            if (!dataValida(valor)) return '—';
            const partes = valor.split('-');
            return partes[2] + '/' + partes[1] + '/' + partes[0];
        }

        function hoje() {
            const util = api();
            return typeof util.dataAtual === 'function' ? util.dataAtual() : new Date().toLocaleDateString('sv-SE');
        }

        function normalizarChave(nome) {
            return texto(nome).trim().toLocaleLowerCase('pt-BR');
        }

        function definirAviso(campo, mensagem, tipo) {
            if (!campo) return;
            campo.textContent = mensagem;
            campo.className = 'aviso-rota ' + (tipo || 'info');
            campo.hidden = false;
        }

        function limparAviso(campo) {
            if (!campo) return;
            campo.textContent = '';
            campo.hidden = true;
            campo.className = 'aviso-rota';
        }

        function avisarArmazenamento() {
            const campo = campos.viagem.aviso;
            definirAviso(campo, 'Os dados foram atualizados nesta sessão, mas não foi possível salvar no navegador.', 'erro');
            if (temporizadorAviso) clearTimeout(temporizadorAviso);
            temporizadorAviso = setTimeout(function () { limparAviso(campo); }, 6000);
        }

        function lerObjeto(chave, padrao) {
            const util = api();
            let valor;
            if (typeof util.lerLocal === 'function') valor = util.lerLocal(chave, padrao);
            else {
                try {
                    const bruto = localStorage.getItem(chave);
                    valor = bruto ? JSON.parse(bruto) : padrao;
                } catch (erro) {
                    valor = padrao;
                }
            }
            return valor && typeof valor === 'object' ? valor : padrao;
        }

        function gravar(chave, valor) {
            const util = api();
            let ok = false;
            if (typeof util.salvarLocal === 'function') ok = util.salvarLocal(chave, valor);
            else {
                try {
                    localStorage.setItem(chave, JSON.stringify(valor));
                    ok = true;
                } catch (erro) {
                    ok = false;
                }
            }
            if (!ok) {
                avisarArmazenamento();
            } else if (temporizadorAviso) {
                clearTimeout(temporizadorAviso);
                temporizadorAviso = null;
                limparAviso(campos.viagem.aviso);
            }
            return ok;
        }

        function normalizarViagem(dados) {
            const objeto = dados && typeof dados === 'object' ? dados : {};
            return {
                nome: texto(objeto.nome).slice(0, 100),
                dataInicial: dataValida(objeto.dataInicial) ? objeto.dataInicial : '',
                dataFinal: dataValida(objeto.dataFinal) ? objeto.dataFinal : '',
                orcamento: numeroPositivo(objeto.orcamento),
                moeda: 'BRL'
            };
        }

        function normalizarCategorias(lista) {
            const resultado = [];
            (Array.isArray(lista) ? lista : CATEGORIAS_INICIAIS).forEach(function (item) {
                const nome = texto(item).trim();
                if (nome && resultado.indexOf(nome) < 0) resultado.push(nome);
            });
            if (!resultado.length) return CATEGORIAS_INICIAIS.slice();
            /* Categoria de fallback: nunca pode desaparecer, pois recebe os lançamentos órfãos. */
            if (!resultado.some(function (item) { return normalizarChave(item) === 'outras despesas'; })) {
                resultado.push('Outras despesas');
            }
            return resultado;
        }

        function normalizarLancamento(item) {
            if (!item || typeof item !== 'object') return null;
            const valor = numeroPositivo(item.valor);
            if (!valor) return null;
            const referencia = item.referencia && typeof item.referencia === 'object'
                ? {
                    modulo: texto(item.referencia.modulo),
                    tipo: texto(item.referencia.tipo),
                    id: texto(item.referencia.id)
                }
                : null;
            const origem = item.origem === 'existente' || referencia ? 'existente' : 'painel';
            return {
                id: texto(item.id) || gerarId(),
                descricao: texto(item.descricao).slice(0, 120) || 'Lançamento',
                categoria: texto(item.categoria) || 'Outras despesas',
                valor: valor,
                valorPlanejado: numeroPositivo(item.valorPlanejado),
                data: dataValida(item.data) ? item.data : '',
                situacao: item.situacao === 'pendente' ? 'pendente' : 'pago',
                origem: origem,
                referencia: referencia,
                observacao: texto(item.observacao).slice(0, 240)
            };
        }

        function normalizarAtividade(item) {
            if (!item || typeof item !== 'object' || !dataValida(item.data)) return null;
            return {
                id: texto(item.id) || gerarId(),
                data: item.data,
                horaInicial: horaValida(item.horaInicial) ? item.horaInicial : '',
                horaFinal: horaValida(item.horaFinal) ? item.horaFinal : '',
                duracaoHoras: numeroPositivo(item.duracaoHoras),
                cidade: texto(item.cidade).slice(0, 80),
                tipo: texto(item.tipo).slice(0, 60),
                descricao: texto(item.descricao).slice(0, 120),
                observacoes: texto(item.observacoes).slice(0, 300)
            };
        }

        function normalizarCidade(item) {
            if (!item || typeof item !== 'object') return null;
            const nome = texto(item.nome).trim().slice(0, 80);
            if (!nome) return null;
            const lat = Number(item.lat);
            const lon = Number(item.lon);
            return {
                id: texto(item.id) || gerarId(),
                nome: nome,
                dias: numeroPositivo(item.dias),
                lat: Number.isFinite(lat) ? lat : null,
                lon: Number.isFinite(lon) ? lon : null,
                origem: ['manual', 'rota'].indexOf(item.origem) >= 0 ? item.origem : 'manual'
            };
        }

        function chaveReferencia(referencia) {
            if (!referencia) return '';
            return [referencia.modulo, referencia.tipo, referencia.id].join('|');
        }

        function categoriaExistente(categoria) {
            const encontrada = categorias.find(function (item) { return normalizarChave(item) === normalizarChave(categoria); });
            return encontrada || 'Outras despesas';
        }

        function converterCategoriaExistente(categoria) {
            const nome = texto(categoria);
            if (categorias.indexOf(nome) >= 0) return nome;
            if (nome === 'Manutenção') return 'Transporte';
            if (nome === 'Outros') return 'Outras despesas';
            return 'Outras despesas';
        }

        function construirImportados() {
            const resumo = estado().resumo || {};
            const despesas = estado().despesas || {};
            const itens = [];
            const dataPadrao = viagem.dataInicial || hoje();

            function adicionar(modulo, tipo, id, descricao, categoria, valor, data) {
                const valorSeguro = numeroPositivo(valor);
                if (!valorSeguro) return;
                const referencia = { modulo: modulo, tipo: tipo, id: texto(id) || tipo };
                const chave = chaveReferencia(referencia);
                if (ocultas.indexOf(chave) >= 0) return;
                itens.push({
                    id: 'importado-' + chave.replace(/[^a-zA-Z0-9]+/g, '-'),
                    descricao: descricao,
                    categoria: categoriaExistente(categoria),
                    valor: valorSeguro,
                    valorPlanejado: valorSeguro,
                    data: dataValida(data) ? data : dataPadrao,
                    situacao: 'pago',
                    origem: 'existente',
                    referencia: referencia,
                    observacao: 'Importado do resumo; já contabilizado uma vez no módulo original.'
                });
            }

            adicionar('resumo', 'combustivel', 'combustivel', 'Combustível (resumo financeiro)', 'Transporte', resumo.combustivel, '');

            const pedagios = Array.isArray(despesas.pedagios) ? despesas.pedagios : [];
            if (pedagios.length) {
                pedagios.forEach(function (item) {
                    if (!item) return;
                    adicionar('despesas', 'pedagio', item.id, item.nome || 'Pedágio', 'Transporte', item.valor, '');
                });
            } else {
                adicionar('resumo', 'pedagios', 'total', 'Pedágios (resumo financeiro)', 'Transporte', resumo.pedagios, '');
            }

            const listaDespesas = Array.isArray(despesas.despesas) ? despesas.despesas : [];
            if (listaDespesas.length) {
                listaDespesas.forEach(function (item) {
                    if (!item) return;
                    adicionar(
                        'despesas',
                        'despesa',
                        item.id,
                        item.descricao || 'Despesa existente',
                        converterCategoriaExistente(item.categoria),
                        item.valor,
                        item.data
                    );
                });
            } else {
                adicionar('resumo', 'despesas', 'total', 'Outras despesas (resumo financeiro)', 'Outras despesas', resumo.outrasDespesas, '');
            }

            return itens;
        }

        function atualizarImportados() {
            lancamentos = lancamentos.filter(function (item) { return item.origem !== 'existente'; });
            if (sincronizarImportacoes) lancamentos = lancamentos.concat(construirImportados());
        }

        function salvarDashboard() {
            const dados = {
                viagem: viagem,
                lancamentos: lancamentos.filter(function (item) { return item.origem === 'painel'; }),
                categorias: categorias,
                importacoesOcultas: ocultas,
                sincronizarImportacoes: sincronizarImportacoes,
                atualizadoEm: new Date().toISOString()
            };
            return gravar(CHAVE_VIAGEM, dados);
        }

        function salvarAtividades() {
            return gravar(CHAVE_ATIVIDADES, { atividades: atividades, atualizadoEm: new Date().toISOString() });
        }

        function salvarCidades() {
            return gravar(CHAVE_CIDADES, { cidades: cidades, atualizadoEm: new Date().toISOString() });
        }

        function carregar() {
            const dados = lerObjeto(CHAVE_VIAGEM, {});
            viagem = normalizarViagem(dados.viagem || dados);
            categorias = normalizarCategorias(dados.categorias);
            ocultas = Array.isArray(dados.importacoesOcultas)
                ? dados.importacoesOcultas.filter(function (item) { return typeof item === 'string'; })
                : [];
            sincronizarImportacoes = Boolean(dados.sincronizarImportacoes);
            lancamentos = (Array.isArray(dados.lancamentos) ? dados.lancamentos : [])
                .map(normalizarLancamento)
                .filter(Boolean);
            lancamentos.forEach(function (item) {
                if (categorias.indexOf(item.categoria) < 0) item.categoria = categoriaExistente(item.categoria);
            });
            atualizarImportados();

            const dadosAtividades = lerObjeto(CHAVE_ATIVIDADES, {});
            atividades = (Array.isArray(dadosAtividades.atividades) ? dadosAtividades.atividades : [])
                .map(normalizarAtividade)
                .filter(Boolean);

            const dadosCidades = lerObjeto(CHAVE_CIDADES, {});
            cidades = (Array.isArray(dadosCidades.cidades) ? dadosCidades.cidades : [])
                .map(normalizarCidade)
                .filter(Boolean);
        }

        function custoBaseResumo() {
            const resumo = estado().resumo || {};
            const valor = Number(resumo.total);
            return Number.isFinite(valor) && valor > 0 ? valor : 0;
        }

        function lancamentosDoPainel() {
            return lancamentos.filter(function (item) { return item.origem === 'painel'; });
        }

        function totalLancamentosPainel() {
            return lancamentosDoPainel().reduce(function (total, item) { return total + item.valor; }, 0);
        }

        function orcamento() {
            return viagem.orcamento;
        }

        function custoRealizado() {
            return custoBaseResumo() + totalLancamentosPainel();
        }

        function saldoRestante() {
            return orcamento() - custoRealizado();
        }

        function percentualUtilizado() {
            if (orcamento() <= 0) return null;
            return (custoRealizado() / orcamento()) * 100;
        }

        function duracaoAtividade(item) {
            if (!item) return 0;
            if (item.duracaoHoras > 0) return item.duracaoHoras;
            if (horaValida(item.horaInicial) && horaValida(item.horaFinal)) {
                const parteInicial = item.horaInicial.split(':').map(Number);
                const parteFinal = item.horaFinal.split(':').map(Number);
                let minutos = (parteFinal[0] * 60 + parteFinal[1]) - (parteInicial[0] * 60 + parteInicial[1]);
                if (minutos < 0) minutos += 24 * 60;
                return minutos / 60;
            }
            return 0;
        }

        function totaisPagamentos() {
            let pago = 0;
            let pendente = 0;
            lancamentos.forEach(function (item) {
                if (item.situacao === 'pendente') pendente += item.valor;
                else pago += item.valor;
            });
            const total = pago + pendente;
            return {
                pago: pago,
                pendente: pendente,
                total: total,
                percentualPago: total > 0 ? (pago / total) * 100 : 0,
                percentualPendente: total > 0 ? (pendente / total) * 100 : 0
            };
        }

        function cidadesComDias() {
            const mapa = new Map();

            function obterEntrada(nome) {
                const chave = normalizarChave(nome);
                if (!chave) return null;
                if (!mapa.has(chave)) {
                    mapa.set(chave, {
                        nome: texto(nome).trim(),
                        diasInformados: 0,
                        datas: new Set(),
                        lat: null,
                        lon: null,
                        registrada: false,
                        id: ''
                    });
                }
                return mapa.get(chave);
            }

            cidades.forEach(function (cidade) {
                const entrada = obterEntrada(cidade.nome);
                if (!entrada) return;
                entrada.diasInformados = cidade.dias;
                entrada.lat = cidade.lat;
                entrada.lon = cidade.lon;
                entrada.registrada = true;
                entrada.id = cidade.id;
            });

            atividades.forEach(function (atividade) {
                const entrada = obterEntrada(atividade.cidade);
                if (!entrada || !dataValida(atividade.data)) return;
                entrada.datas.add(atividade.data);
            });

            const itens = Array.from(mapa.values()).map(function (entrada) {
                const diasAtividades = entrada.datas.size;
                const total = Math.max(entrada.diasInformados, diasAtividades);
                return {
                    nome: entrada.nome,
                    diasInformados: entrada.diasInformados,
                    diasAtividades: diasAtividades,
                    total: total,
                    lat: entrada.lat,
                    lon: entrada.lon,
                    registrada: entrada.registrada,
                    id: entrada.id
                };
            });

            return itens.filter(function (item) { return item.total > 0 || item.registrada; })
                .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
        }

        function preencherCampo(campo, valor) {
            if (!campo) return;
            if (campo instanceof HTMLInputElement || campo instanceof HTMLSelectElement || campo instanceof HTMLTextAreaElement) {
                campo.value = valor;
                return;
            }
            campo.textContent = valor;
        }

        function preencherFormularioViagem() {
            preencherCampo(campos.viagem.nome, viagem.nome);
            preencherCampo(campos.viagem.inicio, viagem.dataInicial);
            preencherCampo(campos.viagem.fim, viagem.dataFinal);
            preencherCampo(campos.viagem.orcamento, viagem.orcamento ? String(viagem.orcamento).replace('.', ',') : '');
            preencherCampo(campos.viagem.moeda, 'BRL');
        }

        function atualizarSeletorCategorias(selecionar) {
            if (!campos.lancamento.categoria) return;
            const anterior = selecionar || campos.lancamento.categoria.value;
            campos.lancamento.categoria.innerHTML = '';
            categorias.forEach(function (categoria) {
                const opcao = document.createElement('option');
                opcao.value = categoria;
                opcao.textContent = categoria;
                campos.lancamento.categoria.appendChild(opcao);
            });
            if (categorias.indexOf(anterior) >= 0) campos.lancamento.categoria.value = anterior;
        }

        function atualizarFiltroCidades() {
            if (!campos.atividade.filtroCidade) return;
            const atual = campos.atividade.filtroCidade.value;
            const nomes = [];
            cidades.forEach(function (cidade) {
                if (cidade.nome && nomes.indexOf(cidade.nome) < 0) nomes.push(cidade.nome);
            });
            atividades.forEach(function (atividade) {
                if (atividade.cidade && nomes.indexOf(atividade.cidade) < 0) nomes.push(atividade.cidade);
            });
            nomes.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });

            campos.atividade.filtroCidade.innerHTML = '';
            const todas = document.createElement('option');
            todas.value = '';
            todas.textContent = 'Todas as cidades';
            campos.atividade.filtroCidade.appendChild(todas);
            nomes.forEach(function (nome) {
                const opcao = document.createElement('option');
                opcao.value = nome;
                opcao.textContent = nome;
                campos.atividade.filtroCidade.appendChild(opcao);
            });
            if (nomes.indexOf(atual) >= 0) campos.atividade.filtroCidade.value = atual;
        }

        function renderizarIndicadores() {
            const base = custoBaseResumo();
            const novos = totalLancamentosPainel();
            const realizado = custoRealizado();
            const saldo = saldoRestante();
            const percentual = percentualUtilizado();

            preencherCampo(campos.indicadores.inicio, formatarData(viagem.dataInicial));
            preencherCampo(campos.indicadores.fim, formatarData(viagem.dataFinal));
            preencherCampo(campos.indicadores.orcamento, formatarMoeda(orcamento()));
            preencherCampo(campos.indicadores.realizado, formatarMoeda(realizado));
            if (campos.indicadores.saldo) campos.indicadores.saldo.textContent = formatarMoeda(saldo);
            if (campos.indicadores.saldo) campos.indicadores.saldo.classList.toggle('saldo-negativo', saldo < 0);
            preencherCampo(campos.indicadores.base, formatarMoeda(base));
            preencherCampo(campos.indicadores.novos, formatarMoeda(novos));
            preencherCampo(campos.indicadores.historico, String((estado().historico || []).length));

            if (percentual === null) {
                preencherCampo(campos.indicadores.percentual, '—');
                if (campos.indicadores.barra) campos.indicadores.barra.style.width = '0%';
                definirAviso(campos.indicadores.aviso, 'Informe um orçamento maior que zero para calcular o percentual utilizado.', 'info');
            } else {
                preencherCampo(campos.indicadores.percentual, formatarDecimal(percentual, 1) + '%');
                if (campos.indicadores.barra) campos.indicadores.barra.style.width = Math.min(100, Math.max(0, percentual)) + '%';
                if (saldo < 0) {
                    definirAviso(campos.indicadores.aviso, 'Orçamento excedido em ' + formatarMoeda(Math.abs(saldo)) + '.', 'erro');
                } else {
                    limparAviso(campos.indicadores.aviso);
                }
            }
        }

        function adicionarCelula(linha, valor, classe) {
            const celula = document.createElement('td');
            celula.textContent = valor;
            if (classe) celula.className = classe;
            linha.appendChild(celula);
            return celula;
        }

        function botaoAcao(acao, id, rotulo, classe) {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'botao-tabela' + (classe ? ' ' + classe : '');
            botao.dataset.acao = acao;
            botao.dataset.id = id;
            botao.textContent = rotulo;
            return botao;
        }

        function linhaVazia(colunas, mensagem) {
            const linha = document.createElement('tr');
            const celula = document.createElement('td');
            celula.colSpan = colunas;
            celula.className = 'tabela-vazia';
            celula.textContent = mensagem;
            linha.appendChild(celula);
            return linha;
        }

        function renderizarLancamentos() {
            const lista = campos.lancamento.lista;
            if (!lista) return;
            lista.innerHTML = '';

            const itens = lancamentos.slice().sort(function (a, b) {
                const dataA = a.data || '9999-99-99';
                const dataB = b.data || '9999-99-99';
                if (dataA !== dataB) return dataA.localeCompare(dataB);
                return a.descricao.localeCompare(b.descricao, 'pt-BR');
            });

            if (!itens.length) {
                lista.appendChild(linhaVazia(8, 'Nenhum lançamento cadastrado. Use o botão “Importar despesas do resumo” para visualizar os valores já existentes.'));
            } else {
                itens.forEach(function (item) {
                    const linha = document.createElement('tr');
                    adicionarCelula(linha, item.descricao);
                    adicionarCelula(linha, item.categoria);
                    adicionarCelula(linha, formatarMoeda(item.valor), 'valor-coluna');
                    adicionarCelula(linha, formatarData(item.data));
                    adicionarCelula(linha, item.situacao === 'pago' ? 'Pago' : 'Pendente');
                    adicionarCelula(linha, item.valorPlanejado ? formatarMoeda(item.valorPlanejado) : '—');
                    adicionarCelula(linha, item.origem === 'existente' ? 'Resumo (já contabilizado)' : 'Painel');

                    const acoes = document.createElement('td');
                    const grupo = document.createElement('div');
                    grupo.className = 'acoes-tabela';
                    if (item.origem === 'existente') {
                        grupo.appendChild(botaoAcao('ocultar', chaveReferencia(item.referencia), 'Remover do painel'));
                    } else {
                        grupo.appendChild(botaoAcao('editar', item.id, 'Editar'));
                        grupo.appendChild(botaoAcao('excluir', item.id, 'Excluir', 'excluir'));
                    }
                    acoes.appendChild(grupo);
                    linha.appendChild(acoes);
                    lista.appendChild(linha);
                });
            }

            preencherCampo(campos.lancamento.total, formatarMoeda(totalLancamentosPainel()));
        }

        function renderizarCategorias() {
            const lista = campos.categoria.lista;
            if (!lista) return;
            lista.innerHTML = '';
            categorias.forEach(function (categoria, indice) {
                const item = document.createElement('div');
                item.className = 'item-categoria';
                const nome = document.createElement('span');
                nome.textContent = categoria;
                const acoes = document.createElement('div');
                acoes.className = 'acoes-tabela';
                acoes.appendChild(botaoAcao('editar', String(indice), 'Editar'));
                acoes.appendChild(botaoAcao('excluir', String(indice), 'Excluir', 'excluir'));
                item.appendChild(nome);
                item.appendChild(acoes);
                lista.appendChild(item);
            });
        }

        function renderizarAtividades() {
            const lista = campos.atividade.lista;
            if (!lista) return;
            lista.innerHTML = '';

            const filtroData = campos.atividade.filtroData ? campos.atividade.filtroData.value : '';
            const filtroCidade = campos.atividade.filtroCidade ? normalizarChave(campos.atividade.filtroCidade.value) : '';
            const itens = atividades.filter(function (item) {
                if (filtroData && item.data !== filtroData) return false;
                if (filtroCidade && normalizarChave(item.cidade) !== filtroCidade) return false;
                return true;
            }).sort(function (a, b) {
                const chaveA = a.data + 'T' + (a.horaInicial || '99:99');
                const chaveB = b.data + 'T' + (b.horaInicial || '99:99');
                return chaveA.localeCompare(chaveB);
            });

            if (!itens.length) {
                lista.appendChild(linhaVazia(7, 'Nenhuma atividade encontrada para os filtros selecionados.'));
                return;
            }

            itens.forEach(function (item) {
                const horas = duracaoAtividade(item);
                const linha = document.createElement('tr');
                adicionarCelula(linha, formatarData(item.data));
                adicionarCelula(linha, item.horaInicial || '—');
                adicionarCelula(linha, item.cidade || '—');
                adicionarCelula(linha, item.descricao || item.tipo || '—');
                adicionarCelula(linha, horas > 0 ? formatarDecimal(horas, 1) + ' h' : '—');
                adicionarCelula(linha, item.observacoes || '—');
                const acoes = document.createElement('td');
                const grupo = document.createElement('div');
                grupo.className = 'acoes-tabela';
                grupo.appendChild(botaoAcao('editar', item.id, 'Editar'));
                grupo.appendChild(botaoAcao('excluir', item.id, 'Excluir', 'excluir'));
                acoes.appendChild(grupo);
                linha.appendChild(acoes);
                lista.appendChild(linha);
            });
        }

        function renderizarCidadesTabela() {
            const lista = campos.cidade.lista;
            if (!lista) return;
            lista.innerHTML = '';
            const itens = cidadesComDias();

            if (!itens.length) {
                lista.appendChild(linhaVazia(7, 'Nenhuma cidade cadastrada. Cadastre cidades ou informe cidades nas atividades.'));
                return;
            }

            itens.forEach(function (item) {
                const linha = document.createElement('tr');
                adicionarCelula(linha, item.nome);
                adicionarCelula(linha, String(item.diasInformados));
                adicionarCelula(linha, String(item.diasAtividades));
                adicionarCelula(linha, String(item.total), 'valor-coluna');
                adicionarCelula(linha, item.lat !== null && item.lon !== null
                    ? formatarDecimal(item.lat, 4) + ', ' + formatarDecimal(item.lon, 4)
                    : '—');

                const total = itens.reduce(function (soma, atual) { return soma + atual.total; }, 0);
                adicionarCelula(linha, total > 0 ? formatarDecimal((item.total / total) * 100, 1) + '%' : '—');

                const acoes = document.createElement('td');
                const grupo = document.createElement('div');
                grupo.className = 'acoes-tabela';
                if (item.registrada) {
                    grupo.appendChild(botaoAcao('editar', item.id, 'Editar'));
                    grupo.appendChild(botaoAcao('excluir', item.id, 'Excluir', 'excluir'));
                } else {
                    grupo.appendChild(botaoAcao('cadastrar', item.nome, 'Cadastrar'));
                }
                acoes.appendChild(grupo);
                linha.appendChild(acoes);
                lista.appendChild(linha);
            });
        }

        function criarSvg(largura, altura, descricao) {
            const svg = document.createElementNS(NS_SVG, 'svg');
            svg.setAttribute('viewBox', '0 0 ' + largura + ' ' + altura);
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.setAttribute('role', 'img');
            svg.setAttribute('aria-label', descricao);
            svg.classList.add('grafico-svg');
            return svg;
        }

        function noSvg(tag, atributos, texto) {
            const elemento = document.createElementNS(NS_SVG, tag);
            Object.keys(atributos || {}).forEach(function (chave) {
                elemento.setAttribute(chave, String(atributos[chave]));
            });
            if (texto !== undefined && texto !== null) elemento.textContent = String(texto);
            return elemento;
        }

        function mensagemGrafico(container, mensagem) {
            container.innerHTML = '';
            const paragrafo = document.createElement('p');
            paragrafo.className = 'grafico-vazio';
            paragrafo.textContent = mensagem;
            container.appendChild(paragrafo);
            container.setAttribute('aria-label', mensagem);
        }

        function renderizarHorasPorDia() {
            const container = campos.graficos.horas;
            if (!container) return;
            container.innerHTML = '';

            const porDia = new Map();
            atividades.forEach(function (item) {
                const horas = duracaoAtividade(item);
                if (horas > 0 && dataValida(item.data)) {
                    porDia.set(item.data, (porDia.get(item.data) || 0) + horas);
                }
            });
            const entradas = Array.from(porDia.entries()).sort(function (a, b) { return a[0].localeCompare(b[0]); });
            if (!entradas.length) {
                mensagemGrafico(container, 'Sem atividades com duração válida para exibir o gráfico de horas por dia.');
                return;
            }

            const largura = 640;
            const altura = 250;
            const esquerda = 52;
            const direita = 18;
            const topo = 18;
            const base = 54;
            const areaLargura = largura - esquerda - direita;
            const areaAltura = altura - topo - base;
            const maior = Math.max.apply(null, entradas.map(function (entrada) { return entrada[1]; }).concat([1]));
            const descricoes = entradas.map(function (entrada) {
                return formatarData(entrada[0]) + ': ' + formatarDecimal(entrada[1], 1) + ' horas';
            });

            const svg = criarSvg(largura, altura, 'Horas por dia. ' + descricoes.join('. ') + '.');
            const posicaoX = function (indice) {
                return entradas.length === 1
                    ? esquerda + areaLargura / 2
                    : esquerda + (indice * areaLargura) / (entradas.length - 1);
            };
            const posicaoY = function (valor) { return topo + areaAltura - (valor / maior) * areaAltura; };

            [0, maior / 2, maior].forEach(function (valor) {
                const y = posicaoY(valor);
                svg.appendChild(noSvg('line', { x1: esquerda, y1: y, x2: largura - direita, y2: y, class: 'linha-grade' }));
                svg.appendChild(noSvg('text', {
                    x: esquerda - 8, y: y + 4, class: 'texto-eixo', 'text-anchor': 'end'
                }, formatarDecimal(valor, 1) + 'h'));
            });

            const pontos = entradas.map(function (entrada, indice) {
                return posicaoX(indice) + ',' + posicaoY(entrada[1]);
            }).join(' ');
            svg.appendChild(noSvg('polyline', { points: pontos, class: 'linha-series' }));

            const passo = Math.max(1, Math.ceil(entradas.length / 8));
            entradas.forEach(function (entrada, indice) {
                const x = posicaoX(indice);
                const y = posicaoY(entrada[1]);
                svg.appendChild(noSvg('circle', { cx: x, cy: y, r: 4.5, class: 'ponto-serie' }));
                if (indice % passo === 0 || indice === entradas.length - 1) {
                    svg.appendChild(noSvg('text', {
                        x: x, y: altura - 18, class: 'texto-eixo', 'text-anchor': 'middle'
                    }, formatarData(entrada[0])));
                }
            });

            container.appendChild(svg);
            container.setAttribute('aria-label', 'Horas por dia. ' + descricoes.join('. ') + '.');
        }

        function renderizarOrcamentoRealizado() {
            const container = campos.graficos.orcamento;
            if (!container) return;
            container.innerHTML = '';

            const porData = new Map();
            lancamentos.forEach(function (item) {
                if (!dataValida(item.data)) return;
                if (!porData.has(item.data)) porData.set(item.data, { planejado: 0, realizado: 0 });
                const registro = porData.get(item.data);
                registro.planejado += item.valorPlanejado;
                if (item.situacao === 'pago') registro.realizado += item.valor;
            });
            const datas = Array.from(porData.keys()).sort();
            if (!datas.length) {
                mensagemGrafico(container, 'Sem lançamentos com data válida para comparar planejado e realizado.');
                return;
            }

            const largura = 640;
            const altura = 260;
            const esquerda = 52;
            const direita = 18;
            const topo = 18;
            const base = 54;
            const areaLargura = largura - esquerda - direita;
            const areaAltura = altura - topo - base;
            const maior = Math.max.apply(null, datas.map(function (data) {
                return Math.max(porData.get(data).planejado, porData.get(data).realizado);
            }).concat([1]));
            const descricoes = datas.map(function (data) {
                const registro = porData.get(data);
                return formatarData(data) + ': planejado ' + formatarMoeda(registro.planejado) +
                    ', realizado ' + formatarMoeda(registro.realizado);
            });

            const svg = criarSvg(largura, altura, 'Orçamento planejado e valor realizado por data. ' + descricoes.join('. ') + '.');
            [0, maior / 2, maior].forEach(function (valor) {
                const y = topo + areaAltura - (valor / maior) * areaAltura;
                svg.appendChild(noSvg('line', { x1: esquerda, y1: y, x2: largura - direita, y2: y, class: 'linha-grade' }));
                svg.appendChild(noSvg('text', {
                    x: esquerda - 8, y: y + 4, class: 'texto-eixo', 'text-anchor': 'end'
                }, formatarDecimal(valor, 0)));
            });

            const grupoLargura = areaLargura / datas.length;
            const larguraBarra = Math.min(22, Math.max(6, grupoLargura * 0.3));
            const passo = Math.max(1, Math.ceil(datas.length / 8));

            datas.forEach(function (data, indice) {
                const registro = porData.get(data);
                const centro = esquerda + grupoLargura * (indice + 0.5);
                const planejadoAltura = (registro.planejado / maior) * areaAltura;
                const realizadoAltura = (registro.realizado / maior) * areaAltura;
                svg.appendChild(noSvg('rect', {
                    x: centro - larguraBarra - 2,
                    y: topo + areaAltura - planejadoAltura,
                    width: larguraBarra,
                    height: planejadoAltura,
                    rx: 3,
                    class: 'barra-planejado'
                }));
                svg.appendChild(noSvg('rect', {
                    x: centro + 2,
                    y: topo + areaAltura - realizadoAltura,
                    width: larguraBarra,
                    height: realizadoAltura,
                    rx: 3,
                    class: 'barra-realizado'
                }));
                if (indice % passo === 0 || indice === datas.length - 1) {
                    svg.appendChild(noSvg('text', {
                        x: centro, y: altura - 18, class: 'texto-eixo', 'text-anchor': 'middle'
                    }, formatarData(data)));
                }
            });

            container.appendChild(svg);
            container.setAttribute('aria-label', 'Planejado e realizado por data. ' + descricoes.join('. ') + '.');
            const legenda = document.createElement('div');
            legenda.className = 'legenda-grafico';
            [
                { rotulo: 'Valor planejado', classe: 'legenda-planejado' },
                { rotulo: 'Valor realizado (pago)', classe: 'legenda-realizado' }
            ].forEach(function (item) {
                const span = document.createElement('span');
                const quadrado = document.createElement('i');
                quadrado.className = 'quadrado-legenda ' + item.classe;
                span.appendChild(quadrado);
                span.appendChild(document.createTextNode(item.rotulo));
                legenda.appendChild(span);
            });
            container.appendChild(legenda);
        }

        function renderizarCategoriasGrafico() {
            const container = campos.graficos.categorias;
            const legenda = campos.graficos.legendaCategorias;
            if (!container || !legenda) return;
            container.innerHTML = '';
            legenda.innerHTML = '';

            const porCategoria = new Map();
            lancamentos.forEach(function (item) {
                porCategoria.set(item.categoria, (porCategoria.get(item.categoria) || 0) + item.valor);
            });
            const itens = Array.from(porCategoria.entries())
                .map(function (entrada) { return { categoria: entrada[0], valor: entrada[1] }; })
                .filter(function (item) { return item.valor > 0; })
                .sort(function (a, b) { return b.valor - a.valor; });
            const total = itens.reduce(function (soma, item) { return soma + item.valor; }, 0);

            if (!total) {
                mensagemGrafico(container, 'Sem lançamentos com valor válido para exibir a distribuição por categoria.');
                return;
            }

            const descricoes = itens.map(function (item) {
                return item.categoria + ': ' + formatarMoeda(item.valor) +
                    ' (' + formatarDecimal((item.valor / total) * 100, 1) + '%)';
            });
            const svg = criarSvg(220, 220, 'Custos por categoria. ' + descricoes.join('. ') + '.');
            const raio = 70;
            const circunferencia = 2 * Math.PI * raio;
            let deslocamento = 0;

            svg.appendChild(noSvg('circle', {
                cx: 110, cy: 110, r: raio, fill: 'none', stroke: '#edf2f6', 'stroke-width': 26
            }));

            itens.forEach(function (item, indice) {
                const comprimento = (item.valor / total) * circunferencia;
                const cor = CORES[indice % CORES.length];
                svg.appendChild(noSvg('circle', {
                    cx: 110,
                    cy: 110,
                    r: raio,
                    fill: 'none',
                    stroke: cor,
                    'stroke-width': 26,
                    'stroke-dasharray': comprimento + ' ' + (circunferencia - comprimento),
                    'stroke-dashoffset': -deslocamento,
                    transform: 'rotate(-90 110 110)'
                }));
                deslocamento += comprimento;
            });

            svg.appendChild(noSvg('text', {
                x: 110, y: 104, class: 'texto-centro', 'text-anchor': 'middle'
            }, 'Total'));
            svg.appendChild(noSvg('text', {
                x: 110, y: 124, class: 'texto-centro-valor', 'text-anchor': 'middle'
            }, formatarMoeda(total)));
            container.appendChild(svg);
            container.setAttribute('aria-label', 'Custos por categoria. ' + descricoes.join('. ') + '.');

            const tabela = document.createElement('table');
            tabela.className = 'tabela-despesas tabela-legenda';
            const cabecalho = document.createElement('thead');
            const linhaCabecalho = document.createElement('tr');
            ['Categoria', 'Valor', 'Percentual'].forEach(function (rotulo) {
                const th = document.createElement('th');
                th.scope = 'col';
                th.textContent = rotulo;
                linhaCabecalho.appendChild(th);
            });
            cabecalho.appendChild(linhaCabecalho);
            tabela.appendChild(cabecalho);
            const corpo = document.createElement('tbody');
            itens.forEach(function (item, indice) {
                const linha = document.createElement('tr');
                const categoriaCelula = document.createElement('td');
                const quadrado = document.createElement('i');
                quadrado.className = 'quadrado-legenda';
                quadrado.style.backgroundColor = CORES[indice % CORES.length];
                categoriaCelula.appendChild(quadrado);
                categoriaCelula.appendChild(document.createTextNode(item.categoria));
                linha.appendChild(categoriaCelula);
                adicionarCelula(linha, formatarMoeda(item.valor), 'valor-coluna');
                adicionarCelula(linha, formatarDecimal((item.valor / total) * 100, 1) + '%');
                corpo.appendChild(linha);
            });
            tabela.appendChild(corpo);
            legenda.appendChild(tabela);
        }

        function criarBarraSimples(rotulo, valor, total, classe) {
            const linha = document.createElement('div');
            linha.className = 'barra-linha';
            const etiqueta = document.createElement('span');
            etiqueta.className = 'barra-etiqueta';
            etiqueta.textContent = rotulo;
            const fundo = document.createElement('div');
            fundo.className = 'barra-fundo';
            const barra = document.createElement('div');
            barra.className = 'barra-preenchimento ' + classe;
            barra.style.width = (total > 0 ? Math.max(0, Math.min(100, (valor / total) * 100)) : 0) + '%';
            fundo.appendChild(barra);
            const texto = document.createElement('span');
            texto.className = 'barra-valor';
            texto.textContent = formatarMoeda(valor);
            linha.appendChild(etiqueta);
            linha.appendChild(fundo);
            linha.appendChild(texto);
            return linha;
        }

        function renderizarPagamentos() {
            const container = campos.graficos.pagos;
            if (!container) return;
            container.innerHTML = '';
            const totais = totaisPagamentos();

            preencherCampo(campos.graficos.pago, formatarMoeda(totais.pago));
            preencherCampo(campos.graficos.pendente, formatarMoeda(totais.pendente));
            preencherCampo(campos.graficos.percentualPago, formatarDecimal(totais.percentualPago, 1) + '%');
            preencherCampo(campos.graficos.percentualPendente, formatarDecimal(totais.percentualPendente, 1) + '%');

            if (!totais.total) {
                mensagemGrafico(container, 'Sem lançamentos para comparar pagos e pendentes.');
                return;
            }

            container.appendChild(criarBarraSimples('Pago', totais.pago, totais.total, 'cor-pago'));
            container.appendChild(criarBarraSimples('Pendente', totais.pendente, totais.total, 'cor-pendente'));
            container.setAttribute('aria-label', 'Pagamentos: pago ' + formatarMoeda(totais.pago) +
                ', pendente ' + formatarMoeda(totais.pendente) + '.');
        }

        function renderizarDiasPorCidade() {
            const container = campos.graficos.diasCidade;
            if (!container) return;
            container.innerHTML = '';
            const itens = cidadesComDias().filter(function (item) { return item.total > 0; });
            if (!itens.length) {
                mensagemGrafico(container, 'Sem cidades com dias informados ou atividades válidas.');
                return;
            }

            const total = itens.reduce(function (soma, item) { return soma + item.total; }, 0);
            itens.forEach(function (item) {
                const linha = criarBarraSimples(
                    item.nome + ' (' + item.total + ' dia' + (item.total === 1 ? '' : 's') + ')',
                    item.total / total,
                    1,
                    'cor-cidade'
                );
                const texto = linha.querySelector('.barra-valor');
                if (texto) texto.textContent = formatarDecimal((item.total / total) * 100, 1) + '%';
                container.appendChild(linha);
            });
            container.setAttribute('aria-label', 'Dias por cidade. ' + itens.map(function (item) {
                return item.nome + ': ' + item.total + ' dia' + (item.total === 1 ? '' : 's') + ', ' +
                    formatarDecimal((item.total / total) * 100, 1) + '%';
            }).join('. '));
        }

        function renderizarMapaCidades() {
            if (grupoCidades) {
                grupoCidades.clearLayers();
            }
            const apiMapa = api().mapa;
            const mapa = apiMapa && typeof apiMapa.obterInstancia === 'function' ? apiMapa.obterInstancia() : null;
            if (!mapa || typeof L === 'undefined') {
                definirAviso(campos.cidade.avisoMapa, 'O mapa existente ainda não está disponível. Verifique a conexão com o OpenStreetMap.', 'info');
                return;
            }

            if (!grupoCidades) grupoCidades = L.layerGroup().addTo(mapa);
            const comCoordenada = cidadesComDias().filter(function (item) {
                return Number.isFinite(item.lat) && Number.isFinite(item.lon);
            });

            comCoordenada.forEach(function (item) {
                const popup = document.createElement('div');
                const titulo = document.createElement('strong');
                titulo.textContent = item.nome;
                const detalhe = document.createElement('div');
                detalhe.textContent = item.total + ' dia' + (item.total === 1 ? '' : 's') + ' na cidade';
                popup.appendChild(titulo);
                popup.appendChild(detalhe);

                L.circleMarker([item.lat, item.lon], {
                    radius: 7,
                    color: '#ffffff',
                    weight: 2,
                    fillColor: '#e8a13a',
                    fillOpacity: 0.95
                }).bindPopup(popup).addTo(grupoCidades);
            });

            if (comCoordenada.length) {
                limparAviso(campos.cidade.avisoMapa);
            } else {
                definirAviso(campos.cidade.avisoMapa, 'Nenhuma cidade com coordenada válida. Use “Buscar no mapa existente” ou defina origem/destino no mapa.', 'info');
            }
        }

        function renderizarTudo() {
            renderizarIndicadores();
            renderizarLancamentos();
            renderizarCategorias();
            renderizarAtividades();
            renderizarCidadesTabela();
            renderizarHorasPorDia();
            renderizarOrcamentoRealizado();
            renderizarCategoriasGrafico();
            renderizarPagamentos();
            renderizarDiasPorCidade();
            renderizarMapaCidades();
            atualizarSeletorCategorias();
            atualizarFiltroCidades();
        }

        function resetarFormulario(formulario, botao, rotulo) {
            if (formulario) formulario.reset();
            if (botao) botao.textContent = rotulo;
        }

        function aoAlterarViagem() {
            viagem.nome = campos.viagem.nome ? campos.viagem.nome.value.trim() : '';
            viagem.dataInicial = dataValida(campos.viagem.inicio.value) ? campos.viagem.inicio.value : '';
            viagem.dataFinal = dataValida(campos.viagem.fim.value) ? campos.viagem.fim.value : '';
            viagem.orcamento = numeroPositivo(campos.viagem.orcamento.value);
            viagem.moeda = 'BRL';
            salvarDashboard();
            renderizarIndicadores();
        }

        function aoSalvarLancamento(evento) {
            evento.preventDefault();
            limparAviso(campos.lancamento.aviso);
            const valor = numeroPositivo(campos.lancamento.valor.value);
            const descricao = campos.lancamento.descricao.value.trim();

            if (!descricao) {
                definirAviso(campos.lancamento.aviso, 'Informe a descrição do lançamento.', 'erro');
                return;
            }
            if (!valor) {
                definirAviso(campos.lancamento.aviso, 'Informe um valor maior que zero.', 'erro');
                return;
            }

            const dados = {
                id: editandoLancamento || gerarId(),
                descricao: descricao,
                categoria: categoryOrFallback(campos.lancamento.categoria.value),
                valor: valor,
                valorPlanejado: numeroPositivo(campos.lancamento.planejado.value),
                data: dataValida(campos.lancamento.data.value) ? campos.lancamento.data.value : '',
                situacao: campos.lancamento.situacao.value === 'pendente' ? 'pendente' : 'pago',
                origem: 'painel',
                referencia: null,
                observacao: ''
            };

            if (editandoLancamento) {
                lancamentos = lancamentos.map(function (item) { return item.id === editandoLancamento ? dados : item; });
            } else {
                lancamentos.push(dados);
            }
            editandoLancamento = null;
            salvarDashboard();
            resetarFormulario(campos.lancamento.formulario, campos.lancamento.salvar, 'Salvar lançamento');
            renderizarTudo();
            definirAviso(campos.lancamento.aviso, 'Lançamento salvo.', 'sucesso');
        }

        function categoryOrFallback(valor) {
            return categorias.indexOf(valor) >= 0 ? valor : 'Outras despesas';
        }

        function aoClicarLancamentos(evento) {
            const botao = evento.target.closest('button[data-acao]');
            if (!botao) return;
            const acao = botao.dataset.acao;

            if (acao === 'editar') {
                const item = lancamentos.find(function (lancamento) { return lancamento.id === botao.dataset.id; });
                if (!item) return;
                editandoLancamento = item.id;
                preencherCampo(campos.lancamento.descricao, item.descricao);
                atualizarSeletorCategorias(item.categoria);
                preencherCampo(campos.lancamento.valor, String(item.valor).replace('.', ','));
                preencherCampo(campos.lancamento.data, item.data);
                preencherCampo(campos.lancamento.situacao, item.situacao);
                preencherCampo(campos.lancamento.planejado, item.valorPlanejado ? String(item.valorPlanejado).replace('.', ',') : '');
                if (campos.lancamento.salvar) campos.lancamento.salvar.textContent = 'Salvar alterações';
                return;
            }

            if (acao === 'excluir') {
                if (!window.confirm('Excluir este lançamento do painel?')) return;
                lancamentos = lancamentos.filter(function (item) { return item.id !== botao.dataset.id; });
                if (editandoLancamento === botao.dataset.id) {
                    editandoLancamento = null;
                    resetarFormulario(campos.lancamento.formulario, campos.lancamento.salvar, 'Salvar lançamento');
                }
                salvarDashboard();
                renderizarTudo();
                return;
            }

            if (acao === 'ocultar') {
                if (ocultas.indexOf(botao.dataset.id) < 0) ocultas.push(botao.dataset.id);
                sincronizarImportacoes = true;
                atualizarImportados();
                salvarDashboard();
                renderizarTudo();
            }
        }

        function aoSalvarCategoria(evento) {
            evento.preventDefault();
            limparAviso(campos.categoria.aviso);
            const nome = campos.categoria.nome.value.trim();
            if (!nome) {
                definirAviso(campos.categoria.aviso, 'Informe o nome da categoria.', 'erro');
                return;
            }

            const duplicada = categorias.findIndex(function (item, indice) {
                return normalizarChave(item) === normalizarChave(nome) && indice !== editandoCategoria;
            });
            if (duplicada >= 0) {
                definirAviso(campos.categoria.aviso, 'Já existe uma categoria com esse nome.', 'erro');
                return;
            }

            if (editandoCategoria !== null && editandoCategoria >= 0 && editandoCategoria < categorias.length) {
                const anterior = categorias[editandoCategoria];
                if (normalizarChave(anterior) === 'outras despesas' && normalizarChave(nome) !== 'outras despesas') {
                    definirAviso(campos.categoria.aviso, 'A categoria “Outras despesas” é usada como fallback e não pode ser renomeada.', 'erro');
                    return;
                }
                categorias[editandoCategoria] = nome;
                if (anterior !== nome) {
                    lancamentos.forEach(function (item) {
                        if (item.categoria === anterior) item.categoria = nome;
                    });
                }
            } else {
                categorias.push(nome);
            }

            editandoCategoria = null;
            salvarDashboard();
            resetarFormulario(campos.categoria.formulario, campos.categoria.salvar, 'Adicionar categoria');
            renderizarTudo();
            definirAviso(campos.categoria.aviso, 'Categoria salva.', 'sucesso');
        }

        function aoClicarCategorias(evento) {
            const botao = evento.target.closest('button[data-acao]');
            if (!botao) return;
            const indice = Number(botao.dataset.id);
            if (!Number.isInteger(indice) || !categorias[indice]) return;

            if (botao.dataset.acao === 'editar') {
                editandoCategoria = indice;
                preencherCampo(campos.categoria.nome, categorias[indice]);
                if (campos.categoria.salvar) campos.categoria.salvar.textContent = 'Salvar alterações';
                return;
            }

            if (botao.dataset.acao === 'excluir') {
                if (categorias.length <= 1) {
                    definirAviso(campos.categoria.aviso, 'Mantenha ao menos uma categoria.', 'erro');
                    return;
                }
                if (normalizarChave(categorias[indice]) === 'outras despesas') {
                    definirAviso(campos.categoria.aviso, 'A categoria “Outras despesas” é usada como fallback e não pode ser excluída.', 'erro');
                    return;
                }
                if (!window.confirm('Excluir a categoria "' + categorias[indice] + '"? Os lançamentos serão movidos para “Outras despesas”.')) return;
                const removida = categorias.splice(indice, 1)[0];
                lancamentos.forEach(function (item) {
                    if (item.categoria === removida) item.categoria = 'Outras despesas';
                });
                if (editandoCategoria === indice) {
                    editandoCategoria = null;
                    resetarFormulario(campos.categoria.formulario, campos.categoria.salvar, 'Adicionar categoria');
                }
                salvarDashboard();
                renderizarTudo();
            }
        }

        function aoSalvarAtividade(evento) {
            evento.preventDefault();
            limparAviso(campos.atividade.aviso);
            const data = dataValida(campos.atividade.data.value) ? campos.atividade.data.value : '';
            if (!data) {
                definirAviso(campos.atividade.aviso, 'Informe uma data válida.', 'erro');
                return;
            }

            const dados = {
                id: editandoAtividade || gerarId(),
                data: data,
                horaInicial: horaValida(campos.atividade.inicio.value) ? campos.atividade.inicio.value : '',
                horaFinal: horaValida(campos.atividade.fim.value) ? campos.atividade.fim.value : '',
                duracaoHoras: numeroPositivo(campos.atividade.duracao.value),
                cidade: campos.atividade.cidade.value.trim(),
                tipo: campos.atividade.tipo.value.trim(),
                descricao: campos.atividade.descricao.value.trim(),
                observacoes: campos.atividade.observacoes.value.trim()
            };

            const duracaoCalculada = duracaoAtividade(dados);
            if (!duracaoCalculada) {
                definirAviso(campos.atividade.aviso, 'Informe uma duração válida ou um horário inicial e final.', 'erro');
                return;
            }

            if (editandoAtividade) {
                atividades = atividades.map(function (item) { return item.id === editandoAtividade ? dados : item; });
            } else {
                atividades.push(dados);
            }
            editandoAtividade = null;
            salvarAtividades();
            resetarFormulario(campos.atividade.formulario, campos.atividade.salvar, 'Salvar atividade');
            renderizarTudo();
            definirAviso(campos.atividade.aviso, 'Atividade salva na programação.', 'sucesso');
        }

        function aoClicarAtividades(evento) {
            const botao = evento.target.closest('button[data-acao]');
            if (!botao) return;

            if (botao.dataset.acao === 'editar') {
                const item = atividades.find(function (atividade) { return atividade.id === botao.dataset.id; });
                if (!item) return;
                editandoAtividade = item.id;
                preencherCampo(campos.atividade.data, item.data);
                preencherCampo(campos.atividade.inicio, item.horaInicial);
                preencherCampo(campos.atividade.fim, item.horaFinal);
                preencherCampo(campos.atividade.duracao, item.duracaoHoras ? String(item.duracaoHoras).replace('.', ',') : '');
                preencherCampo(campos.atividade.cidade, item.cidade);
                preencherCampo(campos.atividade.tipo, item.tipo);
                preencherCampo(campos.atividade.descricao, item.descricao);
                preencherCampo(campos.atividade.observacoes, item.observacoes);
                if (campos.atividade.salvar) campos.atividade.salvar.textContent = 'Salvar alterações';
                return;
            }

            if (botao.dataset.acao === 'excluir') {
                if (!window.confirm('Excluir esta atividade da programação?')) return;
                atividades = atividades.filter(function (item) { return item.id !== botao.dataset.id; });
                if (editandoAtividade === botao.dataset.id) {
                    editandoAtividade = null;
                    resetarFormulario(campos.atividade.formulario, campos.atividade.salvar, 'Salvar atividade');
                }
                salvarAtividades();
                renderizarTudo();
            }
        }

        function aoSalvarCidade(evento) {
            evento.preventDefault();
            limparAviso(campos.cidade.aviso);
            const nome = campos.cidade.nome.value.trim();
            if (!nome) {
                definirAviso(campos.cidade.aviso, 'Informe o nome da cidade.', 'erro');
                return;
            }

            const lat = numero(campos.cidade.latitude.value);
            const lon = numero(campos.cidade.longitude.value);
            const temLat = Number.isFinite(lat);
            const temLon = Number.isFinite(lon);
            if ((temLat || temLon) && !(temLat && temLon)) {
                definirAviso(campos.cidade.aviso, 'Informe latitude e longitude juntas, ou deixe ambas em branco.', 'erro');
                return;
            }

            const dados = {
                id: editandoCidade || gerarId(),
                nome: nome,
                dias: numeroPositivo(campos.cidade.dias.value),
                lat: temLat ? lat : null,
                lon: temLon ? lon : null,
                origem: 'manual'
            };

            if (editandoCidade) {
                cidades = cidades.map(function (item) { return item.id === editandoCidade ? dados : item; });
            } else {
                const existente = cidades.find(function (item) { return normalizarChave(item.nome) === normalizarChave(nome); });
                if (existente) {
                    Object.assign(existente, dados, { id: existente.id });
                } else {
                    cidades.push(dados);
                }
            }
            editandoCidade = null;
            salvarCidades();
            resetarFormulario(campos.cidade.formulario, campos.cidade.salvar, 'Salvar cidade');
            renderizarTudo();
            definirAviso(campos.cidade.aviso, 'Cidade salva.', 'sucesso');
        }

        function aoClicarCidades(evento) {
            const botao = evento.target.closest('button[data-acao]');
            if (!botao) return;

            if (botao.dataset.acao === 'editar') {
                const item = cidades.find(function (cidade) { return cidade.id === botao.dataset.id; });
                if (!item) return;
                editandoCidade = item.id;
                preencherCampo(campos.cidade.nome, item.nome);
                preencherCampo(campos.cidade.dias, item.dias ? String(item.dias).replace('.', ',') : '');
                preencherCampo(campos.cidade.latitude, item.lat === null ? '' : String(item.lat));
                preencherCampo(campos.cidade.longitude, item.lon === null ? '' : String(item.lon));
                if (campos.cidade.salvar) campos.cidade.salvar.textContent = 'Salvar alterações';
                return;
            }

            if (botao.dataset.acao === 'excluir') {
                if (!window.confirm('Remover esta cidade do painel? As atividades permanecem na programação.')) return;
                cidades = cidades.filter(function (item) { return item.id !== botao.dataset.id; });
                if (editandoCidade === botao.dataset.id) {
                    editandoCidade = null;
                    resetarFormulario(campos.cidade.formulario, campos.cidade.salvar, 'Salvar cidade');
                }
                salvarCidades();
                renderizarTudo();
                return;
            }

            if (botao.dataset.acao === 'cadastrar') {
                const nome = botao.dataset.id;
                if (!nome) return;
                if (!cidades.some(function (item) { return normalizarChave(item.nome) === normalizarChave(nome); })) {
                    cidades.push({ id: gerarId(), nome: nome, dias: 0, lat: null, lon: null, origem: 'manual' });
                    salvarCidades();
                    renderizarTudo();
                    definirAviso(campos.cidade.aviso, 'Cidade cadastrada. Informe os dias de permanência, se desejar.', 'sucesso');
                }
            }
        }

        function usarCoordenadaExistente() {
            const nome = campos.cidade.nome.value.trim();
            const apiMapa = api().mapa;
            if (!nome) {
                definirAviso(campos.cidade.aviso, 'Informe o nome da cidade antes de buscar a coordenada.', 'erro');
                return;
            }
            if (!apiMapa || typeof apiMapa.obterCoordenada !== 'function') {
                definirAviso(campos.cidade.aviso, 'O mapa existente não está disponível.', 'erro');
                return;
            }
            const ponto = apiMapa.obterCoordenada(nome);
            if (!ponto) {
                definirAviso(campos.cidade.aviso, 'Nenhuma coordenada em cache para esta cidade. Defina origem/destino no mapa ou informe latitude e longitude.', 'info');
                return;
            }
            preencherCampo(campos.cidade.latitude, String(ponto.lat));
            preencherCampo(campos.cidade.longitude, String(ponto.lon));
            definirAviso(campos.cidade.aviso, 'Coordenada obtida do mapa existente, sem nova consulta externa.', 'sucesso');
        }

        function centralizarCidades() {
            const apiMapa = api().mapa;
            const mapa = apiMapa && typeof apiMapa.obterInstancia === 'function' ? apiMapa.obterInstancia() : null;
            const pontos = cidadesComDias().filter(function (item) {
                return Number.isFinite(item.lat) && Number.isFinite(item.lon);
            });
            if (!mapa || !pontos.length) {
                definirAviso(campos.cidade.avisoMapa, 'Não há cidades com coordenada válida para centralizar.', 'info');
                return;
            }
            mapa.fitBounds(L.latLngBounds(pontos.map(function (item) { return [item.lat, item.lon]; })).pad(0.25), { maxZoom: 12 });
        }

        function importarDespesas() {
            sincronizarImportacoes = true;
            ocultas = [];
            atualizarImportados();
            salvarDashboard();
            renderizarTudo();
            definirAviso(campos.lancamento.aviso, 'Despesas existentes importadas para visualização. Elas não são somadas novamente ao custo realizado.', 'sucesso');
        }

        function adicionarCidadesDaRota(detalhes) {
            if (!detalhes || !detalhes.origem || !detalhes.destino) return;
            let alterou = false;
            [
                { nome: detalhes.origem.curto || detalhes.origem.nome, lat: detalhes.origem.lat, lon: detalhes.origem.lon },
                { nome: detalhes.destino.curto || detalhes.destino.nome, lat: detalhes.destino.lat, lon: detalhes.destino.lon }
            ].forEach(function (ponto) {
                if (!ponto.nome || !Number.isFinite(ponto.lat) || !Number.isFinite(ponto.lon)) return;
                const existente = cidades.find(function (cidade) { return normalizarChave(cidade.nome) === normalizarChave(ponto.nome); });
                if (existente) {
                    if (existente.lat === null || existente.lon === null) {
                        existente.lat = ponto.lat;
                        existente.lon = ponto.lon;
                        alterou = true;
                    }
                    return;
                }
                cidades.push({
                    id: gerarId(),
                    nome: ponto.nome,
                    dias: 0,
                    lat: ponto.lat,
                    lon: ponto.lon,
                    origem: 'rota'
                });
                alterou = true;
            });
            if (alterou) {
                salvarCidades();
                definirAviso(campos.cidade.avisoMapa, 'Origem e destino do mapa foram incluídos nas cidades do painel.', 'sucesso');
            }
        }

        function textoPdf(valor) {
            const util = api();
            if (typeof util.textoPdf === 'function') return util.textoPdf(valor);
            return String(valor === null || valor === undefined ? '' : valor)
                .replace(/\u00a0/g, ' ')
                .replace(/\u2013/g, '-')
                .replace(/\u2014/g, '-');
        }

        function carregarJsPDF() {
            const util = api();
            if (typeof util.carregarJsPDF === 'function') return util.carregarJsPDF();
            if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(true);
            return Promise.reject(new Error('A biblioteca de PDF do histórico não está disponível.'));
        }

        function nomeArquivoPdf() {
            const base = textoPdf(viagem.nome || 'painel-da-viagem')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 50)
                .toLowerCase();
            return (base || 'painel-da-viagem') + '.pdf';
        }

        function gerarPdfPainel() {
            const jsPDF = window.jspdf.jsPDF;
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const margem = 48;
            const largura = doc.internal.pageSize.getWidth();
            const areaUtil = largura - margem * 2;
            let y = 60;

            function verificarPagina(altura) {
                if (y + altura > doc.internal.pageSize.getHeight() - 50) {
                    doc.addPage();
                    y = 60;
                }
            }

            function secao(titulo) {
                verificarPagina(40);
                y += 10;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(16, 104, 104);
                doc.text(textoPdf(titulo), margem, y);
                y += 8;
                doc.setDrawColor(203, 215, 227);
                doc.line(margem, y, largura - margem, y);
                y += 18;
            }

            function linha(rotulo, valor) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(44, 62, 80);
                doc.text(textoPdf(rotulo) + ':', margem, y);
                doc.setFont('helvetica', 'normal');
                const partes = doc.splitTextToSize(textoPdf(valor), areaUtil - 155);
                verificarPagina(partes.length * 14 + 6);
                doc.text(partes, margem + 155, y);
                y += Math.max(16, partes.length * 14) + 4;
            }

            doc.setProperties({
                title: textoPdf(viagem.nome || 'Painel da Viagem'),
                subject: 'Painel avançado de planejamento de viagens',
                author: 'Meu Planejador de Viagens'
            });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(19, 63, 77);
            const titulo = textoPdf(viagem.nome || 'Painel da Viagem');
            const tituloLinhas = doc.splitTextToSize(titulo, areaUtil);
            doc.text(tituloLinhas, margem, y);
            y += tituloLinhas.length * 23 + 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(110, 128, 143);
            doc.text('Relatório gerado localmente - Meu Planejador de Viagens', margem, y);
            y += 20;

            secao('Resumo da viagem');
            linha('Nome da viagem', viagem.nome || '—');
            linha('Data inicial', formatarData(viagem.dataInicial));
            linha('Data final', formatarData(viagem.dataFinal));
            linha('Moeda', viagem.moeda || 'BRL');
            linha('Custo base do resumo', formatarMoeda(custoBaseResumo()));
            linha('Lançamentos do painel', formatarMoeda(totalLancamentosPainel()));
            linha('Custo total realizado', formatarMoeda(custoRealizado()));
            linha('Orçamento planejado', formatarMoeda(orcamento()));
            linha('Saldo restante', formatarMoeda(saldoRestante()));
            linha('Percentual utilizado', percentualUtilizado() === null
                ? '— (orçamento não informado)'
                : formatarDecimal(percentualUtilizado(), 1) + '%');
            linha('Viagens salvas no histórico', String((estado().historico || []).length));

            linha('Observação de integração', 'Despesas importadas do resumo são exibidas, mas não somadas novamente.');

            secao('Custos por categoria');
            const porCategoria = new Map();
            lancamentos.forEach(function (item) {
                porCategoria.set(item.categoria, (porCategoria.get(item.categoria) || 0) + item.valor);
            });
            const categoriasOrdenadas = Array.from(porCategoria.entries())
                .sort(function (a, b) { return b[1] - a[1]; });
            const totalCategorias = categoriasOrdenadas.reduce(function (soma, item) { return soma + item[1]; }, 0);
            if (!categoriasOrdenadas.length) linha('Categorias', 'Nenhum lançamento cadastrado.');
            categoriasOrdenadas.forEach(function (item) {
                linha(item[0], formatarMoeda(item[1]) + ' (' +
                    formatarDecimal(totalCategorias ? (item[1] / totalCategorias) * 100 : 0, 1) + '%)');
            });

            secao('Pagamentos');
            const pagamentos = totaisPagamentos();
            linha('Total pago', formatarMoeda(pagamentos.pago));
            linha('Total pendente', formatarMoeda(pagamentos.pendente));
            linha('Percentual pago', formatarDecimal(pagamentos.percentualPago, 1) + '%');
            linha('Percentual pendente', formatarDecimal(pagamentos.percentualPendente, 1) + '%');

            secao('Cidades e dias');
            const cidadesParaPdf = cidadesComDias().filter(function (item) { return item.total > 0; });
            if (!cidadesParaPdf.length) linha('Cidades', 'Nenhuma cidade com dias válidos.');
            const totalDias = cidadesParaPdf.reduce(function (soma, item) { return soma + item.total; }, 0);
            cidadesParaPdf.forEach(function (item) {
                linha(item.nome, item.total + ' dia(s) (' +
                    formatarDecimal(totalDias ? (item.total / totalDias) * 100 : 0, 1) + '%)');
            });

            secao('Programação da viagem');
            const atividadesOrdenadas = atividades.slice().sort(function (a, b) {
                return (a.data + 'T' + (a.horaInicial || '99:99')).localeCompare(b.data + 'T' + (b.horaInicial || '99:99'));
            });
            if (!atividadesOrdenadas.length) linha('Atividades', 'Nenhuma atividade cadastrada.');
            atividadesOrdenadas.forEach(function (item) {
                const resumoAtividade = formatarData(item.data) + ' ' + (item.horaInicial || '—') +
                    ' - ' + (item.cidade || 'Sem cidade') + ' - ' + (item.descricao || item.tipo || 'Atividade');
                linha('Atividade', resumoAtividade);
                if (item.observacoes) linha('Observações', item.observacoes);
            });

            doc.save(nomeArquivoPdf());
        }

        async function exportarPdf() {
            limparAviso(campos.exportacao.aviso);
            try {
                await carregarJsPDF();
            } catch (erro) {
                definirAviso(campos.exportacao.aviso, 'Não foi possível gerar o PDF. A biblioteca gratuita já usada pelo histórico não carregou; verifique a conexão e tente novamente.', 'erro');
                return;
            }
            try {
                gerarPdfPainel();
                definirAviso(campos.exportacao.aviso, 'PDF do painel gerado com sucesso.', 'sucesso');
            } catch (erro) {
                definirAviso(campos.exportacao.aviso, 'Erro ao gerar o PDF: ' + (erro && erro.message ? erro.message : 'erro desconhecido.'), 'erro');
            }
        }

        function obterResumoParaHistorico() {
            const pagamentos = totaisPagamentos();
            const percentual = percentualUtilizado();
            return {
                nome: viagem.nome || 'Viagem sem nome',
                dataInicial: viagem.dataInicial,
                dataFinal: viagem.dataFinal,
                orcamento: orcamento(),
                moeda: viagem.moeda,
                custoRealizado: custoRealizado(),
                saldo: saldoRestante(),
                percentualUtilizado: percentual === null ? null : percentual,
                totalPago: pagamentos.pago,
                totalPendente: pagamentos.pendente,
                quantidadeLancamentos: lancamentos.length,
                cidades: cidadesComDias().filter(function (item) { return item.total > 0; })
                    .map(function (item) { return { nome: item.nome, dias: item.total }; })
            };
        }

        if (campos.viagem.formulario) {
            [campos.viagem.nome, campos.viagem.inicio, campos.viagem.fim, campos.viagem.orcamento]
                .forEach(function (campo) {
                    if (campo) campo.addEventListener('input', aoAlterarViagem);
                });
        }

        if (campos.lancamento.formulario) campos.lancamento.formulario.addEventListener('submit', aoSalvarLancamento);
        if (campos.lancamento.cancelar) campos.lancamento.cancelar.addEventListener('click', function () {
            editandoLancamento = null;
            resetarFormulario(campos.lancamento.formulario, campos.lancamento.salvar, 'Salvar lançamento');
            limparAviso(campos.lancamento.aviso);
        });
        if (campos.lancamento.lista) campos.lancamento.lista.addEventListener('click', aoClicarLancamentos);
        if (campos.lancamento.limpar) campos.lancamento.limpar.addEventListener('click', function () {
            if (!lancamentosDoPainel().length) return;
            if (!window.confirm('Excluir todos os lançamentos criados no painel? Os registros do resumo não serão alterados.')) return;
            lancamentos = lancamentos.filter(function (item) { return item.origem !== 'painel'; });
            salvarDashboard();
            renderizarTudo();
        });

        if (campos.categoria.formulario) campos.categoria.formulario.addEventListener('submit', aoSalvarCategoria);
        if (campos.categoria.cancelar) campos.categoria.cancelar.addEventListener('click', function () {
            editandoCategoria = null;
            resetarFormulario(campos.categoria.formulario, campos.categoria.salvar, 'Adicionar categoria');
            limparAviso(campos.categoria.aviso);
        });
        if (campos.categoria.lista) campos.categoria.lista.addEventListener('click', aoClicarCategorias);

        if (campos.atividade.formulario) campos.atividade.formulario.addEventListener('submit', aoSalvarAtividade);
        if (campos.atividade.cancelar) campos.atividade.cancelar.addEventListener('click', function () {
            editandoAtividade = null;
            resetarFormulario(campos.atividade.formulario, campos.atividade.salvar, 'Salvar atividade');
            limparAviso(campos.atividade.aviso);
        });
        if (campos.atividade.lista) campos.atividade.lista.addEventListener('click', aoClicarAtividades);
        if (campos.atividade.filtroData) campos.atividade.filtroData.addEventListener('input', renderizarAtividades);
        if (campos.atividade.filtroCidade) campos.atividade.filtroCidade.addEventListener('change', renderizarAtividades);
        if (campos.atividade.limpar) campos.atividade.limpar.addEventListener('click', function () {
            if (!atividades.length) return;
            if (!window.confirm('Excluir todas as atividades da programação?')) return;
            atividades = [];
            salvarAtividades();
            renderizarTudo();
        });

        if (campos.cidade.formulario) campos.cidade.formulario.addEventListener('submit', aoSalvarCidade);
        if (campos.cidade.cancelar) campos.cidade.cancelar.addEventListener('click', function () {
            editandoCidade = null;
            resetarFormulario(campos.cidade.formulario, campos.cidade.salvar, 'Salvar cidade');
            limparAviso(campos.cidade.aviso);
        });
        if (campos.cidade.lista) campos.cidade.lista.addEventListener('click', aoClicarCidades);
        if (campos.cidade.usarCoordenada) campos.cidade.usarCoordenada.addEventListener('click', usarCoordenadaExistente);
        if (campos.cidade.centralizar) campos.cidade.centralizar.addEventListener('click', centralizarCidades);
        if (campos.cidade.limpar) campos.cidade.limpar.addEventListener('click', function () {
            if (!cidades.length) return;
            if (!window.confirm('Excluir todas as cidades cadastradas no painel? As atividades permanecem salvas.')) return;
            cidades = [];
            salvarCidades();
            renderizarTudo();
        });

        if (campos.integracao.importar) campos.integracao.importar.addEventListener('click', importarDespesas);
        if (campos.integracao.irHistorico) campos.integracao.irHistorico.addEventListener('click', function () {
            const util = api();
            if (typeof util.irPara === 'function') util.irPara('historico');
        });
        if (campos.exportacao.botao) campos.exportacao.botao.addEventListener('click', exportarPdf);

        [
            'resumo:atualizado',
            'despesas:alteradas',
            'combustivel:calculado',
            'combustivel:invalidado'
        ].forEach(function (evento) {
            document.addEventListener(evento, function () {
                if (sincronizarImportacoes) atualizarImportados();
                renderizarIndicadores();
                renderizarLancamentos();
                renderizarOrcamentoRealizado();
                renderizarCategoriasGrafico();
                renderizarPagamentos();
            });
        });

        document.addEventListener('rota:calculada', function (evento) {
            adicionarCidadesDaRota(evento.detail);
            if (sincronizarImportacoes) atualizarImportados();
            renderizarTudo();
        });
        document.addEventListener('historico:alterado', renderizarIndicadores);

        const apiPainel = api();
        apiPainel.tripDashboard = {
            obterResumoParaHistorico: obterResumoParaHistorico,
            obterDados: function () {
                return {
                    viagem: Object.assign({}, viagem),
                    lancamentos: lancamentos.map(function (item) { return Object.assign({}, item); }),
                    atividades: atividades.map(function (item) { return Object.assign({}, item); }),
                    cidades: cidades.map(function (item) { return Object.assign({}, item); })
                };
            }
        };

        carregar();
        preencherFormularioViagem();
        renderizarTudo();
    });
})();
