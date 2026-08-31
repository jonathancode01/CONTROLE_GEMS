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

async function buscarTodosChamados(sessao) {

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

        if (total === null) {

            total =
                Number(
                    resposta.totalcount || 0
                );
        }

        todos.push(
            ...registros
        );

        console.log(
            `→ Recebidos: ${registros.length}`
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
 * DEDUPLICAR CHAMADOS DO GLPI
 *
 * Garante:
 *
 * 1 GLPI = 1 objeto
 *
 * Caso a API retorne o mesmo chamado duas vezes,
 * somente uma ocorrência será processada.
 * ============================================================ */

function deduplicarChamados(chamados) {

    const mapa =
        new Map();

    for (
        const chamado of chamados
    ) {

        const numeroGlpi =
            String(
                chamado?.['2'] ||
                chamado?.id ||
                ''
            ).trim();

        if (!numeroGlpi) {
            continue;
        }

        if (
            !mapa.has(numeroGlpi)
        ) {

            mapa.set(
                numeroGlpi,
                chamado
            );
        }
    }

    return Array.from(
        mapa.values()
    );
}


/* ============================================================
 * PRESERVAR DATA EXISTENTE
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

    const dataBR =
        dataExistente.match(
            /^(\d{2})\/(\d{2})\/(\d{4})/
        );

    if (dataBR) {

        linha[0] =
            `${dataBR[1]}/${dataBR[2]}/${dataBR[3]}`;

        return linha;
    }

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
 * CRIAR MAPA DA PLANILHA
 *
 * Também detecta duplicados existentes.
 *
 * O primeiro registro encontrado será mantido.
 * Os demais serão removidos.
 * ============================================================ */

function criarMapaPlanilha(
    dadosPlanilha
) {

    const mapa =
        new Map();

    const duplicados =
        [];

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

            const numeroLinha =
                indice + 1;

            if (
                mapa.has(numeroGlpi)
            ) {

                duplicados.push(
                    numeroLinha
                );

                console.log(
                    `⚠ Duplicado encontrado: GLPI ${numeroGlpi} na linha ${numeroLinha}`
                );

                return;
            }

            mapa.set(
                numeroGlpi,
                {
                    linha:
                        numeroLinha,

                    dados:
                        linha
                }
            );
        }
    );

    return {
        mapa,
        duplicados
    };
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
            `✓ Registros encontrados: ${dadosPlanilha.length}`
        );

        console.log('');


        /* ====================================================
         * 3. MAPEAR PLANILHA
         * ==================================================== */

        const resultadoMapa =
            criarMapaPlanilha(
                dadosPlanilha
            );

        const mapaPlanilha =
            resultadoMapa.mapa;

        const duplicadosPlanilha =
            resultadoMapa.duplicados;

        console.log(
            `✓ Chamados únicos na planilha: ${mapaPlanilha.size}`
        );

        console.log(
            `⚠ Linhas duplicadas encontradas: ${duplicadosPlanilha.length}`
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
         * 4.1. DEDUPLICAR RETORNO DO GLPI
         * ==================================================== */

        const quantidadeAntes =
            chamados.length;

        chamados =
            deduplicarChamados(
                chamados
            );

        const quantidadeDepois =
            chamados.length;

        console.log(
            `✓ Chamados únicos após deduplicação: ${quantidadeDepois}`
        );

        console.log(
            `⚠ Duplicados removidos do retorno do GLPI: ${quantidadeAntes - quantidadeDepois}`
        );

        console.log('');


        /* ====================================================
         * 4.2. IDENTIFICAR TÉCNICOS
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
         * 5. PROCESSAMENTO
         * ==================================================== */

        const novos =
            [];

        const atualizados =
            [];

        const linhasParaRemover =
            [];


        let ignoradosSemTecnico =
            0;

        let removidosSemTecnico =
            0;


        /*
         * Controle para impedir que um mesmo GLPI
         * seja colocado duas vezes em "novos".
         */

        const novosGlpis =
            new Set();


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
                         * Novo sem técnico:
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


                        /*
                         * Proteção adicional contra duplicação.
                         */

                        if (
                            novosGlpis.has(
                                numeroGlpi
                            )
                        ) {

                            console.log(
                                `⚠ Chamado ${numeroGlpi} já está na fila de novos. Ignorando duplicação.`
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

                            novosGlpis.add(
                                numeroGlpi
                            );
                        }

                        return;
                    }


                    /* ========================================
                     * CHAMADO EXISTENTE SEM TÉCNICO
                     * ======================================== */

                    /*
                     * Se o chamado já existe e o GLPI
                     * não possui técnico, removemos da planilha
                     * independentemente do status.
                     *
                     * Isso é importante para o seu caso do Igo.
                     */

                    if (!temTecnico) {

                        linhasParaRemover.push(
                            existente.linha
                        );

                        removidosSemTecnico++;

                        console.log(
                            `🗑 Chamado ${numeroGlpi} será removido: sem técnico no GLPI.`
                        );

                        return;
                    }


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
                     * Preservar data histórica.
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
         * 5.1. REMOVER DUPLICADOS DA PLANILHA
         * ==================================================== */

        /*
         * Os duplicados históricos também serão removidos.
         */

        duplicadosPlanilha.forEach(
            linha => {

                if (
                    !linhasParaRemover.includes(
                        linha
                    )
                ) {

                    linhasParaRemover.push(
                        linha
                    );
                }
            }
        );


        /* ====================================================
         * RESUMO
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
            `Linhas para remover: ${linhasParaRemover.length}`
        );

        console.log(
            `Duplicados históricos encontrados: ${duplicadosPlanilha.length}`
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
         * 8. REMOVER
         * ==================================================== */

        console.log(
            '6. Removendo chamados sem técnico e duplicados...'
        );

        if (
            linhasParaRemover.length > 0
        ) {

            await removerLinhasBatch(
                linhasParaRemover
            );

            console.log(
                `✓ ${linhasParaRemover.length} linhas removidas.`
            );

        }
        else {

            console.log(
                '✓ Nenhuma linha para remover.'
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
            `Linhas removidas: ${linhasParaRemover.length}`
        );

        console.log(
            `Duplicados históricos: ${duplicadosPlanilha.length}`
        );

        console.log(
            `Total recebido do GLPI: ${quantidadeAntes}`
        );

        console.log(
            `Total único processado: ${quantidadeDepois}`
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