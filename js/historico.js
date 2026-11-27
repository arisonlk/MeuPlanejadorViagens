/*
 * Meu Planejador de Viagens - histórico e exportação de viagens.
 * Os registros são capturados do estado compartilhado e salvos apenas no LocalStorage.
 * Nenhum cálculo do resumo financeiro é repetido neste módulo.
 */
(function () {
    'use strict';

    const CHAVE_HISTORICO = 'mpv.historico';
    const URL_JSPDF = 'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js';

    document.addEventListener('DOMContentLoaded', function () {
        const formulario = document.getElementById('formulario-historico');
        if (!formulario) return;

        const campos = {
            titulo: document.getElementById('viagem-titulo'),
            origem: document.getElementById('viagem-origem'),
            destino: document.getElementById('viagem-destino'),
            distancia: document.getElementById('viagem-distancia'),
            data: document.getElementById('viagem-data'),
            combustivel: document.getElementById('viagem-combustivel'),
            pedagios: document.getElementById('viagem-pedagios'),
            outras: document.getElementById('viagem-outras'),
            total: document.getElementById('viagem-total'),
            viajantes: document.getElementById('viagem-viajantes'),
            porPessoa: document.getElementById('viagem-por-pessoa'),
            salvar: document.getElementById('botao-salvar-viagem'),
            limpar: document.getElementById('botao-limpar-historico'),
            lista: document.getElementById('lista-historico'),
            aviso: document.getElementById('aviso-historico'),
            dialog: document.getElementById('dialog-detalhes-viagem'),
            dialogTitulo: document.getElementById('detalhes-titulo'),
            dialogConteudo: document.getElementById('detalhes-conteudo'),
            fecharDetalhes: document.getElementById('botao-fechar-detalhes')
        };

        let viagens = [];
        let promessaJsPDF = null;

        function api() {
            if (!window.PlanejadorViagens) window.PlanejadorViagens = {};
            return window.PlanejadorViagens;
        }

        function estado() {
            const util = api();
            if (!util.estado) util.estado = {};
            if (!Array.isArray(util.estado.historico)) util.estado.historico = [];
            return util.estado;
        }

        function valorSeguro(valor) {
            const numero = Number(valor);
            return Number.isFinite(numero) && numero > 0 ? numero : 0;
        }

        function viajantesSeguros(valor) {
            const numero = Number(valor);
            return Number.isInteger(numero) && numero >= 1 ? numero : 0;
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

        function textoPdf(valor) {
            return String(valor === null || valor === undefined ? '' : valor)
                .replace(/\u00a0/g, ' ')
                .replace(/\u2013/g, '-')
                .replace(/\u2014/g, '-');
        }

        function definirTexto(id, valor) {
            const campo = document.getElementById(id);
            if (campo) campo.value = valor;
        }

        function mostrarMensagem(mensagem, tipo) {
            campos.aviso.textContent = mensagem;
            campos.aviso.className = 'aviso-rota ' + (tipo || 'erro');
            campos.aviso.hidden = false;
        }

        function limparMensagem() {
            campos.aviso.textContent = '';
            campos.aviso.hidden = true;
        }

        function gerarId() {
            return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        }

        function dataDeHoje() {
            const util = api();
            if (typeof util.dataAtual === 'function') return util.dataAtual();
            const agora = new Date();
            const mes = String(agora.getMonth() + 1).padStart(2, '0');
            const dia = String(agora.getDate()).padStart(2, '0');
            return agora.getFullYear() + '-' + mes + '-' + dia;
        }

        function formatarData(valor) {
            if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return '—';
            const partes = valor.split('-');
            return partes[2] + '/' + partes[1] + '/' + partes[0];
        }

        function nomeOrigem() {
            const rota = estado().rota;
            if (rota && rota.origem) return rota.origem.curto || rota.origem.nome || '';
            const campo = document.getElementById('origem');
            return campo ? campo.value.trim() : '';
        }

        function nomeDestino() {
            const rota = estado().rota;
            if (rota && rota.destino) return rota.destino.curto || rota.destino.nome || '';
            const campo = document.getElementById('destino');
            return campo ? campo.value.trim() : '';
        }

        function carregar() {
            const util = api();
            let salvo = [];
            if (typeof util.lerLocal === 'function') salvo = util.lerLocal(CHAVE_HISTORICO, []);
            else {
                try {
                    const bruto = localStorage.getItem(CHAVE_HISTORICO);
                    salvo = bruto ? JSON.parse(bruto) : [];
                } catch (erro) {
                    salvo = [];
                }
            }

            viagens = Array.isArray(salvo) ? salvo.filter(function (item) {
                return item && typeof item === 'object';
            }).map(function (item) {
                return {
                    id: typeof item.id === 'string' ? item.id : gerarId(),
                    titulo: typeof item.titulo === 'string' ? item.titulo : 'Viagem salva',
                    origem: typeof item.origem === 'string' ? item.origem : '',
                    destino: typeof item.destino === 'string' ? item.destino : '',
                    distanciaKm: valorSeguro(item.distanciaKm),
                    data: typeof item.data === 'string' ? item.data : dataDeHoje(),
                    combustivel: valorSeguro(item.combustivel),
                    pedagios: valorSeguro(item.pedagios),
                    outrasDespesas: valorSeguro(item.outrasDespesas),
                    total: valorSeguro(item.total),
                    viajantes: viajantesSeguros(item.viajantes),
                    custoPorPessoa: valorSeguro(item.custoPorPessoa),
                    litros: valorSeguro(item.litros),
                    consumoMedio: valorSeguro(item.consumoMedio),
                    precoPorLitro: valorSeguro(item.precoPorLitro),
                    pedagiosIda: valorSeguro(item.pedagiosIda),
                    pedagiosVolta: valorSeguro(item.pedagiosVolta),
                    categorias: item.categorias && typeof item.categorias === 'object' ? item.categorias : {},
                    painel: item.painel && typeof item.painel === 'object' ? item.painel : null,
                    salvoEm: typeof item.salvoEm === 'string' ? item.salvoEm : ''
                };
            }) : [];
            estado().historico = viagens.slice();
        }

        function salvar() {
            const util = api();
            let ok = false;
            if (typeof util.salvarLocal === 'function') ok = util.salvarLocal(CHAVE_HISTORICO, viagens);
            else {
                try {
                    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(viagens));
                    ok = true;
                } catch (erro) {
                    ok = false;
                }
            }
            estado().historico = viagens.slice();
            document.dispatchEvent(new CustomEvent('historico:alterado', {
                detail: { viagens: viagens.slice(), quantidade: viagens.length }
            }));
            return ok;
        }

        function preencherFormulario(autoTitulo) {
            const compartilhado = estado();
            const resumo = compartilhado.resumo || {};
            const origem = nomeOrigem();
            const destino = nomeDestino();
            const viajantes = viajantesSeguros(resumo.viajantes);
            const porPessoa = viajantes > 0 && resumo.porPessoa ? valorSeguro(resumo.porPessoa.total) : 0;

            definirTexto('viagem-origem', origem);
            definirTexto('viagem-destino', destino);
            definirTexto('viagem-distancia', valorSeguro(resumo.distanciaKm) > 0
                ? formatarDecimal(resumo.distanciaKm, 1) + ' km'
                : '—');
            definirTexto('viagem-combustivel', formatarMoeda(valorSeguro(resumo.combustivel)));
            definirTexto('viagem-pedagios', formatarMoeda(valorSeguro(resumo.pedagios)));
            definirTexto('viagem-outras', formatarMoeda(valorSeguro(resumo.outrasDespesas)));
            definirTexto('viagem-total', formatarMoeda(valorSeguro(resumo.total)));
            definirTexto('viagem-viajantes', viajantes > 0 ? String(viajantes) : '—');
            definirTexto('viagem-por-pessoa', viajantes > 0 ? formatarMoeda(porPessoa) : formatarMoeda(0));

            if (!campos.data.value) campos.data.value = dataDeHoje();
            if (autoTitulo && !campos.titulo.value.trim() && origem && destino) {
                campos.titulo.value = origem + ' → ' + destino;
            }
        }

        function adicionarCelula(linha, texto, classe) {
            const celula = document.createElement('td');
            celula.textContent = texto;
            if (classe) celula.className = classe;
            linha.appendChild(celula);
            return celula;
        }

        function criarBotao(acao, id, rotulo, classeExtra) {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'botao-tabela' + (classeExtra ? ' ' + classeExtra : '');
            botao.textContent = rotulo;
            botao.dataset.acao = acao;
            botao.dataset.id = id;
            return botao;
        }

        function renderizar() {
            campos.lista.innerHTML = '';
            if (!viagens.length) {
                const linha = document.createElement('tr');
                const celula = document.createElement('td');
                celula.colSpan = 7;
                celula.className = 'tabela-vazia';
                celula.textContent = 'Nenhuma viagem salva.';
                linha.appendChild(celula);
                campos.lista.appendChild(linha);
                return;
            }

            viagens.forEach(function (viagem) {
                const linha = document.createElement('tr');
                adicionarCelula(linha, viagem.titulo);
                adicionarCelula(linha, viagem.origem + ' → ' + viagem.destino, 'trajeto-coluna');
                adicionarCelula(linha, formatarData(viagem.data));
                adicionarCelula(linha, formatarDecimal(viagem.distanciaKm, 1) + ' km');
                adicionarCelula(linha, formatarMoeda(viagem.total), 'valor-coluna');
                adicionarCelula(linha, formatarMoeda(viagem.custoPorPessoa), 'valor-coluna');

                const acoes = document.createElement('td');
                const grupo = document.createElement('div');
                grupo.className = 'acoes-tabela';
                grupo.appendChild(criarBotao('detalhes', viagem.id, 'Detalhes'));
                grupo.appendChild(criarBotao('pdf', viagem.id, 'Exportar PDF', 'pdf'));
                grupo.appendChild(criarBotao('excluir', viagem.id, 'Excluir', 'excluir'));
                acoes.appendChild(grupo);
                linha.appendChild(acoes);
                campos.lista.appendChild(linha);
            });
        }

        function encontrarViagem(id) {
            return viagens.find(function (viagem) { return viagem.id === id; }) || null;
        }

        function adicionarDetalhe(rotulo, valor) {
            const termo = document.createElement('dt');
            termo.textContent = rotulo;
            const definicao = document.createElement('dd');
            definicao.textContent = valor;
            campos.dialogConteudo.appendChild(termo);
            campos.dialogConteudo.appendChild(definicao);
        }

        function abrirDetalhes(viagem) {
            campos.dialogTitulo.textContent = viagem.titulo;
            campos.dialogConteudo.innerHTML = '';
            adicionarDetalhe('Data', formatarData(viagem.data));
            adicionarDetalhe('Origem', viagem.origem || '—');
            adicionarDetalhe('Destino', viagem.destino || '—');
            adicionarDetalhe('Distância', formatarDecimal(viagem.distanciaKm, 1) + ' km');
            adicionarDetalhe('Combustível', formatarMoeda(viagem.combustivel));
            adicionarDetalhe('Pedágios', formatarMoeda(viagem.pedagios));
            adicionarDetalhe('Outras despesas', formatarMoeda(viagem.outrasDespesas));
            adicionarDetalhe('Custo total', formatarMoeda(viagem.total));
            adicionarDetalhe('Viajantes', viagem.viajantes > 0 ? String(viagem.viajantes) : '—');
            adicionarDetalhe('Custo por pessoa', formatarMoeda(viagem.custoPorPessoa));

            if (viagem.painel) {
                adicionarDetalhe('Orçamento planejado (painel)', formatarMoeda(valorSeguro(viagem.painel.orcamento)));
                adicionarDetalhe('Custo realizado (painel)', formatarMoeda(valorSeguro(viagem.painel.custoRealizado)));
                adicionarDetalhe('Saldo restante (painel)', formatarMoeda(Number(viagem.painel.saldo) || 0));
                adicionarDetalhe('Percentual utilizado (painel)', viagem.painel.percentualUtilizado !== null &&
                    Number.isFinite(Number(viagem.painel.percentualUtilizado))
                    ? formatarDecimal(Number(viagem.painel.percentualUtilizado), 1) + '%'
                    : '—');
            }

            if (typeof campos.dialog.showModal === 'function') campos.dialog.showModal();
            else campos.dialog.setAttribute('open', '');
        }

        function fecharDetalhes() {
            if (typeof campos.dialog.close === 'function' && campos.dialog.open) campos.dialog.close();
            else campos.dialog.removeAttribute('open');
        }

        function carregarJsPDF() {
            if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(true);
            if (promessaJsPDF) return promessaJsPDF;

            promessaJsPDF = new Promise(function (resolve, reject) {
                const script = document.createElement('script');
                script.src = URL_JSPDF;
                script.integrity = 'sha256-hbosw/+FiiD6Sf5uRXvshj6kC1Wp83JeWKlA5i9vYaQ=';
                script.crossOrigin = 'anonymous';
                script.onload = function () {
                    if (window.jspdf && window.jspdf.jsPDF) resolve(true);
                    else reject(new Error('A biblioteca não ficou disponível após o carregamento.'));
                };
                script.onerror = function () {
                    reject(new Error('Não foi possível carregar a biblioteca de PDF.'));
                };
                document.head.appendChild(script);
            }).catch(function (erro) {
                promessaJsPDF = null;
                throw erro;
            });
            return promessaJsPDF;
        }

        /* O painel avançado reutiliza o mesmo carregador, sem baixar outra versão. */
        const apiPdf = api();
        apiPdf.carregarJsPDF = carregarJsPDF;
        apiPdf.textoPdf = textoPdf;

        function nomeArquivo(viagem) {
            const base = textoPdf(viagem.titulo)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 50)
                .toLowerCase();
            return (base || 'viagem') + '.pdf';
        }

        function gerarPdf(viagem) {
            const jsPDF = window.jspdf.jsPDF;
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const margem = 48;
            const largura = doc.internal.pageSize.getWidth();
            const areaUtil = largura - margem * 2;
            let y = 60;

            doc.setProperties({
                title: textoPdf(viagem.titulo),
                subject: 'Relatório de viagem',
                author: 'Meu Planejador de Viagens'
            });

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

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(19, 63, 77);
            const tituloLinhas = doc.splitTextToSize(textoPdf(viagem.titulo), areaUtil);
            doc.text(tituloLinhas, margem, y);
            y += tituloLinhas.length * 23 + 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(110, 128, 143);
            doc.text('Meu Planejador de Viagens - relatório salvo localmente', margem, y);
            y += 20;

            secao('Dados gerais');
            linha('Data', formatarData(viagem.data));
            linha('Origem', viagem.origem || '—');
            linha('Destino', viagem.destino || '—');
            linha('Distância', formatarDecimal(viagem.distanciaKm, 1) + ' km');
            linha('Viajantes', viagem.viajantes > 0 ? String(viagem.viajantes) : '—');

            secao('Resumo financeiro');
            linha('Combustível', formatarMoeda(viagem.combustivel));
            linha('Pedágios (ida)', formatarMoeda(viagem.pedagiosIda));
            linha('Pedágios (volta)', formatarMoeda(viagem.pedagiosVolta));
            linha('Total de pedágios', formatarMoeda(viagem.pedagios));
            linha('Outras despesas', formatarMoeda(viagem.outrasDespesas));
            linha('Custo total', formatarMoeda(viagem.total));
            linha('Custo por pessoa', formatarMoeda(viagem.custoPorPessoa));

            secao('Dados de combustível');
            linha('Consumo médio', viagem.consumoMedio > 0 ? formatarDecimal(viagem.consumoMedio, 2) + ' km/l' : '—');
            linha('Litros estimados', viagem.litros > 0 ? formatarDecimal(viagem.litros, 1) + ' L' : '—');
            linha('Preço por litro', viagem.precoPorLitro > 0 ? formatarMoeda(viagem.precoPorLitro) + '/L' : '—');

            secao('Outras despesas por categoria');
            const categorias = viagem.categorias || {};
            [
                ['Alimentação', 'alimentacao'],
                ['Hospedagem', 'hospedagem'],
                ['Estacionamento', 'estacionamento'],
                ['Manutenção', 'manutencao'],
                ['Outros', 'outras']
            ].forEach(function (par) {
                const rotulo = par[0];
                const chave = par[1];
                const valor = categorias[chave] !== undefined ? categorias[chave] : categorias[rotulo];
                linha(rotulo, formatarMoeda(valorSeguro(valor)));
            });

            if (viagem.painel) {
                secao('Painel da viagem');
                linha('Nome da viagem', viagem.painel.nome || '—');
                linha('Data inicial', formatarData(viagem.painel.dataInicial));
                linha('Data final', formatarData(viagem.painel.dataFinal));
                linha('Orçamento planejado', formatarMoeda(valorSeguro(viagem.painel.orcamento)));
                linha('Custo realizado (painel)', formatarMoeda(valorSeguro(viagem.painel.custoRealizado)));
                linha('Saldo restante (painel)', formatarMoeda(Number(viagem.painel.saldo) || 0));
                linha('Percentual utilizado', viagem.painel.percentualUtilizado !== null &&
                    Number.isFinite(Number(viagem.painel.percentualUtilizado))
                    ? formatarDecimal(Number(viagem.painel.percentualUtilizado), 1) + '%'
                    : '—');
                linha('Lançamentos do painel', String(valorSeguro(viagem.painel.quantidadeLancamentos)));
            }

            secao('Observações');
            const observacao = 'Valores informados e calculados localmente no navegador. Pedágios, despesas e distância são registrados no momento do salvamento da viagem.';
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(90, 108, 122);
            doc.text(doc.splitTextToSize(observacao, areaUtil), margem, y);

            doc.save(nomeArquivo(viagem));
        }

        async function exportarPdf(id) {
            const viagem = encontrarViagem(id);
            if (!viagem) return;
            try {
                await carregarJsPDF();
            } catch (erro) {
                mostrarMensagem('Não foi possível gerar o PDF. A biblioteca gratuita não carregou; verifique a conexão e tente novamente. O histórico continua disponível.', 'erro');
                return;
            }
            try {
                gerarPdf(viagem);
                mostrarMensagem('PDF gerado com sucesso.', 'sucesso');
            } catch (erro) {
                mostrarMensagem('Erro ao gerar o PDF: ' + (erro && erro.message ? erro.message : 'erro desconhecido.'), 'erro');
            }
        }

        function aoSalvar(evento) {
            evento.preventDefault();
            limparMensagem();

            const titulo = campos.titulo.value.trim();
            const origem = campos.origem.value.trim();
            const destino = campos.destino.value.trim();
            const resumo = estado().resumo || {};
            const distanciaKm = valorSeguro(resumo.distanciaKm);
            const viajantes = viajantesSeguros(resumo.viajantes);
            const temCustos = valorSeguro(resumo.combustivel) > 0 ||
                valorSeguro(resumo.pedagios) > 0 ||
                valorSeguro(resumo.outrasDespesas) > 0;

            if (!titulo) {
                mostrarMensagem('Informe um nome para a viagem antes de salvar.', 'erro');
                return;
            }
            if (!origem || !destino) {
                mostrarMensagem('Informe origem e destino no mapa ou calcule uma rota antes de salvar.', 'erro');
                return;
            }
            if (distanciaKm <= 0) {
                mostrarMensagem('Ainda não há uma distância válida. Calcule uma rota ou informe a distância na calculadora.', 'erro');
                return;
            }
            if (viajantes <= 0) {
                mostrarMensagem('Informe um número válido de viajantes no Resumo Financeiro.', 'erro');
                return;
            }
            if (!temCustos) {
                mostrarMensagem('Ainda não há custos registrados no Resumo Financeiro.', 'erro');
                return;
            }

            const compartilhado = estado();
            const combustivelDetalhes = compartilhado.combustivel || {};
            const despesasDetalhes = compartilhado.despesas || {};
            const viagem = {
                id: gerarId(),
                titulo: titulo,
                origem: origem,
                destino: destino,
                distanciaKm: distanciaKm,
                data: campos.data.value || dataDeHoje(),
                combustivel: valorSeguro(resumo.combustivel),
                pedagios: valorSeguro(resumo.pedagios),
                outrasDespesas: valorSeguro(resumo.outrasDespesas),
                total: valorSeguro(resumo.total),
                viajantes: viajantes,
                custoPorPessoa: resumo.porPessoa ? valorSeguro(resumo.porPessoa.total) : 0,
                litros: valorSeguro(combustivelDetalhes.litros),
                consumoMedio: valorSeguro(combustivelDetalhes.consumoMedio),
                precoPorLitro: valorSeguro(combustivelDetalhes.precoPorLitro),
                pedagiosIda: valorSeguro(despesasDetalhes.totalPedagiosIda),
                pedagiosVolta: valorSeguro(despesasDetalhes.totalPedagiosVolta),
                categorias: resumo.categorias && typeof resumo.categorias === 'object' ? Object.assign({}, resumo.categorias) : {},
                painel: api().tripDashboard && typeof api().tripDashboard.obterResumoParaHistorico === 'function'
                    ? api().tripDashboard.obterResumoParaHistorico()
                    : null,
                salvoEm: new Date().toISOString()
            };

            viagens.push(viagem);
            if (!salvar()) {
                viagens.pop();
                mostrarMensagem('Não foi possível salvar no LocalStorage deste navegador.', 'erro');
                return;
            }
            renderizar();
            campos.titulo.value = '';
            mostrarMensagem('Viagem salva no histórico.', 'sucesso');
        }

        function aoClicarLista(evento) {
            const botao = evento.target.closest('button[data-acao]');
            if (!botao) return;
            const viagem = encontrarViagem(botao.dataset.id);
            if (!viagem) return;

            if (botao.dataset.acao === 'detalhes') {
                abrirDetalhes(viagem);
            } else if (botao.dataset.acao === 'pdf') {
                exportarPdf(viagem.id);
            } else if (botao.dataset.acao === 'excluir') {
                if (!window.confirm('Excluir a viagem "' + viagem.titulo + '" do histórico?')) return;
                viagens = viagens.filter(function (item) { return item.id !== viagem.id; });
                salvar();
                renderizar();
                mostrarMensagem('Viagem excluída do histórico.', 'sucesso');
            }
        }

        function aoLimpar() {
            if (!viagens.length) {
                mostrarMensagem('O histórico já está vazio.', 'info');
                return;
            }
            if (!window.confirm('Excluir todas as viagens salvas no histórico?')) return;

            viagens = [];
            const util = api();
            if (typeof util.removerLocal === 'function') util.removerLocal(CHAVE_HISTORICO);
            else {
                try { localStorage.removeItem(CHAVE_HISTORICO); } catch (erro) { /* armazenamento indisponível */ }
            }
            estado().historico = [];
            document.dispatchEvent(new CustomEvent('historico:alterado', {
                detail: { viagens: [], quantidade: 0 }
            }));
            renderizar();
            mostrarMensagem('Histórico limpo.', 'sucesso');
        }

        formulario.addEventListener('submit', aoSalvar);
        campos.limpar.addEventListener('click', aoLimpar);
        campos.lista.addEventListener('click', aoClicarLista);
        campos.fecharDetalhes.addEventListener('click', fecharDetalhes);

        document.addEventListener('rota:calculada', function () { preencherFormulario(true); });
        ['resumo:atualizado', 'despesas:alteradas', 'combustivel:calculado', 'combustivel:invalidado', 'rota:invalidada'].forEach(function (evento) {
            document.addEventListener(evento, function () { preencherFormulario(false); });
        });

        carregar();
        preencherFormulario(false);
        renderizar();
    });
})();
