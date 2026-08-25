require('dotenv').config();

const {
    iniciarSessaoGLPI,
    encerrarSessaoGLPI,
    GLPI_URL_BASE
} = require('./glpi');

async function executar() {

    let sessao = null;

    try {

        sessao = await iniciarSessaoGLPI();

        const url =
            `${GLPI_URL_BASE}/Ticket/101798`;

        const resposta =
            await fetch(url, {
                method: 'GET',
                headers: {
                    'Session-Token': sessao.sessionToken,
                    'App-Token': sessao.appToken
                }
            });

        const dados = await resposta.json();

        console.log('');
        console.log('====================================');
        console.log(' CHAMADO 101798');
        console.log('====================================');
        console.log('');

        console.dir(dados, {
            depth: null
        });

    }
    catch (erro) {

        console.error(
            'ERRO:',
            erro.message
        );

    }
    finally {

        if (sessao) {
            await encerrarSessaoGLPI(sessao);
        }

    }

}

executar();