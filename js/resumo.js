/*
 * Meu Planejador de Viagens - resumo financeiro integrado.
 * Lê exclusivamente o estado compartilhado dos módulos; não cria fontes de dados paralelas.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const painel = document.getElementById('resultados-financeiros');
        if (!painel) return;

        const campos = {
            combustivel: document.getElementById('resumo-combustivel'),
            pedagios: document.getElementById('resumo-pedagios'),
            despesas: document.getElementById('resumo-despesas'),
            total: document.getElementById('resumo-total'),
            custoKm: document.getElementById('resumo-custo-km'),
            distancia: document.getElementById('resumo-distancia'),
            origemDistancia: document.getElementById('origem-distancia-resumo'),
            viajantes: document.getElementById('numero-viajantes'),
            avisoViajantes: document.getElementById('aviso-viajantes'),
            porPessoaTotal: document.getElementById('por-pessoa-total'),
            porPessoaCombustivel: document.getElementById('por-pessoa-combustivel'),
            porPessoaPedagios: document.getElementById('por-pessoa-pedagios'),
            porPessoaDespesas: document.getElementById('por-pessoa-despesas'),
            grafico: document.getElementById('grafico-despesas')
        };

        function api() {
            if (!window.PlanejadorViagens) window.PlanejadorViagens = {};
            return window.PlanejadorViagens;
        }

        function estado() {
            const util = api();
            if (!util.estado) util.estado = {};
            return util.estado;
        }

        function valorSeguro(valor) {
            const numero = Number(valor);
            return Number.isFinite(numero) && numero > 0 ? numero : 0;
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

        function obterDistancia() {
            const compartilhado = estado();
            const combustivel = compartilhado.combustivel;
            if (combustivel && Number.isFinite(Number(combustivel.distanciaConsideradaKm)) && Number(combustivel.distanciaConsideradaKm) > 0) {
                return {
                    km: Number(combustivel.distanciaConsideradaKm),
                    origem: combustivel.idaVolta
                        ? 'Distância considerada nos cálculos de combustível, incluindo ida e volta.'
                        : 'Distância considerada nos cálculos de combustível.'
                };
            }
            if (combustivel && Number.isFinite(Number(combustivel.distanciaKm)) && Number(combustivel.distanciaKm) > 0) {
                return {
                    km: Number(combustivel.distanciaKm),
                    origem: 'Distância informada na calculadora de combustível.'
                };
            }
            const rota = compartilhado.rota;
            if (rota && Number.isFinite(Number(rota.distanciaKm)) && Number(rota.distanciaKm) > 0) {
                return { km: Number(rota.distanciaKm), origem: 'Distância obtida da rota calculada no mapa.' };
            }
            return { km: 0, origem: 'Distância não informada. O custo por quilômetro não foi calculado.' };
        }

        function obterCategorias(totalOutrasDespesas) {
            const lista = (estado().despesas && estado().despesas.despesas) || [];
            const somar = function (categoria) {
                return lista.filter(function (item) { return item && item.categoria === categoria; })
                    .reduce(function (total, item) { return total + valorSeguro(item.valor); }, 0);
            };
            const alimentacao = somar('Alimentação');
            const hospedagem = somar('Hospedagem');
            const estacionamento = somar('Estacionamento');
            const manutencao = somar('Manutenção');
            const restante = totalOutrasDespesas - alimentacao - hospedagem - estacionamento - manutencao;
            return {
                alimentacao: alimentacao,
                hospedagem: hospedagem,
                estacionamento: estacionamento,
                manutencao: manutencao,
                outras: restante > 0 ? restante : 0
            };
        }

        function criarBarra(rotulo, valor, total, classeCor) {
            const linha = document.createElement('div');
            linha.className = 'barra-linha';

            const etiqueta = document.createElement('span');
            etiqueta.className = 'barra-etiqueta';
            etiqueta.textContent = rotulo;

            const fundo = document.createElement('div');
            fundo.className = 'barra-fundo';
            const barra = document.createElement('div');
            barra.className = 'barra-preenchimento ' + classeCor;
            barra.style.width = (total > 0 ? Math.max(0, (valor / total) * 100) : 0) + '%';
            fundo.appendChild(barra);

            const texto = document.createElement('span');
            texto.className = 'barra-valor';
            texto.textContent = formatarMoeda(valor);

            linha.appendChild(etiqueta);
            linha.appendChild(fundo);
            linha.appendChild(texto);
            return { linha: linha, descricao: rotulo + ': ' + formatarMoeda(valor) };
        }

        function renderizarGrafico(itens, total) {
            campos.grafico.innerHTML = '';
            if (total <= 0) {
                const mensagem = document.createElement('p');
                mensagem.className = 'sugestao-mensagem';
                mensagem.textContent = 'Sem dados para exibir o gráfico.';
                campos.grafico.appendChild(mensagem);
                campos.grafico.setAttribute('aria-label', 'Sem dados para exibir o gráfico.');
                return;
            }

            const descricoes = [];
            itens.forEach(function (item) {
                const resultado = criarBarra(item.rotulo, item.valor, total, item.classe);
                campos.grafico.appendChild(resultado.linha);
                descricoes.push(resultado.descricao);
            });
            campos.grafico.setAttribute('aria-label', 'Distribuição das despesas. ' + descricoes.join('. ') + '.');
        }

        function atualizar() {
            const compartilhado = estado();
            const combustivel = valorSeguro(compartilhado.combustivel && compartilhado.combustivel.custoTotal);
            const despesas = compartilhado.despesas || {};
            const pedagios = valorSeguro(despesas.totalPedagios);
            const outras = valorSeguro(despesas.totalOutrasDespesas);
            const total = combustivel + pedagios + outras;
            const distancia = obterDistancia();
            const custoPorKm = distancia.km > 0 ? total / distancia.km : 0;

            campos.combustivel.textContent = formatarMoeda(combustivel);
            campos.pedagios.textContent = formatarMoeda(pedagios);
            campos.despesas.textContent = formatarMoeda(outras);
            campos.total.textContent = formatarMoeda(total);
            campos.custoKm.textContent = distancia.km > 0 ? formatarMoeda(custoPorKm) : formatarMoeda(0);
            campos.distancia.textContent = distancia.km > 0
                ? formatarDecimal(distancia.km, 1) + ' km'
                : '—';
            campos.origemDistancia.textContent = distancia.origem;

            const entradaViajantes = campos.viajantes.value.trim().replace(',', '.');
            const quantidade = Number(entradaViajantes);
            const viajantesValidos = Number.isInteger(quantidade) && quantidade >= 1;

            if (viajantesValidos) {
                campos.avisoViajantes.hidden = true;
                campos.avisoViajantes.textContent = '';
                campos.porPessoaTotal.textContent = formatarMoeda(total / quantidade);
                campos.porPessoaCombustivel.textContent = formatarMoeda(combustivel / quantidade);
                campos.porPessoaPedagios.textContent = formatarMoeda(pedagios / quantidade);
                campos.porPessoaDespesas.textContent = formatarMoeda(outras / quantidade);
            } else {
                campos.avisoViajantes.textContent = 'Informe um número inteiro de viajantes maior ou igual a 1.';
                campos.avisoViajantes.hidden = false;
                campos.porPessoaTotal.textContent = formatarMoeda(0);
                campos.porPessoaCombustivel.textContent = formatarMoeda(0);
                campos.porPessoaPedagios.textContent = formatarMoeda(0);
                campos.porPessoaDespesas.textContent = formatarMoeda(0);
            }

            const categorias = obterCategorias(outras);
            renderizarGrafico([
                { rotulo: 'Combustível', valor: combustivel, classe: 'cor-combustivel' },
                { rotulo: 'Pedágios', valor: pedagios, classe: 'cor-pedagios' },
                { rotulo: 'Alimentação', valor: categorias.alimentacao, classe: 'cor-alimentacao' },
                { rotulo: 'Hospedagem', valor: categorias.hospedagem, classe: 'cor-hospedagem' },
                { rotulo: 'Estacionamento', valor: categorias.estacionamento, classe: 'cor-estacionamento' },
                { rotulo: 'Manutenção', valor: categorias.manutencao, classe: 'cor-outros' },
                { rotulo: 'Outras despesas', valor: categorias.outras, classe: 'cor-outros' }
            ], total);

            const resumo = {
                combustivel: combustivel,
                pedagios: pedagios,
                outrasDespesas: outras,
                total: total,
                custoPorKm: custoPorKm,
                distanciaKm: distancia.km,
                origemDistancia: distancia.origem,
                viajantes: viajantesValidos ? quantidade : 0,
                porPessoa: {
                    total: viajantesValidos ? total / quantidade : 0,
                    combustivel: viajantesValidos ? combustivel / quantidade : 0,
                    pedagios: viajantesValidos ? pedagios / quantidade : 0,
                    despesas: viajantesValidos ? outras / quantidade : 0
                },
                categorias: categorias
            };
            compartilhado.resumo = resumo;
            document.dispatchEvent(new CustomEvent('resumo:atualizado', { detail: resumo }));
        }

        campos.viajantes.addEventListener('input', atualizar);
        [
            'combustivel:calculado',
            'combustivel:invalidado',
            'despesas:alteradas',
            'rota:calculada',
            'rota:invalidada'
        ].forEach(function (evento) {
            document.addEventListener(evento, atualizar);
        });

        atualizar();
    });
})();
