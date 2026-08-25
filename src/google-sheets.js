require('dotenv').config();

const {
    google
} = require('googleapis');


/* ============================================================
 * CONFIGURAÇÃO
 * ============================================================ */

const SPREADSHEET_ID =
    process.env.GOOGLE_SHEETS_ID;

const NOME_ABA =
    process.env.GOOGLE_SHEETS_ABA ||
    'GLPI';

const CLIENT_EMAIL =
    process.env.GOOGLE_CLIENT_EMAIL;

const PRIVATE_KEY =
    process.env.GOOGLE_PRIVATE_KEY;


/* ============================================================
 * VALIDAÇÃO
 * ============================================================ */

function validarConfiguracao() {

    const erros = [];

    if (!SPREADSHEET_ID) {
        erros.push(
            'GOOGLE_SHEETS_ID'
        );
    }

    if (!CLIENT_EMAIL) {
        erros.push(
            'GOOGLE_CLIENT_EMAIL'
        );
    }

    if (!PRIVATE_KEY) {
        erros.push(
            'GOOGLE_PRIVATE_KEY'
        );
    }

    if (erros.length > 0) {

        throw new Error(
            `Variáveis não configuradas no .env: ${erros.join(', ')}`
        );
    }
}


/* ============================================================
 * AUTENTICAÇÃO
 * ============================================================ */

function obterClienteGoogle() {

    validarConfiguracao();

    const privateKey =
        PRIVATE_KEY.replace(
            /\\n/g,
            '\n'
        );

    return new google.auth.GoogleAuth({

        credentials: {

            client_email:
                CLIENT_EMAIL,

            private_key:
                privateKey
        },

        scopes: [

            'https://www.googleapis.com/auth/spreadsheets'

        ]
    });
}


/* ============================================================
 * CLIENTE SHEETS
 * ============================================================ */

function obterSheets() {

    const auth =
        obterClienteGoogle();

    return google.sheets({

        version:
            'v4',

        auth
    });
}


/* ============================================================
 * OBTER INFORMAÇÕES DA ABA
 * ============================================================ */

async function obterInformacoesAba() {

    const sheets =
        obterSheets();

    const resposta =
        await sheets.spreadsheets.get({

            spreadsheetId:
                SPREADSHEET_ID,

            fields:
                'sheets.properties'
        });

    const aba =
        resposta.data.sheets.find(
            sheet =>
                sheet.properties.title ===
                NOME_ABA
        );

    if (!aba) {

        throw new Error(
            `Aba "${NOME_ABA}" não encontrada.`
        );
    }

    return aba.properties;
}


/* ============================================================
 * GARANTIR LINHAS NA GRADE
 * ============================================================ */

async function garantirLinhasGrid(
    quantidadeNecessaria
) {

    const sheets =
        obterSheets();

    const propriedades =
        await obterInformacoesAba();

    const linhasAtuais =
        Number(
            propriedades.gridProperties?.rowCount ||
            0
        );

    if (
        quantidadeNecessaria <=
        linhasAtuais
    ) {

        return;
    }

    const quantidadeAdicionar =
        quantidadeNecessaria -
        linhasAtuais;

    console.log(
        `⚙ Adicionando ${quantidadeAdicionar} linhas à grade...`
    );

    await sheets.spreadsheets.batchUpdate({

        spreadsheetId:
            SPREADSHEET_ID,

        requestBody: {

            requests: [

                {

                    appendDimension: {

                        sheetId:
                            propriedades.sheetId,

                        dimension:
                            'ROWS',

                        length:
                            quantidadeAdicionar
                    }
                }

            ]
        }
    });

    console.log(
        `✓ Grade ampliada para pelo menos ${quantidadeNecessaria} linhas.`
    );
}


/* ============================================================
 * OBTER DADOS
 * ============================================================ */

async function obterDadosPlanilha() {

    const sheets =
        obterSheets();

    console.log(
        `Lendo aba "${NOME_ABA}"...`
    );

    const resposta =
        await sheets.spreadsheets.values.get({

            spreadsheetId:
                SPREADSHEET_ID,

            range:
                `${NOME_ABA}!A:G`
        });

    return (
        resposta.data.values ||
        []
    );
}


