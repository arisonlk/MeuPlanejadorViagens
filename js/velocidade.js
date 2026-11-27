/*
 * Meu Planejador de Viagens - calculadora de tempo e velocidade.
 * Cálculos teóricos, feitos localmente: tempo = distância / velocidade.
 */
(function () {
    'use strict';

    const VELOCIDADES = [80, 120, 140];

    document.addEventListener('DOMContentLoaded', function () {
        const formulario = document.getElementById('formulario-velocidade');
        if (!formulario) return;

        const campos = {
            distancia: document.getElementById('distancia-velocidade'),
            idaVolta: document.getElementById('velocidade-ida-volta'),
            usarRota: document.getElementById('botao-velocidade-usar-rota'),
            calcular: document.getElementById('botao-calcular-velocidade'),
            limpar: document.getElementById('botao-limpar-velocidade'),
            aviso: document.getElementById('aviso-velocidade'),
            origemDistancia: document.getElementById('origem-distancia-velocidade'),
            opcoes: Array.prototype.slice.call(document.querySelectorAll('#opcoes-velocidade input[type="checkbox"]')),
            resultados: document.getElementById('resultados-velocidade'),
            cards: document.getElementById('cards-velocidade'),
            grafico: document.getElementById('grafico-barras')
        };

        let origemAtual = 'manual';

        function api() {
            if (!window.PlanejadorViagens) window.PlanejadorViagens = {};
            return window.PlanejadorViagens;
        }

        function estado() {
            const util = api();
            if (!util.estado) util.estado = {};
            return util.estado;
        }

        function numero(valor) {
            const texto = String(valor === null || valor === undefined ? '' : valor)
                .trim().replace(/\s/g, '').replace(',', '.');
            return texto === '' ? NaN : Number(texto);
        }

        function formatarDecimal(valor, casas) {
            const util = api();
            if (typeof util.formatarDecimal === 'function') return util.formatarDecimal(valor, casas);
            return new Intl.NumberFormat('pt-BR', {
                minimumFractionDigits: casas,
                maximumFractionDigits: casas
            }).format(Number(valor));
        }

        function formatarHoraMinutos(horas) {
            const totalMinutos = Math.round(horas * 60);
            const horasParte = Math.floor(totalMinutos / 60);
            const minutosParte = totalMinutos % 60;
            if (horasParte === 0) return minutosParte + ' min';
            if (minutosParte === 0) return horasParte + ' h';
            return horasParte + ' h ' + minutosParte + ' min';
        }

        function formatarDiferenca(minutos) {
            const total = Math.round(minutos);
            if (total <= 0) return '0 min';
            const horas = Math.floor(total / 60);
            const resto = total % 60;
            return horas > 0 ? horas + ' h ' + resto + ' min' : resto + ' min';
        }

        function velocidadesSelecionadas() {
            return VELOCIDADES.filter(function (velocidade) {
                const campo = document.getElementById('vel-' + velocidade);
                return campo && campo.checked;
            });
        }

        function atualizarAparenciaOpcoes() {
            campos.opcoes.forEach(function (campo) {
                campo.parentElement.classList.toggle('selecionada', campo.checked);
            });
        }

        function mostrarErro(mensagem) {
            campos.aviso.textContent = mensagem;
            campos.aviso.hidden = false;
            campos.resultados.hidden = true;
            estado().velocidade = null;
            document.dispatchEvent(new CustomEvent('velocidade:invalidado'));
        }

        function limparErro() {
            campos.aviso.textContent = '';
            campos.aviso.hidden = true;
        }

        function adicionarLinha(parent, rotulo, valor) {
            const linha = document.createElement('div');
            linha.className = 'linha-resultado';
            const nome = document.createElement('span');
            nome.textContent = rotulo;
            const dado = document.createElement('strong');
            dado.textContent = valor;
            linha.appendChild(nome);
            linha.appendChild(dado);
            parent.appendChild(linha);
        }

        function renderizar(itens, distanciaConsiderada) {
            campos.cards.innerHTML = '';
            campos.grafico.innerHTML = '';

            const maisLento = itens[0].velocidade;
            const maisRapido = itens[itens.length - 1].velocidade;
            const maiorDuracao = itens[0].minutos;
            const descricoes = [];

            itens.forEach(function (item) {
                const card = document.createElement('div');
                card.className = 'card-velocidade' + (item.velocidade === maisRapido ? ' mais-rapida' : '');

                const titulo = document.createElement('div');
                titulo.className = 'velocidade-titulo';
                const nome = document.createElement('span');
                nome.textContent = item.velocidade + ' km/h';
                titulo.appendChild(nome);
                if (item.velocidade === maisRapido) {
                    const badge = document.createElement('span');
                    badge.className = 'velocidade-badge';
                    badge.textContent = 'Mais rápida';
                    titulo.appendChild(badge);
                }
                card.appendChild(titulo);

                adicionarLinha(card, 'Tempo estimado', item.texto);
                adicionarLinha(card, 'Horas decimais', formatarDecimal(item.horas, 2) + ' h');
                adicionarLinha(card, 'Diferença vs. ' + maisLento + ' km/h', formatarDiferenca(item.diferencaMinutos));
                adicionarLinha(card, 'Redução de tempo', formatarDecimal(item.percentualReducao, 1) + '%');
                campos.cards.appendChild(card);

                const linhaGrafico = document.createElement('div');
                linhaGrafico.className = 'barra-linha';
                const etiqueta = document.createElement('span');
                etiqueta.className = 'barra-etiqueta';
                etiqueta.textContent = item.velocidade + ' km/h';
                const fundo = document.createElement('div');
                fundo.className = 'barra-fundo';
                const barra = document.createElement('div');
                barra.className = 'barra-preenchimento';
                barra.style.width = Math.max(3, (item.minutos / maiorDuracao) * 100) + '%';
                fundo.appendChild(barra);
                const valor = document.createElement('span');
                valor.className = 'barra-valor';
                valor.textContent = item.texto;
                linhaGrafico.appendChild(etiqueta);
                linhaGrafico.appendChild(fundo);
                linhaGrafico.appendChild(valor);
                campos.grafico.appendChild(linhaGrafico);

                descricoes.push(item.velocidade + ' km/h: ' + item.texto);
            });

            campos.grafico.setAttribute('aria-label',
                'Duração estimada para ' + formatarDecimal(distanciaConsiderada, 1) +
                ' km. ' + descricoes.join('. ') + '.');
            campos.resultados.hidden = false;
        }

        function calcular() {
            const distancia = numero(campos.distancia.value);
            if (campos.distancia.value.trim() === '' || !Number.isFinite(distancia) || distancia <= 0) {
                mostrarErro('Informe uma distância maior que zero.');
                return;
            }

            const selecionadas = velocidadesSelecionadas();
            if (!selecionadas.length) {
                mostrarErro('Selecione ao menos uma velocidade para comparar.');
                return;
            }

            const distanciaConsiderada = distancia * (campos.idaVolta.checked ? 2 : 1);
            const velocidadeBase = selecionadas[0];
            const minutosBase = (distanciaConsiderada / velocidadeBase) * 60;

            const itens = selecionadas.map(function (velocidade) {
                const horas = distanciaConsiderada / velocidade;
                const minutos = horas * 60;
                const diferencaMinutos = minutosBase - minutos;
                return {
                    velocidade: velocidade,
                    horas: horas,
                    minutos: minutos,
                    texto: formatarHoraMinutos(horas),
                    diferencaMinutos: diferencaMinutos,
                    percentualReducao: minutosBase > 0 ? (diferencaMinutos / minutosBase) * 100 : 0
                };
            });

            renderizar(itens, distanciaConsiderada);
            limparErro();

            const detalhes = {
                distanciaKm: distancia,
                distanciaConsideradaKm: distanciaConsiderada,
                idaVolta: campos.idaVolta.checked,
                velocidades: itens
            };
            estado().velocidade = detalhes;
            document.dispatchEvent(new CustomEvent('velocidade:calculado', { detail: detalhes }));
        }

        function aplicarRota(detalhes) {
            if (!detalhes || !Number.isFinite(Number(detalhes.distanciaKm))) return;
            campos.distancia.value = Number(detalhes.distanciaKm).toFixed(1);
            origemAtual = 'rota';
            campos.origemDistancia.textContent = 'Distância obtida da rota calculada no mapa. Você pode editar este valor.';
            campos.usarRota.disabled = false;
            calcular();
        }

        function atualizarDisponibilidadeRota() {
            const rota = estado().rota;
            const disponivel = Boolean(rota && Number.isFinite(Number(rota.distanciaKm)));
            campos.usarRota.disabled = !disponivel;
            return disponivel;
        }

        function aoAlterar(evento) {
            if (evento.target === campos.distancia && origemAtual === 'rota') {
                origemAtual = 'manual';
                campos.origemDistancia.textContent = 'Distância informada manualmente.';
            }
            atualizarAparenciaOpcoes();
            calcular();
        }

        function limpar() {
            campos.distancia.value = '';
            campos.idaVolta.checked = false;
            campos.opcoes.forEach(function (campo) { campo.checked = true; });
            origemAtual = 'manual';
            campos.origemDistancia.textContent = 'Informe a distância manualmente ou calcule uma rota no mapa.';
            campos.cards.innerHTML = '';
            campos.grafico.innerHTML = '';
            campos.resultados.hidden = true;
            limparErro();
            atualizarAparenciaOpcoes();
            atualizarDisponibilidadeRota();
            estado().velocidade = null;
            document.dispatchEvent(new CustomEvent('velocidade:invalidado'));
        }

        formulario.addEventListener('input', aoAlterar);
        campos.calcular.addEventListener('click', calcular);
        campos.limpar.addEventListener('click', limpar);
        campos.usarRota.addEventListener('click', function () {
            aplicarRota(estado().rota);
        });

        document.addEventListener('rota:calculada', function (evento) {
            aplicarRota(evento.detail);
        });

        document.addEventListener('rota:invalidada', function () {
            if (origemAtual === 'rota') {
                origemAtual = 'manual';
                campos.origemDistancia.textContent = 'Distância informada manualmente. A rota no mapa foi alterada.';
            }
            atualizarDisponibilidadeRota();
        });

        atualizarAparenciaOpcoes();
        if (atualizarDisponibilidadeRota()) aplicarRota(estado().rota);
        else if (campos.distancia.value.trim() !== '') calcular();
    });
})();
