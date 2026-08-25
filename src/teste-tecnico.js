require('dotenv').config();

const {
    iniciarSessaoGLPI,
    encerrarSessaoGLPI,
    buscarChamados,
    enriquecerTecnicos
} = require('./glpi');


async function teste() {

    let sessao = null;


    try {

        console.log('====================================');
        console.log(' TESTE TÉCNICO RESPONSÁVEL');
        console.log('====================================');


        /* ---------------------------------------------
         * 1. SESSÃO
         * --------------------------------------------- */

        sessao =
            await iniciarSessaoGLPI();


        /* ---------------------------------------------
         * 2. BUSCAR APENAS 10 CHAMADOS
         * --------------------------------------------- */

        const resposta =
            await buscarChamados(
                sessao,
                '2026-01-01 00:00:00',
                '2027-01-01 00:00:00',
                0,
                10
            );


        let chamados =
            resposta.data;


        console.log('');
        console.log(
            `Chamados recebidos: ${chamados.length}`
        );


        /* ---------------------------------------------
         * 3. CONVERTER IDS EM NOMES
         * --------------------------------------------- */

        chamados =
            await enriquecerTecnicos(
                sessao,
                chamados
            );


        /* ---------------------------------------------
         * 4. MOSTRAR RESULTADO
         * --------------------------------------------- */

        console.log('');
        console.log('====================================');
        console.log(' RESULTADO');
        console.log('====================================');


        chamados.forEach(
            chamado => {

                console.log('');

                console.log(
                    'GLPI:',
                    chamado['2']
                );

                console.log(
                    'Técnico:',
                    chamado['5']
                );

                console.log(
                    'Data:',
                    chamado['15']
                );

            }
        );


        console.log('');
        console.log('✓ TESTE CONCLUÍDO.');

    }

    catch (erro) {

        console.error('');
        console.error('====================================');
        console.error(' ERRO');
        console.error('====================================');

        console.error(
            erro
        );

    }

    finally {

        if (sessao) {

            try {

                await encerrarSessaoGLPI(
                    sessao
                );

            }

            catch (erro) {

                console.error(
                    erro.message
                );

            }

        }

    }

}


teste();