/* ============================================================
 * ADICIONAR NOVAS LINHAS
 * ============================================================ */

async function adicionarLinhas(
    linhas
) {

    if (
        !Array.isArray(linhas) ||
        linhas.length === 0
    ) {

        console.log(
            'Nenhuma linha nova para adicionar.'
        );

        return;
    }

    const sheets =
        obterSheets();

    const dadosAtuais =
        await obterDadosPlanilha();

    /*
     * A última linha utilizada será:
     *
     * dados atuais + novas linhas
     */

    const ultimaLinhaNecessaria =
        dadosAtuais.length +
        linhas.length;

    await garantirLinhasGrid(
        ultimaLinhaNecessaria
    );

    const valores =
        linhas.map(
            linha => {

                const novaLinha =
                    Array.isArray(linha)
                        ? [...linha]
                        : [];

                while (
                    novaLinha.length < 7
                ) {

                    novaLinha.push('');
                }

                return novaLinha.slice(
                    0,
                    7
                );
            }
        );

    console.log(
        `Enviando ${valores.length} novas linhas...`
    );

    await sheets.spreadsheets.values.append({

        spreadsheetId:
            SPREADSHEET_ID,

        range:
            `${NOME_ABA}!A:G`,

        valueInputOption:
            'USER_ENTERED',

        insertDataOption:
            'INSERT_ROWS',

        requestBody: {

            values:
                valores
        }
    });

    console.log(
        `✓ ${valores.length} linhas adicionadas.`
    );
}


/* ============================================================
 * ATUALIZAR UMA LINHA
 * ============================================================ */

async function atualizarLinha(
    numeroLinha,
    dados
) {

    if (
        !numeroLinha ||
        numeroLinha < 2
    ) {

        throw new Error(
            `Número de linha inválido: ${numeroLinha}`
        );
    }

    await garantirLinhasGrid(
        Number(numeroLinha)
    );

    const sheets =
        obterSheets();

    const valores =
        Array.isArray(dados)
            ? [...dados]
            : [];

    while (
        valores.length < 7
    ) {

        valores.push('');
    }

    await sheets.spreadsheets.values.update({

        spreadsheetId:
            SPREADSHEET_ID,

        range:
            `${NOME_ABA}!A${numeroLinha}:G${numeroLinha}`,

        valueInputOption:
            'USER_ENTERED',

        requestBody: {

            values: [

                valores.slice(
                    0,
                    7
                )

            ]
        }
    });
}


/* ============================================================
 * ATUALIZAR VÁRIAS LINHAS
 * ============================================================ */

async function atualizarLinhasBatch(
    atualizacoes
) {

    if (
        !Array.isArray(atualizacoes) ||
        atualizacoes.length === 0
    ) {

        console.log(
            'Nenhuma linha para atualizar.'
        );

        return;
    }

    const sheets =
        obterSheets();

    const data = [];

    let maiorLinha =
        0;

    for (
        const item of atualizacoes
    ) {

        if (
            !item ||
            !item.linha
        ) {

            continue;
        }

        const numeroLinha =
            Number(item.linha);

        if (
            !Number.isInteger(numeroLinha) ||
            numeroLinha < 2
        ) {

            console.warn(
                `⚠ Linha inválida ignorada: ${item.linha}`
            );

            continue;
        }

        maiorLinha =
            Math.max(
                maiorLinha,
                numeroLinha
            );

        const valores =
            Array.isArray(
                item.dadosNovos
            )
                ? [...item.dadosNovos]
                : [];

        while (
            valores.length < 7
        ) {

            valores.push('');
        }

        data.push({

            range:
                `${NOME_ABA}!A${numeroLinha}:G${numeroLinha}`,

            values: [

                valores.slice(
                    0,
                    7
                )

            ]
        });
    }

    if (
        data.length === 0
    ) {

        console.log(
            'Nenhuma atualização válida.'
        );

        return;
    }

    await garantirLinhasGrid(
        maiorLinha
    );

    console.log(
        `Enviando ${data.length} atualizações em lote...`
    );

    await sheets.spreadsheets.values.batchUpdate({

        spreadsheetId:
            SPREADSHEET_ID,

        requestBody: {

            valueInputOption:
                'USER_ENTERED',

            data
        }
    });

    console.log(
        `✓ ${data.length} linhas atualizadas.`
    );
}


