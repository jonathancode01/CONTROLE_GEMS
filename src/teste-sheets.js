require('dotenv').config();

const {
    obterDadosPlanilha
} = require('./google-sheets');


async function testar() {

    console.log('');
    console.log('====================================');
    console.log(' TESTE GOOGLE SHEETS');
    console.log('====================================');
    console.log('');

    try {

        const dados =
            await obterDadosPlanilha();

        console.log(
            `✓ Conexão realizada com sucesso.`
        );

        console.log(
            `✓ Registros encontrados: ${dados.length}`
        );

        console.log('');

        if (dados.length > 0) {

            console.log('Primeira linha:');

            console.log(
                dados[0]
            );

        }

        console.log('');

        console.log('====================================');
        console.log(' TESTE CONCLUÍDO');
        console.log('====================================');

    }

    catch (erro) {

        console.error('');

        console.error(
            'Erro ao conectar com Google Sheets:'
        );

        console.error(
            erro.message
        );

    }

}


testar();