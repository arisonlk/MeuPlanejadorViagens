/*
 * Meu Planejador de Viagens - funcionalidades básicas da interface.
 * Este arquivo não envia dados para servidores e não depende de bibliotecas externas.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const sidebar = document.getElementById('sidebar');
        const botaoMenu = document.getElementById('botao-menu');
        const overlay = document.getElementById('overlay');
        const linksMenu = Array.prototype.slice.call(document.querySelectorAll('.menu-link'));
        const secoes = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));

        function abrirMenu(abrir) {
            if (!sidebar || !botaoMenu || !overlay) return;
            sidebar.classList.toggle('aberto', abrir);
            overlay.hidden = !abrir;
            botaoMenu.setAttribute('aria-expanded', String(abrir));
            botaoMenu.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
        }

        if (botaoMenu) {
            botaoMenu.addEventListener('click', function () {
                abrirMenu(!sidebar.classList.contains('aberto'));
            });
        }

        if (overlay) {
            overlay.addEventListener('click', function () {
                abrirMenu(false);
            });
        }

        document.addEventListener('keydown', function (evento) {
            if (evento.key === 'Escape') abrirMenu(false);
        });

        function marcarLink(id) {
            linksMenu.forEach(function (link) {
                const ativo = link.getAttribute('href') === '#' + id;
                link.classList.toggle('ativo', ativo);
                if (ativo) link.setAttribute('aria-current', 'location');
                else link.removeAttribute('aria-current');
            });
        }

        linksMenu.forEach(function (link) {
            link.addEventListener('click', function () {
                const id = link.getAttribute('href').slice(1);
                marcarLink(id);
                abrirMenu(false);
            });
        });

        if ('IntersectionObserver' in window && secoes.length) {
            const observador = new IntersectionObserver(function (entradas) {
                entradas.forEach(function (entrada) {
                    if (entrada.isIntersecting) marcarLink(entrada.target.id);
                });
            }, { rootMargin: '-15% 0px -70% 0px' });

            secoes.forEach(function (secao) {
                observador.observe(secao);
            });
        }

        const campoAno = document.getElementById('ano');
        if (campoAno) campoAno.textContent = String(new Date().getFullYear());

        /* Utilitários e estado compartilhados com os próximos módulos do planejador. */
        window.PlanejadorViagens = {
            estado: {
                rota: null,
                combustivel: null,
                velocidade: null,
                despesas: null,
                resumo: null,
                historico: []
            },
            formatarMoeda: function (valor) {
                const numero = Number(valor);
                if (!Number.isFinite(numero)) return 'R$ 0,00';
                return new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                }).format(numero);
            },
            formatarDecimal: function (valor, casas) {
                const numero = Number(valor);
                const casasDecimais = casas === undefined ? 2 : casas;
                if (!Number.isFinite(numero)) return '0';
                return new Intl.NumberFormat('pt-BR', {
                    minimumFractionDigits: casasDecimais,
                    maximumFractionDigits: casasDecimais
                }).format(numero);
            },
            dataAtual: function () {
                const agora = new Date();
                const ano = agora.getFullYear();
                const mes = String(agora.getMonth() + 1).padStart(2, '0');
                const dia = String(agora.getDate()).padStart(2, '0');
                return ano + '-' + mes + '-' + dia;
            },
            lerLocal: function (chave, padrao) {
                try {
                    const valor = localStorage.getItem(chave);
                    return valor === null ? padrao : JSON.parse(valor);
                } catch (erro) {
                    return padrao;
                }
            },
            salvarLocal: function (chave, valor) {
                try {
                    localStorage.setItem(chave, JSON.stringify(valor));
                    return true;
                } catch (erro) {
                    return false;
                }
            },
            removerLocal: function (chave) {
                try {
                    localStorage.removeItem(chave);
                    return true;
                } catch (erro) {
                    return false;
                }
            },
            irPara: function (id) {
                const destino = document.getElementById(id);
                if (!destino) return;
                destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
                marcarLink(id);
            }
        };
    });
})();