/* ============================================================
 * ATUALIZAR CAMPOS ESPECÍFICOS
 * ============================================================ */

async function atualizarCamposBatch(
    atualizacoes
) {

    if (
        !Array.isArray(atualizacoes) ||
        atualizacoes.length === 0
    ) {

        return;
    }

    const sheets =
        obterSheets();

    const data = [];

    let maiorLinha =
        0;

    for (
        const item of atualizacoes
    ) {

        if (
            !item ||
            !item.linha
        ) {

            continue;
        }

        const linha =
            Number(item.linha);

        if (
            !Number.isInteger(linha) ||
            linha < 2
        ) {

            continue;
        }

        maiorLinha =
            Math.max(
                maiorLinha,
                linha
            );

        data.push({

            range:
                `${NOME_ABA}!E${linha}:G${linha}`,

            values: [

                [

                    item.tecnico ?? '',

                    item.status ?? '',

                    item.observacao ?? ''

                ]

            ]
        });
    }

    if (
        data.length === 0
    ) {

        return;
    }

    await garantirLinhasGrid(
        maiorLinha
    );

    await sheets.spreadsheets.values.batchUpdate({

        spreadsheetId:
            SPREADSHEET_ID,

        requestBody: {

            valueInputOption:
                'USER_ENTERED',

            data
        }
    });
}


/* ============================================================
 * REMOVER VÁRIAS LINHAS
 *
 * SEMPRE DA MAIOR PARA A MENOR.
 * ============================================================ */

async function removerLinhasBatch(
    linhas
) {

    if (
        !Array.isArray(linhas) ||
        linhas.length === 0
    ) {

        console.log(
            'Nenhuma linha para remover.'
        );

        return;
    }

    const sheets =
        obterSheets();

    const propriedades =
        await obterInformacoesAba();

    const sheetId =
        propriedades.sheetId;

    const linhasValidas =
        [...new Set(

            linhas

                .map(
                    linha =>
                        Number(linha)
                )

                .filter(
                    linha =>
                        Number.isInteger(linha) &&
                        linha >= 2
                )

        )]

        .sort(
            (a, b) =>
                b - a
        );

    if (
        linhasValidas.length === 0
    ) {

        return;
    }

    console.log(
        `Removendo ${linhasValidas.length} linhas...`
    );

    const requests =
        linhasValidas.map(
            linha => ({

                deleteDimension: {

                    range: {

                        sheetId:
                            sheetId,

                        dimension:
                            'ROWS',

                        startIndex:
                            linha - 1,

                        endIndex:
                            linha
                    }
                }
            })
        );

    await sheets.spreadsheets.batchUpdate({

        spreadsheetId:
            SPREADSHEET_ID,

        requestBody: {

            requests
        }
    });

    console.log(
        `✓ ${linhasValidas.length} linhas removidas.`
    );
}


/* ============================================================
 * FORMATAR STATUS
 *
 * SOMENTE A COLUNA F RECEBE COR.
 * ============================================================ */

