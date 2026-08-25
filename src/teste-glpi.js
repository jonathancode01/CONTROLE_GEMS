require('dotenv').config();

const {
    iniciarSessaoGLPI,
    encerrarSessaoGLPI,
    buscarChamados
} = require('./glpi');

async function teste() {

    console.log('====================================');
    console.log(' TESTE GLPI');
    console.log('====================================');

    let sessao = null;

    try {

        console.log('');
        console.log('1. Verificando tokens...');

        console.log(
            'USER TOKEN:',
            process.env.GLPI_USER_TOKEN ? 'OK' : 'NÃO ENCONTRADO'
        );

        console.log(
            'APP TOKEN:',
            process.env.GLPI_APP_TOKEN ? 'OK' : 'NÃO ENCONTRADO'
        );

        console.log('');
        console.log('2. Iniciando sessão GLPI...');

        sessao = await iniciarSessaoGLPI();

        console.log('✓ Sessão iniciada.');
        console.log('');

        console.log('3. Testando busca de chamados...');
        console.log('');

        const resposta = await buscarChamados(
            sessao,
            '2026-01-01 00:00:00',
            '2027-01-01 00:00:00',
            0,
            10
        );

        console.log('');
        console.log('====================================');
        console.log(' RESULTADO');
        console.log('====================================');

        console.log(
            'Total informado pelo GLPI:',
            resposta.totalcount
        );

        console.log(
            'Chamados recebidos:',
            resposta.data ? resposta.data.length : 0
        );

        console.log('');

        if (resposta.data && resposta.data.length > 0) {

            console.log('Primeiro chamado recebido:');
            console.log(
                JSON.stringify(
                    resposta.data[0],
                    null,
                    2
                )
            );

        } else {

            console.log(
                'Nenhum chamado foi retornado.'
            );

        }

        console.log('');
        console.log('✓ TESTE CONCLUÍDO.');

    }

    catch (erro) {

        console.log('');
        console.log('====================================');
        console.log(' ERRO NO TESTE GLPI');
        console.log('====================================');

        console.error(erro);

        console.log('');

    }

    finally {

        if (sessao) {

            try {

                await encerrarSessaoGLPI(sessao);

                console.log(
                    '✓ Sessão GLPI encerrada.'
                );

            }

            catch (erro) {

                console.error(
                    'Erro ao encerrar sessão:',
                    erro.message
                );

            }

        }

    }

}

teste();