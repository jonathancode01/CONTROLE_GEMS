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

        const ticketId = 101798;

        const url =
            `${GLPI_URL_BASE}/Ticket/${ticketId}/Ticket_User/`;

        console.log('');
        console.log('====================================');
        console.log(' TÉCNICOS DO CHAMADO');
        console.log(` GLPI: ${ticketId}`);
        console.log('====================================');
        console.log('');
        console.log(`URL: ${url}`);
        console.log('');

        const resposta =
            await fetch(
                url,
                {
                    method: 'GET',

                    headers: {

                        'Session-Token':
                            sessao.sessionToken,

                        'App-Token':
                            sessao.appToken

                    }
                }
            );


        if (!resposta.ok) {

            const texto =
                await resposta.text();

            throw new Error(
                `HTTP ${resposta.status}: ${texto}`
            );

        }


        const dados =
            await resposta.json();


        console.dir(
            dados,
            {
                depth: null
            }
        );


    }
    catch (erro) {

        console.error('');
        console.error(
            'ERRO:',
            erro.message
        );

    }
    finally {

        if (sessao) {

            await encerrarSessaoGLPI(
                sessao
            );

        }

    }

}


executar();