async function formatarStatus() {

    const sheets =
        obterSheets();

    const propriedades =
        await obterInformacoesAba();

    const sheetId =
        propriedades.sheetId;

    const dados =
        await obterDadosPlanilha();

    const quantidadeLinhas =
        dados.length;

    if (
        quantidadeLinhas < 2
    ) {

        return;
    }

    /*
     * Buscar regras existentes.
     */

    const planilha =
        await sheets.spreadsheets.get({

            spreadsheetId:
                SPREADSHEET_ID,

            fields:
                'sheets(properties,conditionalFormats)'
        });

    const aba =
        planilha.data.sheets.find(
            sheet =>
                sheet.properties.title ===
                NOME_ABA
        );

    const regrasExistentes =
        aba?.conditionalFormats || [];

    const requests = [];

    /*
     * Apagar regras condicionais existentes
     * da aba, evitando duplicação a cada execução.
     */

    for (
        let i =
            regrasExistentes.length - 1;
        i >= 0;
        i--
    ) {

        requests.push({

            deleteConditionalFormatRule: {

                sheetId:
                    sheetId,

                index:
                    i
            }
        });
    }

    /*
     * PENDENTE
     */

    requests.push({

        addConditionalFormatRule: {

            rule: {

                ranges: [

                    {

                        sheetId:
                            sheetId,

                        startRowIndex:
                            1,

                        endRowIndex:
                            quantidadeLinhas,

                        startColumnIndex:
                            5,

                        endColumnIndex:
                            6
                    }

                ],

                booleanRule: {

                    condition: {

                        type:
                            'TEXT_EQ',

                        values: [

                            {

                                userEnteredValue:
                                    'PENDENTE'
                            }

                        ]
                    },

                    format: {

                        backgroundColor: {

                            red:
                                1,

                            green:
                                0.8,

                            blue:
                                0.8
                        },

                        textFormat: {

                            bold:
                                true
                        }
                    }
                }
            },

            index:
                0
        }
    });

    /*
     * EM EXECUÇÃO
     */

    requests.push({

        addConditionalFormatRule: {

            rule: {

                ranges: [

                    {

                        sheetId:
                            sheetId,

                        startRowIndex:
                            1,

                        endRowIndex:
                            quantidadeLinhas,

                        startColumnIndex:
                            5,

                        endColumnIndex:
                            6
                    }

                ],

                booleanRule: {

                    condition: {

                        type:
                            'TEXT_EQ',

                        values: [

                            {

                                userEnteredValue:
                                    'EM EXECUÇÃO'
                            }

                        ]
                    },

                    format: {

                        backgroundColor: {

                            red:
                                1,

                            green:
                                0.9,

                            blue:
                                0.6
                        },

                        textFormat: {

                            bold:
                                true
                        }
                    }
                }
            },

            index:
                0
        }
    });

    /*
     * CONCLUIDO
     */

    requests.push({

        addConditionalFormatRule: {

            rule: {

                ranges: [

                    {

                        sheetId:
                            sheetId,

                        startRowIndex:
                            1,

                        endRowIndex:
                            quantidadeLinhas,

                        startColumnIndex:
                            5,

                        endColumnIndex:
                            6
                    }

                ],

                booleanRule: {

                    condition: {

                        type:
                            'TEXT_EQ',

                        values: [

                            {

                                userEnteredValue:
                                    'CONCLUIDO'
                            }

                        ]
                    },

                    format: {

                        backgroundColor: {

                            red:
                                0.75,

                            green:
                                0.9,

                            blue:
                                0.75
                        },

                        textFormat: {

                            bold:
                                true
                        }
                    }
                }
            },

            index:
                0
        }
    });

    await sheets.spreadsheets.batchUpdate({

        spreadsheetId:
            SPREADSHEET_ID,

        requestBody: {

            requests
        }
    });

    console.log(
        '✓ Cores dos status atualizadas.'
    );
}


/* ============================================================
 * LIMPAR DADOS
 * ============================================================ */

async function limparDados() {

    const sheets =
        obterSheets();

    await sheets.spreadsheets.values.clear({

        spreadsheetId:
            SPREADSHEET_ID,

        range:
            `${NOME_ABA}!A2:G`
    });

    console.log(
        '✓ Dados removidos. Cabeçalho preservado.'
    );
}


/* ============================================================
 * TESTAR CONEXÃO
 * ============================================================ */

async function testarConexao() {

    try {

        const dados =
            await obterDadosPlanilha();

        return {

            sucesso:
                true,

            quantidade:
                dados.length
        };

    }
    catch (erro) {

        return {

            sucesso:
                false,

            quantidade:
                0,

            erro:
                erro.message
        };
    }
}


/* ============================================================
 * EXPORTAÇÕES
 * ============================================================ */

module.exports = {

    obterDadosPlanilha,

    adicionarLinhas,

    atualizarLinha,

    atualizarLinhasBatch,

    atualizarCamposBatch,

    removerLinhasBatch,

    formatarStatus,

    limparDados,

    testarConexao

};