/*
 * Meu Planejador de Viagens - calculadora de combustível.
 * Todos os cálculos e o armazenamento do veículo acontecem localmente no navegador.
 * Nenhum preço de combustível é inventado ou buscado na internet.
 */
(function () {
    'use strict';

    const CHAVE_VEICULO = 'mpv.veiculo';
    const CAMPOS_VEICULO = ['veiculo-nome', 'veiculo-combustivel', 'consumo-cidade', 'consumo-estrada'];

    document.addEventListener('DOMContentLoaded', function () {
        const formulario = document.getElementById('formulario-combustivel');
        if (!formulario) return;

        const campos = {
            nome: document.getElementById('veiculo-nome'),
            tipoCombustivel: document.getElementById('veiculo-combustivel'),
            consumoCidade: document.getElementById('consumo-cidade'),
            consumoEstrada: document.getElementById('consumo-estrada'),
            consumoMedio: document.getElementById('consumo-medio'),
            distancia: document.getElementById('distancia-viagem'),
            preco: document.getElementById('preco-combustivel'),
            tipoPercurso: document.getElementById('tipo-percurso'),
            percentualUrbano: document.getElementById('percentual-urbano'),
            campoPercentual: document.getElementById('campo-percentual'),
            idaVolta: document.getElementById('ida-volta')
        };

        const botoes = {
            usarRota: document.getElementById('botao-usar-rota'),
            calcular: document.getElementById('botao-calcular-combustivel'),
            limpar: document.getElementById('botao-limpar-combustivel')
        };

        const avisos = {
            veiculo: document.getElementById('aviso-veiculo'),
            calculo: document.getElementById('aviso-combustivel')
        };

        const resultados = {
            caixa: document.getElementById('resultados-combustivel'),
            distancia: document.getElementById('combustivel-distancia'),
            consumo: document.getElementById('combustivel-consumo'),
            litros: document.getElementById('combustivel-litros'),
            preco: document.getElementById('combustivel-preco'),
            custo: document.getElementById('combustivel-custo'),
            custoKm: document.getElementById('combustivel-custo-km'),
            litrosIdaVolta: document.getElementById('combustivel-litros-ida-volta'),
            custoIdaVolta: document.getElementById('combustivel-custo-ida-volta')
        };

        const origemDistancia = document.getElementById('origem-distancia');
        let temporizadorAvisoVeiculo = null;
        let origemAtualDaDistancia = 'manual';

        function api() {
            if (!window.PlanejadorViagens) window.PlanejadorViagens = {};
            return window.PlanejadorViagens;
        }

        function numero(valor) {
            const texto = String(valor === null || valor === undefined ? '' : valor)
                .trim()
                .replace(/\s/g, '')
                .replace(',', '.');
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

        function formatarMoeda(valor) {
            const util = api();
            if (typeof util.formatarMoeda === 'function') return util.formatarMoeda(valor);
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(Number(valor));
        }

        function estado() {
            const util = api();
            if (!util.estado) util.estado = {};
            return util.estado;
        }

        function avisoVeiculo(mensagem) {
            if (!avisos.veiculo) return;
            avisos.veiculo.textContent = mensagem;
            avisos.veiculo.hidden = false;
            if (temporizadorAvisoVeiculo) clearTimeout(temporizadorAvisoVeiculo);
            temporizadorAvisoVeiculo = setTimeout(function () {
                avisos.veiculo.hidden = true;
            }, 3000);
        }

        function salvarVeiculo() {
            const dados = {
                nome: campos.nome.value.trim(),
                combustivel: campos.tipoCombustivel.value,
                consumoCidade: campos.consumoCidade.value.trim(),
                consumoEstrada: campos.consumoEstrada.value.trim()
            };
            const util = api();
            let ok = false;
            if (typeof util.salvarLocal === 'function') ok = util.salvarLocal(CHAVE_VEICULO, dados);
            else {
                try {
                    localStorage.setItem(CHAVE_VEICULO, JSON.stringify(dados));
                    ok = true;
                } catch (erro) {
                    ok = false;
                }
            }
            avisoVeiculo(ok
                ? 'Dados do veículo salvos neste navegador.'
                : 'Não foi possível salvar os dados do veículo neste navegador.');
        }

        function carregarVeiculo() {
            const util = api();
            let dados = null;
            if (typeof util.lerLocal === 'function') dados = util.lerLocal(CHAVE_VEICULO, null);
            else {
                try {
                    const bruto = localStorage.getItem(CHAVE_VEICULO);
                    dados = bruto ? JSON.parse(bruto) : null;
                } catch (erro) {
                    dados = null;
                }
            }
            if (!dados || typeof dados !== 'object') return;

            if (typeof dados.nome === 'string') campos.nome.value = dados.nome;
            if (['gasolina', 'etanol', 'diesel'].indexOf(dados.combustivel) >= 0) {
                campos.tipoCombustivel.value = dados.combustivel;
            }
            if (dados.consumoCidade !== undefined && dados.consumoCidade !== null) {
                campos.consumoCidade.value = String(dados.consumoCidade).replace(',', '.');
            }
            if (dados.consumoEstrada !== undefined && dados.consumoEstrada !== null) {
                campos.consumoEstrada.value = String(dados.consumoEstrada).replace(',', '.');
            }
        }

        function mostrarErro(mensagens) {
            avisos.calculo.textContent = mensagens.join(' ');
            avisos.calculo.className = 'aviso-rota erro';
            avisos.calculo.hidden = false;
            resultados.caixa.hidden = true;
            campos.consumoMedio.value = '';
            estado().combustivel = null;
            document.dispatchEvent(new CustomEvent('combustivel:invalidado'));
        }

        function limparErro() {
            avisos.calculo.textContent = '';
            avisos.calculo.hidden = true;
            avisos.calculo.className = 'aviso-rota erro';
        }

        function atualizarVisibilidadePercentual() {
            campos.campoPercentual.hidden = campos.tipoPercurso.value !== 'misto';
        }

        function calcular() {
            const erros = [];

            const distancia = numero(campos.distancia.value);
            if (campos.distancia.value.trim() === '' || !Number.isFinite(distancia) || distancia <= 0) {
                erros.push('Informe uma distância maior que zero.');
            }

            const preco = numero(campos.preco.value);
            if (campos.preco.value.trim() === '' || !Number.isFinite(preco) || preco < 0) {
                erros.push('Informe o preço do combustível por litro.');
            }

            const consumoCidade = numero(campos.consumoCidade.value);
            const consumoEstrada = numero(campos.consumoEstrada.value);
            const tipoPercurso = campos.tipoPercurso.value;
            let urbano = 0;

            if (tipoPercurso === 'cidade' && (!Number.isFinite(consumoCidade) || consumoCidade <= 0)) {
                erros.push('Informe o consumo na cidade.');
            }
            if (tipoPercurso === 'estrada' && (!Number.isFinite(consumoEstrada) || consumoEstrada <= 0)) {
                erros.push('Informe o consumo na estrada.');
            }
            if (tipoPercurso === 'misto') {
                if (!Number.isFinite(consumoCidade) || consumoCidade <= 0 ||
                    !Number.isFinite(consumoEstrada) || consumoEstrada <= 0) {
                    erros.push('Informe os consumos na cidade e na estrada.');
                }
                urbano = numero(campos.percentualUrbano.value);
                if (!Number.isFinite(urbano) || urbano < 0 || urbano > 100) {
                    erros.push('O percentual de percurso urbano deve estar entre 0 e 100.');
                }
            }

            if (erros.length) {
                mostrarErro(erros);
                return;
            }

            let consumoMedio;
            if (tipoPercurso === 'cidade') {
                consumoMedio = consumoCidade;
            } else if (tipoPercurso === 'estrada') {
                consumoMedio = consumoEstrada;
            } else {
                const fracaoUrbana = urbano / 100;
                const fracaoRodoviaria = 1 - fracaoUrbana;
                consumoMedio = 1 / (fracaoUrbana / consumoCidade + fracaoRodoviaria / consumoEstrada);
            }

            if (!Number.isFinite(consumoMedio) || consumoMedio <= 0) {
                mostrarErro(['Não foi possível determinar o consumo médio. Revise os consumos informados.']);
                return;
            }

            const fatorViagem = campos.idaVolta.checked ? 2 : 1;
            const distanciaConsiderada = distancia * fatorViagem;
            const litros = distanciaConsiderada / consumoMedio;
            const custoTotal = litros * preco;
            const custoPorKm = preco / consumoMedio;
            const litrosIdaVolta = (distancia * 2) / consumoMedio;
            const custoIdaVolta = litrosIdaVolta * preco;

            campos.consumoMedio.value = formatarDecimal(consumoMedio, 2);
            resultados.distancia.textContent = formatarDecimal(distanciaConsiderada, 1) + ' km' +
                (campos.idaVolta.checked ? ' (ida e volta)' : '');
            resultados.consumo.textContent = formatarDecimal(consumoMedio, 2) + ' km/l';
            resultados.litros.textContent = formatarDecimal(litros, 1) + ' L';
            resultados.preco.textContent = formatarMoeda(preco) + '/L';
            resultados.custo.textContent = formatarMoeda(custoTotal);
            resultados.custoKm.textContent = formatarMoeda(custoPorKm);
            resultados.litrosIdaVolta.textContent = formatarDecimal(litrosIdaVolta, 1) + ' L';
            resultados.custoIdaVolta.textContent = formatarMoeda(custoIdaVolta);
            resultados.caixa.hidden = false;
            limparErro();

            const detalhes = {
                veiculo: campos.nome.value.trim(),
                combustivel: campos.tipoCombustivel.value,
                tipoPercurso: tipoPercurso,
                percentualUrbano: urbano,
                distanciaKm: distancia,
                distanciaConsideradaKm: distanciaConsiderada,
                idaVolta: campos.idaVolta.checked,
                consumoMedio: consumoMedio,
                precoPorLitro: preco,
                litros: litros,
                custoTotal: custoTotal,
                custoPorKm: custoPorKm,
                litrosIdaVolta: litrosIdaVolta,
                custoIdaVolta: custoIdaVolta
            };
            estado().combustivel = detalhes;
            document.dispatchEvent(new CustomEvent('combustivel:calculado', { detail: detalhes }));
        }

        function aplicarRota(detalhes) {
            if (!detalhes || !Number.isFinite(Number(detalhes.distanciaKm))) return;
            campos.distancia.value = Number(detalhes.distanciaKm).toFixed(1);
            origemAtualDaDistancia = 'rota';
            if (origemDistancia) {
                origemDistancia.textContent = 'Distância obtida da rota calculada no mapa. Você pode editar este valor.';
            }
            if (botoes.usarRota) botoes.usarRota.disabled = false;
            calcular();
        }

        function atualizarDisponibilidadeRota() {
            const rota = estado().rota;
            const disponivel = Boolean(rota && Number.isFinite(Number(rota.distanciaKm)));
            if (botoes.usarRota) botoes.usarRota.disabled = !disponivel;
            return disponivel;
        }

        function aoAlterar(evento) {
            if (CAMPOS_VEICULO.indexOf(evento.target.id) >= 0) salvarVeiculo();
            if (evento.target === campos.tipoPercurso) atualizarVisibilidadePercentual();
            if (evento.target === campos.distancia && origemAtualDaDistancia === 'rota') {
                origemAtualDaDistancia = 'manual';
                if (origemDistancia) origemDistancia.textContent = 'Distância informada manualmente.';
            }
            calcular();
        }

        function limpar() {
            formulario.reset();
            campos.tipoPercurso.value = 'estrada';
            campos.percentualUrbano.value = '50';
            campos.consumoMedio.value = '';
            origemAtualDaDistancia = 'manual';
            if (origemDistancia) {
                origemDistancia.textContent = 'Informe a distância manualmente ou calcule uma rota no mapa.';
            }
            atualizarVisibilidadePercentual();
            atualizarDisponibilidadeRota();
            resultados.caixa.hidden = true;
            limparErro();
            estado().combustivel = null;
            document.dispatchEvent(new CustomEvent('combustivel:invalidado'));

            const util = api();
            if (typeof util.removerLocal === 'function') util.removerLocal(CHAVE_VEICULO);
            else {
                try { localStorage.removeItem(CHAVE_VEICULO); } catch (erro) { /* armazenamento indisponível */ }
            }
            avisoVeiculo('Campos limpos. Os dados salvos do veículo foram removidos.');
        }

        formulario.addEventListener('input', aoAlterar);

        if (botoes.calcular) botoes.calcular.addEventListener('click', calcular);
        if (botoes.limpar) botoes.limpar.addEventListener('click', limpar);
        if (botoes.usarRota) {
            botoes.usarRota.addEventListener('click', function () {
                aplicarRota(estado().rota);
            });
        }

        document.addEventListener('rota:calculada', function (evento) {
            aplicarRota(evento.detail);
        });

        document.addEventListener('rota:invalidada', function () {
            if (origemAtualDaDistancia === 'rota') {
                origemAtualDaDistancia = 'manual';
                if (origemDistancia) {
                    origemDistancia.textContent = 'Distância informada manualmente. A rota no mapa foi alterada.';
                }
            }
            atualizarDisponibilidadeRota();
        });

        carregarVeiculo();
        atualizarVisibilidadePercentual();
        if (atualizarDisponibilidadeRota()) aplicarRota(estado().rota);
        else if (campos.distancia.value.trim() !== '') calcular();
    });
})();
