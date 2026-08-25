require('dotenv').config();

const {
    obterDadosPlanilha
} = require('./google-sheets');


async function executarAuditoria() {

    console.log('');
    console.log('====================================');
    console.log(' AUDITORIA GOOGLE SHEETS');
    console.log(' CONTROLE GEMS');
    console.log('====================================');
    console.log('');

    try {

        /* ----------------------------------------------------
         * 1. LER PLANILHA
         * ---------------------------------------------------- */

        console.log('1. Lendo dados da planilha...');

        const dados =
            await obterDadosPlanilha();

        console.log(
            `✓ Total de linhas encontradas: ${dados.length}`
        );

        console.log('');


        /* ----------------------------------------------------
         * 2. CONTADORES
         * ---------------------------------------------------- */

        let linhasComGlpi = 0;
        let linhasSemGlpi = 0;

        let linhasComData = 0;
        let linhasSemData = 0;

        let linhasComGlpiEDatas = 0;


        /* ----------------------------------------------------
         * 3. MAPA DOS GLPIS
         * ---------------------------------------------------- */

        const mapaGlpi = new Map();


        dados.forEach((linha, indice) => {

            const data =
                String(linha[0] || '').trim();

            const glpi =
                String(linha[1] || '').trim();


            /* DATA */

            if (data) {

                linhasComData++;

            } else {

                linhasSemData++;

            }


            /* GLPI */

            if (glpi) {

                linhasComGlpi++;

                if (data) {
                    linhasComGlpiEDatas++;
                }


                if (!mapaGlpi.has(glpi)) {

                    mapaGlpi.set(
                        glpi,
                        {
                            quantidade: 1,
                            linhas: [indice + 2]
                        }
                    );

                } else {

                    const item =
                        mapaGlpi.get(glpi);

                    item.quantidade++;

                    item.linhas.push(
                        indice + 2
                    );

                }

            } else {

                linhasSemGlpi++;

            }

        });


        /* ----------------------------------------------------
         * 4. IDENTIFICAR DUPLICADOS
         * ---------------------------------------------------- */

        const duplicados = [];

        mapaGlpi.forEach(
            (item, glpi) => {

                if (item.quantidade > 1) {

                    duplicados.push({

                        glpi,

                        quantidade:
                            item.quantidade,

                        linhas:
                            item.linhas

                    });

                }

            }
        );


        /* ----------------------------------------------------
         * 5. RESULTADOS
         * ---------------------------------------------------- */

        const glpisUnicos =
            mapaGlpi.size;


        let totalLinhasDuplicadas = 0;


        duplicados.forEach(item => {

            totalLinhasDuplicadas +=
                item.quantidade - 1;

        });


        console.log('====================================');
        console.log(' RESULTADO DA AUDITORIA');
        console.log('====================================');
        console.log('');

        console.log(
            `Total de linhas: ${dados.length}`
        );

        console.log(
            `Linhas com GLPI: ${linhasComGlpi}`
        );

        console.log(
            `Linhas sem GLPI: ${linhasSemGlpi}`
        );

        console.log('');

        console.log(
            `GLPIs únicos: ${glpisUnicos}`
        );

        console.log(
            `GLPIs duplicados: ${duplicados.length}`
        );

        console.log(
            `Linhas duplicadas: ${totalLinhasDuplicadas}`
        );

        console.log('');

        console.log(
            `Linhas com data: ${linhasComData}`
        );

        console.log(
            `Linhas sem data: ${linhasSemData}`
        );

        console.log('');

        console.log(
            `GLPI + data preenchidos: ${linhasComGlpiEDatas}`
        );

        console.log('');


        /* ----------------------------------------------------
         * 6. MOSTRAR DUPLICADOS
         * ---------------------------------------------------- */

        if (duplicados.length > 0) {

            console.log(
                '===================================='
            );

            console.log(
                ' CHAMADOS DUPLICADOS'
            );

            console.log(
                '===================================='
            );

            console.log('');

            /*
             * Mostrar no máximo os 30 primeiros
             * para não poluir o terminal.
             */

            duplicados
                .slice(0, 30)
                .forEach(item => {

                    console.log(
                        `GLPI ${item.glpi} → ${item.quantidade} ocorrências`
                    );

                    console.log(
                        `Linhas: ${item.linhas.join(', ')}`
                    );

                    console.log('');

                });


            if (duplicados.length > 30) {

                console.log(
                    `... e mais ${duplicados.length - 30} duplicados.`
                );

                console.log('');

            }

        }


        /* ----------------------------------------------------
         * 7. CONCLUSÃO
         * ---------------------------------------------------- */

        console.log(
            '===================================='
        );

        console.log(
            ' AUDITORIA CONCLUÍDA'
        );

        console.log(
            '===================================='
        );

    }

    catch (erro) {

        console.error('');
        console.error(
            'ERRO DURANTE A AUDITORIA:'
        );

        console.error(
            erro.message
        );

        console.error('');

    }

}


executarAuditoria();