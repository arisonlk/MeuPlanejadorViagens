/*
 * Meu Planejador de Viagens - pedágios e outras despesas.
 * Registros informados manualmente e armazenados apenas no LocalStorage do navegador.
 */
(function () {
    'use strict';

    const CHAVE_ARMAZENAMENTO = 'mpv.despesas';
    const CATEGORIAS = ['Alimentação', 'Hospedagem', 'Estacionamento', 'Manutenção', 'Outros'];

    document.addEventListener('DOMContentLoaded', function () {
        const formularioPedagio = document.getElementById('formulario-pedagio');
        const formularioDespesa = document.getElementById('formulario-despesa');
        if (!formularioPedagio || !formularioDespesa) return;

        const campos = {
            pedagio: {
                nome: document.getElementById('pedagio-nome'),
                rodovia: document.getElementById('pedagio-rodovia'),
                valor: document.getElementById('pedagio-valor'),
                sentido: document.getElementById('pedagio-sentido'),
                observacao: document.getElementById('pedagio-observacao'),
                botao: document.getElementById('botao-salvar-pedagio'),
                cancelar: document.getElementById('botao-cancelar-pedagio'),
                aviso: document.getElementById('aviso-pedagio'),
                lista: document.getElementById('lista-pedagios')
            },
            despesa: {
                descricao: document.getElementById('despesa-descricao'),
                categoria: document.getElementById('despesa-categoria'),
                valor: document.getElementById('despesa-valor'),
                data: document.getElementById('despesa-data'),
                observacao: document.getElementById('despesa-observacao'),
                botao: document.getElementById('botao-salvar-despesa'),
                cancelar: document.getElementById('botao-cancelar-despesa'),
                aviso: document.getElementById('aviso-despesa'),
                lista: document.getElementById('lista-despesas')
            },
            totais: {
                ida: document.getElementById('total-pedagios-ida'),
                volta: document.getElementById('total-pedagios-volta'),
                pedagios: document.getElementById('total-pedagios'),
                outras: document.getElementById('total-outras-despesas'),
                geral: document.getElementById('total-geral-despesas')
            }
        };

        let registro = { pedagios: [], despesas: [] };
        let editandoPedagio = null;
        let editandoDespesa = null;

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

        function formatarMoeda(valor) {
            const util = api();
            if (typeof util.formatarMoeda === 'function') return util.formatarMoeda(valor);
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor));
        }

        function textoOuVazio(valor) {
            return typeof valor === 'string' ? valor : '';
        }

        function gerarId() {
            return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        }

        function carregar() {
            const util = api();
            let salvo = null;
            if (typeof util.lerLocal === 'function') salvo = util.lerLocal(CHAVE_ARMAZENAMENTO, null);
            else {
                try {
                    const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
                    salvo = bruto ? JSON.parse(bruto) : null;
                } catch (erro) {
                    salvo = null;
                }
            }
            if (!salvo || typeof salvo !== 'object') return;

            registro.pedagios = Array.isArray(salvo.pedagios) ? salvo.pedagios.filter(function (item) {
                return item && Number.isFinite(Number(item.valor)) &&
                    ['ida', 'volta'].indexOf(item.sentido) >= 0;
            }).map(function (item) {
                return {
                    id: textoOuVazio(item.id) || gerarId(),
                    nome: textoOuVazio(item.nome),
                    rodovia: textoOuVazio(item.rodovia),
                    valor: Number(item.valor),
                    sentido: item.sentido,
                    observacao: textoOuVazio(item.observacao)
                };
            }) : [];

            registro.despesas = Array.isArray(salvo.despesas) ? salvo.despesas.filter(function (item) {
                return item && Number.isFinite(Number(item.valor)) && CATEGORIAS.indexOf(item.categoria) >= 0;
            }).map(function (item) {
                return {
                    id: textoOuVazio(item.id) || gerarId(),
                    descricao: textoOuVazio(item.descricao),
                    categoria: item.categoria,
                    valor: Number(item.valor),
                    data: textoOuVazio(item.data),
                    observacao: textoOuVazio(item.observacao)
                };
            }) : [];
        }

        function salvar() {
            const util = api();
            let ok = false;
            if (typeof util.salvarLocal === 'function') ok = util.salvarLocal(CHAVE_ARMAZENAMENTO, registro);
            else {
                try {
                    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(registro));
                    ok = true;
                } catch (erro) {
                    ok = false;
                }
            }
            if (!ok) {
                mostrarAviso(campos.pedagio.aviso, 'Os valores foram atualizados nesta sessão, mas não foi possível salvar no navegador.');
            }
            return ok;
        }

        function mostrarAviso(campo, mensagem) {
            campo.textContent = mensagem;
            campo.hidden = false;
        }

        function limparAviso(campo) {
            campo.textContent = '';
            campo.hidden = true;
        }

        function adicionarCelula(linha, texto, classe) {
            const celula = document.createElement('td');
            celula.textContent = texto;
            if (classe) celula.className = classe;
            linha.appendChild(celula);
            return celula;
        }

        function criarBotaoAcao(acao, id, rotulo, classeExtra) {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'botao-tabela' + (classeExtra ? ' ' + classeExtra : '');
            botao.textContent = rotulo;
            botao.dataset.acao = acao;
            botao.dataset.id = id;
            return botao;
        }

        function renderizarPedagios() {
            const lista = campos.pedagio.lista;
            lista.innerHTML = '';
            if (!registro.pedagios.length) {
                const linha = document.createElement('tr');
                const celula = document.createElement('td');
                celula.colSpan = 5;
                celula.className = 'tabela-vazia';
                celula.textContent = 'Nenhum pedágio cadastrado.';
                linha.appendChild(celula);
                lista.appendChild(linha);
                return;
            }
            registro.pedagios.forEach(function (item) {
                const linha = document.createElement('tr');
                adicionarCelula(linha, item.nome || '—');
                adicionarCelula(linha, item.rodovia || '—');
                adicionarCelula(linha, item.sentido === 'ida' ? 'Ida' : 'Volta');
                adicionarCelula(linha, formatarMoeda(item.valor), 'valor-coluna');
                const acoes = document.createElement('td');
                const grupo = document.createElement('div');
                grupo.className = 'acoes-tabela';
                grupo.appendChild(criarBotaoAcao('editar-pedagio', item.id, 'Editar'));
                grupo.appendChild(criarBotaoAcao('excluir-pedagio', item.id, 'Excluir', 'excluir'));
                acoes.appendChild(grupo);
                linha.appendChild(acoes);
                lista.appendChild(linha);
            });
        }

        function formatarData(valor) {
            if (!valor) return '—';
            const partes = valor.split('-');
            if (partes.length !== 3) return valor;
            return partes[2] + '/' + partes[1] + '/' + partes[0];
        }

        function renderizarDespesas() {
            const lista = campos.despesa.lista;
            lista.innerHTML = '';
            if (!registro.despesas.length) {
                const linha = document.createElement('tr');
                const celula = document.createElement('td');
                celula.colSpan = 5;
                celula.className = 'tabela-vazia';
                celula.textContent = 'Nenhuma despesa cadastrada.';
                linha.appendChild(celula);
                lista.appendChild(linha);
                return;
            }
            registro.despesas.forEach(function (item) {
                const linha = document.createElement('tr');
                adicionarCelula(linha, item.descricao || '—');
                adicionarCelula(linha, item.categoria);
                adicionarCelula(linha, formatarData(item.data));
                adicionarCelula(linha, formatarMoeda(item.valor), 'valor-coluna');
                const acoes = document.createElement('td');
                const grupo = document.createElement('div');
                grupo.className = 'acoes-tabela';
                grupo.appendChild(criarBotaoAcao('editar-despesa', item.id, 'Editar'));
                grupo.appendChild(criarBotaoAcao('excluir-despesa', item.id, 'Excluir', 'excluir'));
                acoes.appendChild(grupo);
                linha.appendChild(acoes);
                lista.appendChild(linha);
            });
        }

        function atualizarTotais() {
            const soma = function (itens) {
                return itens.reduce(function (total, item) { return total + Number(item.valor); }, 0);
            };
            const ida = soma(registro.pedagios.filter(function (item) { return item.sentido === 'ida'; }));
            const volta = soma(registro.pedagios.filter(function (item) { return item.sentido === 'volta'; }));
            const totalPedagios = ida + volta;
            const outras = soma(registro.despesas);
            const geral = totalPedagios + outras;

            campos.totais.ida.textContent = formatarMoeda(ida);
            campos.totais.volta.textContent = formatarMoeda(volta);
            campos.totais.pedagios.textContent = formatarMoeda(totalPedagios);
            campos.totais.outras.textContent = formatarMoeda(outras);
            campos.totais.geral.textContent = formatarMoeda(geral);

            const detalhes = {
                pedagios: registro.pedagios.slice(),
                despesas: registro.despesas.slice(),
                totalPedagiosIda: ida,
                totalPedagiosVolta: volta,
                totalPedagios: totalPedagios,
                totalOutrasDespesas: outras,
                totalGeral: geral
            };
            estado().despesas = detalhes;
            document.dispatchEvent(new CustomEvent('despesas:alteradas', { detail: detalhes }));
        }

        function atualizarTudo() {
            salvar();
            renderizarPedagios();
            renderizarDespesas();
            atualizarTotais();
        }

        function cancelarEdicaoPedagio() {
            editandoPedagio = null;
            formularioPedagio.reset();
            campos.pedagio.botao.textContent = 'Adicionar pedágio';
            campos.pedagio.cancelar.hidden = true;
            limparAviso(campos.pedagio.aviso);
        }

        function cancelarEdicaoDespesa() {
            editandoDespesa = null;
            formularioDespesa.reset();
            campos.despesa.botao.textContent = 'Adicionar despesa';
            campos.despesa.cancelar.hidden = true;
            limparAviso(campos.despesa.aviso);
        }

        function aoSalvarPedagio(evento) {
            evento.preventDefault();
            const nome = campos.pedagio.nome.value.trim();
            const valor = numero(campos.pedagio.valor.value);
            if (!nome) {
                mostrarAviso(campos.pedagio.aviso, 'Informe o nome ou a localização do pedágio.');
                return;
            }
            if (campos.pedagio.valor.value.trim() === '' || !Number.isFinite(valor) || valor <= 0) {
                mostrarAviso(campos.pedagio.aviso, 'Informe um valor maior que zero.');
                return;
            }

            const item = {
                id: editandoPedagio || gerarId(),
                nome: nome,
                rodovia: campos.pedagio.rodovia.value.trim(),
                valor: valor,
                sentido: campos.pedagio.sentido.value,
                observacao: campos.pedagio.observacao.value.trim()
            };

            if (editandoPedagio) {
                const indice = registro.pedagios.findIndex(function (p) { return p.id === editandoPedagio; });
                if (indice >= 0) registro.pedagios[indice] = item;
                else registro.pedagios.push(item);
            } else {
                registro.pedagios.push(item);
            }

            cancelarEdicaoPedagio();
            atualizarTudo();
        }

        function aoSalvarDespesa(evento) {
            evento.preventDefault();
            const descricao = campos.despesa.descricao.value.trim();
            const valor = numero(campos.despesa.valor.value);
            if (!descricao) {
                mostrarAviso(campos.despesa.aviso, 'Informe a descrição da despesa.');
                return;
            }
            if (campos.despesa.valor.value.trim() === '' || !Number.isFinite(valor) || valor <= 0) {
                mostrarAviso(campos.despesa.aviso, 'Informe um valor maior que zero.');
                return;
            }

            const item = {
                id: editandoDespesa || gerarId(),
                descricao: descricao,
                categoria: campos.despesa.categoria.value,
                valor: valor,
                data: campos.despesa.data.value,
                observacao: campos.despesa.observacao.value.trim()
            };

            if (editandoDespesa) {
                const indice = registro.despesas.findIndex(function (d) { return d.id === editandoDespesa; });
                if (indice >= 0) registro.despesas[indice] = item;
                else registro.despesas.push(item);
            } else {
                registro.despesas.push(item);
            }

            cancelarEdicaoDespesa();
            atualizarTudo();
        }

        function aoClicarPedagio(evento) {
            const botao = evento.target.closest('button[data-acao]');
            if (!botao) return;
            const id = botao.dataset.id;

            if (botao.dataset.acao === 'editar-pedagio') {
                const item = registro.pedagios.find(function (p) { return p.id === id; });
                if (!item) return;
                campos.pedagio.nome.value = item.nome;
                campos.pedagio.rodovia.value = item.rodovia;
                campos.pedagio.valor.value = String(item.valor).replace(',', '.');
                campos.pedagio.sentido.value = item.sentido;
                campos.pedagio.observacao.value = item.observacao;
                editandoPedagio = id;
                campos.pedagio.botao.textContent = 'Salvar alterações';
                campos.pedagio.cancelar.hidden = false;
                limparAviso(campos.pedagio.aviso);
            } else if (botao.dataset.acao === 'excluir-pedagio') {
                registro.pedagios = registro.pedagios.filter(function (p) { return p.id !== id; });
                if (editandoPedagio === id) cancelarEdicaoPedagio();
                atualizarTudo();
            }
        }

        function aoClicarDespesa(evento) {
            const botao = evento.target.closest('button[data-acao]');
            if (!botao) return;
            const id = botao.dataset.id;

            if (botao.dataset.acao === 'editar-despesa') {
                const item = registro.despesas.find(function (d) { return d.id === id; });
                if (!item) return;
                campos.despesa.descricao.value = item.descricao;
                campos.despesa.categoria.value = item.categoria;
                campos.despesa.valor.value = String(item.valor).replace(',', '.');
                campos.despesa.data.value = item.data;
                campos.despesa.observacao.value = item.observacao;
                editandoDespesa = id;
                campos.despesa.botao.textContent = 'Salvar alterações';
                campos.despesa.cancelar.hidden = false;
                limparAviso(campos.despesa.aviso);
            } else if (botao.dataset.acao === 'excluir-despesa') {
                registro.despesas = registro.despesas.filter(function (d) { return d.id !== id; });
                if (editandoDespesa === id) cancelarEdicaoDespesa();
                atualizarTudo();
            }
        }

        formularioPedagio.addEventListener('submit', aoSalvarPedagio);
        formularioDespesa.addEventListener('submit', aoSalvarDespesa);
        campos.pedagio.cancelar.addEventListener('click', cancelarEdicaoPedagio);
        campos.despesa.cancelar.addEventListener('click', cancelarEdicaoDespesa);
        campos.pedagio.lista.addEventListener('click', aoClicarPedagio);
        campos.despesa.lista.addEventListener('click', aoClicarDespesa);

        carregar();
        if (!campos.despesa.data.value) {
            const util = api();
            campos.despesa.data.value = typeof util.dataAtual === 'function'
                ? util.dataAtual()
                : new Date().toLocaleDateString('sv-SE');
        }
        renderizarPedagios();
        renderizarDespesas();
        atualizarTotais();
    });
})();
