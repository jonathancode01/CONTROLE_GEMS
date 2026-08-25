require('dotenv').config();


const {

    iniciarSessaoGLPI,

    encerrarSessaoGLPI,

    buscarChamados,

    enriquecerTecnicos

} = require('./src/glpi');


const {

    tratarChamado,

    chamadoParaLinhaSheets

} = require('./src/tratamento');


const {

    obterDadosPlanilha,

    adicionarLinhas,

    atualizarLinhasBatch,

    removerLinhasBatch,

    formatarStatus

} = require('./src/google-sheets');


/* ============================================================
 * CONFIGURAÇÕES
 * ============================================================ */

const CONFIG = {

    DATA_INICIO:
        '2026-01-01 00:00:00',

    DATA_FIM:
        '2027-01-01 00:00:00',

    TAMANHO_PAGINA:
        100

};


/* ============================================================
 * BUSCAR TODOS OS CHAMADOS
 * ============================================================ */

async function buscarTodosChamados(
    sessao
) {

    const todos = [];

    let offset = 0;

    let total = null;


    while (true) {

        console.log(
            `Buscando lote: ${offset} - ${offset + CONFIG.TAMANHO_PAGINA - 1}`
        );


        const resposta =
            await buscarChamados(

                sessao,

                CONFIG.DATA_INICIO,

                CONFIG.DATA_FIM,

                offset,

                CONFIG.TAMANHO_PAGINA

            );


        const registros =
            resposta.data || [];


        if (
            total === null
        ) {

            total =
                Number(
                    resposta.totalcount || 0
                );
        }


        todos.push(
            ...registros
        );


        console.log(
            `  → Recebidos: ${registros.length}`
        );


        if (
            registros.length === 0
        ) {

            break;
        }


        offset +=
            registros.length;


        if (
            registros.length <
            CONFIG.TAMANHO_PAGINA
        ) {

            break;
        }


        if (
            total > 0 &&
            offset >= total
        ) {

            break;
        }
    }


    return todos;
}


/* ============================================================
 * PRESERVAR DATA EXISTENTE
 *
 * Mantém a data que já está na planilha.
 *
 * Caso seja uma linha antiga no formato ISO,
 * converte para DD/MM/AAAA.
 * ============================================================ */

function preservarDataExistente(
    dadosAntigos,
    dadosNovos
) {

    const linha =
        [...dadosNovos];


    const dataExistente =
        String(
            dadosAntigos?.[0] || ''
        ).trim();


    if (!dataExistente) {

        return linha;
    }


    /*
     * Se já estiver DD/MM/AAAA,
     * mantém.
     */

    const dataBR =
        dataExistente.match(
            /^(\d{2})\/(\d{2})\/(\d{4})/
        );


    if (dataBR) {

        linha[0] =
            `${dataBR[1]}/${dataBR[2]}/${dataBR[3]}`;

        return linha;
    }


    /*
     * Converter datas antigas ISO:
     *
     * 2026-08-24T13:38:00.000Z
     *
     * ou:
     *
     * 2026-08-24 08:38:00
     */

    const dataISO =
        dataExistente.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );


    if (dataISO) {

        linha[0] =
            `${dataISO[3]}/${dataISO[2]}/${dataISO[1]}`;
    }


    return linha;
}


/* ============================================================
 * EXECUTAR
 * ============================================================ */

