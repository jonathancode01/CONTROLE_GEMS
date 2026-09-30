require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
});

const {
    iniciarSessaoGLPI,
    encerrarSessaoGLPI,
    buscarChamadoPorId,
    enriquecerTecnicos
} = require('./glpi');

const {
    tratarChamado
} = require('./tratamento');


/* ============================================================
 * CONFIGURAÇÃO
 * ============================================================ */

const CHAMADO_TESTE = '103093';


/* ============================================================
 * EXECUTAR TESTE
 * ============================================================ */

async function executar() {

    let sessao = null;

    try {

        console.log('');
        console.log(
            '=============================================='
        );
        console.log(
            ' TESTE DE CLASSIFICAÇÃO GERENCIAL'
        );
        console.log(
            '=============================================='
        );
        console.log('');

        sessao =
            await iniciarSessaoGLPI();


        /* ====================================================
         * BUSCAR CHAMADO
         * ==================================================== */

        console.log(
            `Buscando chamado ${CHAMADO_TESTE}...`
        );

        const chamado =
            await buscarChamadoPorId(
                sessao,
                CHAMADO_TESTE
            );

        if (!chamado) {

            throw new Error(
                `Chamado ${CHAMADO_TESTE} não encontrado.`
            );
        }

        console.log(
            'Chamado encontrado.'
        );


        /* ====================================================
         * ENRIQUECER
         * ==================================================== */

        await enriquecerTecnicos(
            sessao,
            [chamado]
        );


        /* ====================================================
         * TRATAR
         * ==================================================== */

        const tratado =
            tratarChamado(
                chamado
            );


        /* ====================================================
         * RESULTADO
         * ==================================================== */

        console.log('');
        console.log(
            '=============================================='
        );
        console.log(
            ' RESULTADO'
        );
        console.log(
            '=============================================='
        );

        console.log(
            `GLPI:              ${tratado.glpi}`
        );

        console.log(
            `Técnico:           ${tratado.tecnicoResponsavel}`
        );

        console.log(
            `Técnico ID:        ${chamado.tecnicoId || 'NÃO IDENTIFICADO'}`
        );

        console.log(
            `Data atribuição:   ${chamado.dataAtribuicao || 'NÃO IDENTIFICADA'}`
        );

        console.log(
            `Atribuição hoje:   ${
                chamado.atribuicaoHoje
                    ? 'SIM'
                    : 'NÃO'
            }`
        );

        console.log(
            `Devolutivas:       ${
                Array.isArray(chamado.devolutivas)
                    ? chamado.devolutivas.length
                    : 0
            }`
        );

        console.log(
            `Status GLPI:       ${chamado['12']}`
        );

        console.log(
            `Status gerencial:  ${tratado.status}`
        );

        console.log(
            '=============================================='
        );


        /* ====================================================
         * DEVOLUTIVAS
         * ==================================================== */

        if (
            Array.isArray(chamado.devolutivas) &&
            chamado.devolutivas.length > 0
        ) {

            console.log('');
            console.log(
                'DEVOLUTIVAS ENCONTRADAS:'
            );

            chamado.devolutivas.forEach(
                (devolutiva, index) => {

                    console.log('');

                    console.log(
                        `Devolutiva ${index + 1}:`
                    );

                    console.log(
                        `Data: ${
                            devolutiva.date ||
                            devolutiva.date_creation ||
                            ''
                        }`
                    );

                    console.log(
                        `Usuário ID: ${
                            devolutiva.users_id || ''
                        }`
                    );

                    console.log(
                        `ID: ${
                            devolutiva.id || ''
                        }`
                    );
                }
            );
        }

    }
    catch (erro) {

        console.error('');

        console.error(
            'ERRO NO TESTE:',
            erro.message
        );

    }
    finally {

        await encerrarSessaoGLPI(
            sessao
        );
    }
}


/* ============================================================
 * EXECUTAR
 * ============================================================ */

executar();