async function executar() {

    console.log('');

    console.log(
        '===================================='
    );

    console.log(
        ' CONTROLE GEMS - GLPI'
    );

    console.log(
        ' SINCRONIZAÇÃO NODE.JS'
    );

    console.log(
        '===================================='
    );

    console.log('');


    let sessao = null;


    try {

        /* ====================================================
         * 1. GLPI
         * ==================================================== */

        console.log(
            '1. Iniciando sessão GLPI...'
        );


        sessao =
            await iniciarSessaoGLPI();


        console.log(
            '✓ Sessão GLPI iniciada.'
        );

        console.log('');


        /* ====================================================
         * 2. GOOGLE SHEETS
         * ==================================================== */

        console.log(
            '2. Lendo dados atuais do Google Sheets...'
        );


        const dadosPlanilha =
            await obterDadosPlanilha();


        console.log(
            `✓ Registros encontrados na planilha: ${dadosPlanilha.length}`
        );

        console.log('');


        /* ====================================================
         * 3. MAPA DOS CHAMADOS
         * ==================================================== */

        const mapaPlanilha =
            new Map();


        dadosPlanilha.forEach(
            (linha, indice) => {

                /*
                 * Ignorar cabeçalho.
                 */

                if (
                    indice === 0
                ) {

                    return;
                }


                const numeroGlpi =
                    String(
                        linha[1] || ''
                    ).trim();


                if (!numeroGlpi) {

                    return;
                }


                mapaPlanilha.set(

                    numeroGlpi,

                    {

                        linha:
                            indice + 1,

                        dados:
                            linha

                    }

                );

            }
        );


        console.log(
            `✓ Mapa criado com ${mapaPlanilha.size} chamados.`
        );

        console.log('');


        /* ====================================================
         * 4. BUSCAR CHAMADOS
         * ==================================================== */

        console.log(
            '3. Buscando chamados no GLPI...'
        );


        let chamados =
            await buscarTodosChamados(
                sessao
            );


        console.log(
            `✓ Chamados recebidos do GLPI: ${chamados.length}`
        );

        console.log('');


        /* ====================================================
         * 4.1. TÉCNICOS
         * ==================================================== */

        console.log(
            '3.1. Identificando técnicos responsáveis...'
        );


        chamados =
            await enriquecerTecnicos(

                sessao,

                chamados

            );


        console.log(
            '✓ Técnicos identificados.'
        );

        console.log('');


        /* ====================================================
         * 5. PROCESSAR
         * ==================================================== */

        const novos = [];

        const atualizados = [];

        const linhasParaRemover = [];


        let ignoradosSemTecnico =
            0;

        let removidosSemTecnico =
            0;


        chamados.forEach(

            (chamado, indice) => {

                try {

                    const resultado =
                        tratarChamado(
                            chamado
                        );


                    if (!resultado) {

                        return;
                    }


                    const numeroGlpi =
                        String(
                            resultado.glpi || ''
                        ).trim();


                    if (!numeroGlpi) {

                        return;
                    }


                    const tecnico =
                        String(
                            resultado.tecnicoResponsavel || ''
                        ).trim();


                    const temTecnico =
                        tecnico !== '';


                    const existente =
                        mapaPlanilha.get(
                            numeroGlpi
                        );


                    /* ========================================
                     * NOVO CHAMADO
                     * ======================================== */

                    if (!existente) {

                        /*
                         * NOVO SEM TÉCNICO:
                         *
                         * Não entra na planilha.
                         */

                        if (!temTecnico) {

                            ignoradosSemTecnico++;

                            console.log(
                                `⏭ Chamado ${numeroGlpi} ignorado: novo e sem técnico.`
                            );

                            return;
                        }


                        const linha =
                            chamadoParaLinhaSheets(
                                resultado
                            );


                        if (linha) {

                            novos.push(
                                linha
                            );
                        }


                        return;
                    }


                    /* ========================================
                     * CHAMADO EXISTENTE
                     * ======================================== */

                    /*
                     * REGRA:
                     *
                     * Existente + sem técnico +
                     * CONCLUIDO
                     *
                     * OU
                     *
                     * Existente + sem técnico +
                     * EM EXECUÇÃO
                     *
                     * = REMOVER
                     */

                    if (
                        !temTecnico &&
                        (
                            resultado.status ===
                                'CONCLUIDO' ||

                            resultado.status ===
                                'EM EXECUÇÃO'
                        )
                    ) {

                        linhasParaRemover.push(
                            existente.linha
                        );

                        removidosSemTecnico++;

                        console.log(

                            `🗑 Chamado ${numeroGlpi} será removido: ${resultado.status} e sem técnico.`

                        );

                        return;
                    }


                    /*
                     * PENDENTE sem técnico:
                     *
                     * NÃO remove.
                     *
                     * Ele permanece na planilha.
                     */


                    /* ========================================
                     * ATUALIZAR EXISTENTE
                     * ======================================== */

                    const linha =
                        chamadoParaLinhaSheets(
                            resultado
                        );


                    if (!linha) {

                        return;
                    }


                    /*
                     * Preservar data histórica
                     * quando necessário.
                     */

                    const linhaFinal =
                        preservarDataExistente(

                            existente.dados,

                            linha

                        );


                    atualizados.push({

                        linha:
                            existente.linha,

                        dadosAntigos:
                            existente.dados,

                        dadosNovos:
                            linhaFinal,

                        resultado:
                            resultado

                    });

                }
                catch (erro) {

                    console.error(

                        `✗ Erro processando chamado ${indice + 1}:`,

                        erro.message

                    );

                }

            }

        );


        /* ====================================================
         * RESUMO DO PROCESSAMENTO
         * ==================================================== */

        console.log('');

        console.log(
            '------------------------------------'
        );

        console.log(
            `Novos chamados: ${novos.length}`
        );

        console.log(
            `Chamados existentes para atualizar: ${atualizados.length}`
        );

        console.log(
            `Novos sem técnico ignorados: ${ignoradosSemTecnico}`
        );

        console.log(
            `Existentes sem técnico para remover: ${removidosSemTecnico}`
        );

        console.log(
            '------------------------------------'
        );

        console.log('');


        /* ====================================================
         * 6. INSERIR NOVOS
         * ==================================================== */

        console.log(
            '4. Inserindo novos chamados...'
        );


        if (
            novos.length > 0
        ) {

            await adicionarLinhas(
                novos
            );

            console.log(
                `✓ ${novos.length} novos chamados inseridos.`
            );

        }
        else {

            console.log(
                '✓ Nenhum novo chamado para inserir.'
            );
        }


        console.log('');


        /* ====================================================
         * 7. ATUALIZAR EXISTENTES
         * ==================================================== */

        console.log(
            '5. Atualizando chamados existentes...'
        );


        if (
            atualizados.length > 0
        ) {

            await atualizarLinhasBatch(
                atualizados
            );

            console.log(
                `✓ ${atualizados.length} chamados atualizados.`
            );

        }
        else {

            console.log(
                '✓ Nenhum chamado existente para atualizar.'
            );
        }


        console.log('');


        /* ====================================================
         * 8. REMOVER CONCLUÍDOS / EM EXECUÇÃO SEM TÉCNICO
         * ==================================================== */

        console.log(
            '6. Removendo chamados concluídos/em execução sem técnico...'
        );


        /*
         * IMPORTANTE:
         *
         * As linhas são removidas da maior
         * para a menor dentro de removerLinhasBatch().
         *
         * Portanto a posição das demais linhas
         * não é comprometida.
         */

        if (
            linhasParaRemover.length > 0
        ) {

            await removerLinhasBatch(
                linhasParaRemover
            );

            console.log(

                `✓ ${linhasParaRemover.length} chamados removidos.`

            );

        }
        else {

            console.log(
                '✓ Nenhum chamado para remover.'
            );
        }


        console.log('');


        /* ====================================================
         * 9. FORMATAR STATUS
         * ==================================================== */

        console.log(
            '7. Atualizando cores dos status...'
        );


        await formatarStatus();


        console.log(
            '✓ Status formatados.'
        );


        console.log('');


        /* ====================================================
         * 10. FINALIZAÇÃO
         * ==================================================== */

        console.log(
            '===================================='
        );

        console.log(
            ' SINCRONIZAÇÃO CONCLUÍDA'
        );

        console.log(
            '===================================='
        );

        console.log('');

        console.log(
            `Novos inseridos: ${novos.length}`
        );

        console.log(
            `Atualizados: ${atualizados.length}`
        );

        console.log(
            `Novos sem técnico ignorados: ${ignoradosSemTecnico}`
        );

        console.log(
            `Removidos sem técnico: ${linhasParaRemover.length}`
        );

        console.log(
            `Total recebido do GLPI: ${chamados.length}`
        );

        console.log('');

    }
    catch (erro) {

        console.error('');

        console.error(
            '===================================='
        );

        console.error(
            ' ERRO NA SINCRONIZAÇÃO'
        );

        console.error(
            '===================================='
        );

        console.error('');

        console.error(
            erro.message
        );

        console.error('');

        console.error(
            erro.stack
        );

    }
    finally {

        /* ====================================================
         * ENCERRAR GLPI
         * ==================================================== */

        if (sessao) {

            try {

                await encerrarSessaoGLPI(
                    sessao
                );

                console.log(
                    '✓ Sessão GLPI encerrada.'
                );

            }
            catch (erro) {

                console.error(
                    'Erro ao encerrar sessão GLPI:',
                    erro.message
                );

            }
        }
    }
}


/* ============================================================
 * EXECUTAR
 * ============================================================ */

executar();