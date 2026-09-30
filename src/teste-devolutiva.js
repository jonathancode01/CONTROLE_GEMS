const path = require('path');

require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

/* ============================================================
 * CONFIGURAÇÕES
 * ============================================================ */

const GLPI_URL_BASE =
    process.env.GLPI_URL_BASE ||
    'https://servicosti.seduc.am.gov.br/apirest.php';

const GLPI_ID = '103061';

/* ============================================================
 * HEADERS
 * ============================================================ */

function criarHeaders(sessionToken, appToken) {
    return {
        'Session-Token': sessionToken,
        'App-Token': appToken
    };
}

/* ============================================================
 * CONSULTAR ENDPOINT
 * ============================================================ */

async function consultarEndpoint(
    sessao,
    endpoint
) {

    const url =
        `${GLPI_URL_BASE}/${endpoint}`;

    console.log('');
    console.log('============================================================');
    console.log(`CONSULTANDO: ${url}`);
    console.log('============================================================');

    try {

        const resposta =
            await fetch(
                url,
                {
                    method: 'GET',
                    headers: criarHeaders(
                        sessao.sessionToken,
                        sessao.appToken
                    )
                }
            );

        const texto =
            await resposta.text();

        console.log(
            `HTTP STATUS: ${resposta.status}`
        );

        if (!resposta.ok) {

            console.log('');
            console.log('ERRO RETORNADO PELO GLPI:');
            console.log(texto);

            return null;
        }

        try {

            return JSON.parse(texto);

        }
        catch (erro) {

            console.log('');
            console.log('RESPOSTA NÃO É JSON:');
            console.log(texto);

            return texto;
        }

    }
    catch (erro) {

        console.error(
            `Erro consultando ${endpoint}:`,
            erro.message
        );

        return null;
    }
}


/* ============================================================
 * INICIAR SESSÃO
 * ============================================================ */

async function iniciarSessao() {

    console.log('');
    console.log('============================================================');
    console.log('INICIANDO SESSÃO NO GLPI');
    console.log('============================================================');

    const userToken =
        process.env.GLPI_USER_TOKEN;

    const appToken =
        process.env.GLPI_APP_TOKEN;

    if (!userToken) {

        throw new Error(
            'GLPI_USER_TOKEN não configurado no .env'
        );
    }

    if (!appToken) {

        throw new Error(
            'GLPI_APP_TOKEN não configurado no .env'
        );
    }

    const resposta =
        await fetch(
            `${GLPI_URL_BASE}/initSession`,
            {
                method: 'GET',

                headers: {
                    Authorization:
                        `user_token ${userToken}`,

                    'App-Token':
                        appToken
                }
            }
        );

    if (!resposta.ok) {

        const texto =
            await resposta.text();

        throw new Error(
            `Erro ao iniciar sessão. HTTP ${resposta.status}: ${texto}`
        );
    }

    const dados =
        await resposta.json();

    if (!dados.session_token) {

        throw new Error(
            'GLPI não retornou session_token.'
        );
    }

    console.log('✓ Sessão iniciada.');

    return {
        sessionToken:
            dados.session_token,

        appToken
    };
}


/* ============================================================
 * ENCERRAR SESSÃO
 * ============================================================ */

async function encerrarSessao(sessao) {

    if (!sessao) {
        return;
    }

    console.log('');
    console.log('============================================================');
    console.log('ENCERRANDO SESSÃO');
    console.log('============================================================');

    try {

        const resposta =
            await fetch(
                `${GLPI_URL_BASE}/killSession`,
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

        if (resposta.ok) {

            console.log('✓ Sessão encerrada.');

        }
        else {

            console.log(
                `⚠ Não foi possível encerrar a sessão. HTTP ${resposta.status}`
            );
        }

    }
    catch (erro) {

        console.error(
            'Erro ao encerrar sessão:',
            erro.message
        );
    }
}


/* ============================================================
 * EXIBIR JSON FORMATADO
 * ============================================================ */

function exibirJSON(titulo, dados) {

    console.log('');
    console.log('############################################################');
    console.log(`# ${titulo}`);
    console.log('############################################################');

    if (
        dados === null ||
        dados === undefined
    ) {

        console.log('NULL / SEM DADOS');

        return;
    }

    try {

        console.log(
            JSON.stringify(
                dados,
                null,
                2
            )
        );

    }
    catch (erro) {

        console.log(dados);
    }
}


/* ============================================================
 * ANALISAR FOLLOWUPS
 * ============================================================ */

function analisarFollowups(followups) {

    console.log('');
    console.log('############################################################');
    console.log('# ANÁLISE DAS DEVOLUTIVAS');
    console.log('############################################################');

    if (!Array.isArray(followups)) {

        console.log(
            '⚠ O retorno de TicketFollowup não é um array.'
        );

        return;
    }

    console.log(
        `Quantidade de followups encontrados: ${followups.length}`
    );

    if (followups.length === 0) {

        console.log(
            '⚠ Nenhuma devolutiva encontrada.'
        );

        return;
    }

    followups.forEach(
        (followup, indice) => {

            console.log('');
            console.log(
                `---------------- FOLLOWUP ${indice + 1} ----------------`
            );

            console.log(
                'ID:',
                followup.id || ''
            );

            console.log(
                'Data:',
                followup.date || ''
            );

            console.log(
                'Data de modificação:',
                followup.date_mod || ''
            );

            console.log(
                'Usuário ID:',
                followup.users_id || ''
            );

            console.log(
                'Conteúdo:',
                followup.content || ''
            );

            console.log(
                'Privado:',
                followup.is_private !== undefined
                    ? followup.is_private
                    : ''
            );

            console.log(
                '--------------------------------------------------------'
            );
        }
    );
}


/* ============================================================
 * ANALISAR TICKET_USER
 * ============================================================ */

function analisarTicketUsers(ticketUsers) {

    console.log('');
    console.log('############################################################');
    console.log('# ANÁLISE DOS USUÁRIOS DO CHAMADO');
    console.log('############################################################');

    if (!Array.isArray(ticketUsers)) {

        console.log(
            '⚠ O retorno de Ticket_User não é um array.'
        );

        return;
    }

    console.log(
        `Quantidade de registros Ticket_User: ${ticketUsers.length}`
    );

    if (ticketUsers.length === 0) {

        console.log(
            '⚠ Nenhum usuário relacionado encontrado.'
        );

        return;
    }

    ticketUsers.forEach(
        (usuario, indice) => {

            console.log('');
            console.log(
                `---------------- USUÁRIO ${indice + 1} ----------------`
            );

            console.log(
                'ID:',
                usuario.id || ''
            );

            console.log(
                'Users ID:',
                usuario.users_id || ''
            );

            console.log(
                'Type:',
                usuario.type || ''
            );

            console.log(
                'TypeName:',
                usuario.type_name || ''
            );

            console.log(
                'Alternative Email:',
                usuario.alternative_email || ''
            );

            console.log(
                '--------------------------------------------------------'
            );
        }
    );
}


/* ============================================================
 * ANALISAR LOG
 * ============================================================ */

function analisarLogs(logs) {

    console.log('');
    console.log('############################################################');
    console.log('# ANÁLISE DO HISTÓRICO / LOG');
    console.log('############################################################');

    if (!Array.isArray(logs)) {

        console.log(
            '⚠ O retorno do Log não é um array.'
        );

        return;
    }

    console.log(
        `Quantidade de registros no histórico: ${logs.length}`
    );

    if (logs.length === 0) {

        console.log(
            '⚠ Nenhum registro de histórico encontrado.'
        );

        return;
    }

    logs.forEach(
        (log, indice) => {

            console.log('');
            console.log(
                `---------------- LOG ${indice + 1} ----------------`
            );

            console.log(
                'ID:',
                log.id || ''
            );

            console.log(
                'Data:',
                log.date_mod || log.date || ''
            );

            console.log(
                'Usuário:',
                log.users_id || ''
            );

            console.log(
                'Item:',
                log.itemtype || ''
            );

            console.log(
                'Item ID:',
                log.items_id || ''
            );

            console.log(
                'Campo:',
                log.id_search_option || ''
            );

            console.log(
                'Valor antigo:',
                log.old_value || ''
            );

            console.log(
                'Valor novo:',
                log.new_value || ''
            );

            console.log(
                '--------------------------------------------------------'
            );
        }
    );
}


/* ============================================================
 * EXECUÇÃO PRINCIPAL
 * ============================================================ */

async function executar() {

    let sessao = null;

    try {

        console.log('');
        console.log('============================================================');
        console.log(' TESTE DE DEVOLUTIVA / ATRIBUIÇÃO GLPI');
        console.log('============================================================');

        console.log(
            `Chamado analisado: ${GLPI_ID}`
        );

        sessao =
            await iniciarSessao();


        /* ====================================================
         * 1. TICKET
         * ==================================================== */

        const chamado =
            await consultarEndpoint(
                sessao,
                `Ticket/${GLPI_ID}`
            );

        exibirJSON(
            'DADOS PRINCIPAIS DO CHAMADO',
            chamado
        );


        /* ====================================================
         * 2. TICKET_USER
         * ==================================================== */

        const ticketUsers =
            await consultarEndpoint(
                sessao,
                `Ticket/${GLPI_ID}/Ticket_User/`
            );

        exibirJSON(
            'TICKET_USER - DADOS BRUTOS',
            ticketUsers
        );

        analisarTicketUsers(
            ticketUsers
        );


        /* ====================================================
         * 3. FOLLOWUPS / DEVOLUTIVAS
         * ==================================================== */

        const followups =
            await consultarEndpoint(
                sessao,
                `Ticket/${GLPI_ID}/TicketFollowup/`
            );

        exibirJSON(
            'TICKETFOLLOWUP - DADOS BRUTOS',
            followups
        );

        analisarFollowups(
            followups
        );


        /* ====================================================
         * 4. LOG / HISTÓRICO
         * ==================================================== */

        const logs =
            await consultarEndpoint(
                sessao,
                `Ticket/${GLPI_ID}/Log/`
            );

        exibirJSON(
            'LOG - DADOS BRUTOS',
            logs
        );

        analisarLogs(
            logs
        );


        /* ====================================================
         * 5. RESUMO
         * ==================================================== */

        console.log('');
        console.log('============================================================');
        console.log(' RESUMO DO TESTE');
        console.log('============================================================');

        console.log(
            `Chamado: ${GLPI_ID}`
        );

        console.log(
            `Status GLPI: ${
                chamado
                    ? chamado.status || chamado['12'] || 'NÃO IDENTIFICADO'
                    : 'NÃO ENCONTRADO'
            }`
        );

        console.log(
            `Técnico no campo 5: ${
                chamado
                    ? JSON.stringify(
                        chamado['5'] || ''
                    )
                    : ''
            }`
        );

        console.log(
            `Ticket_User encontrados: ${
                Array.isArray(ticketUsers)
                    ? ticketUsers.length
                    : 0
            }`
        );

        console.log(
            `Followups encontrados: ${
                Array.isArray(followups)
                    ? followups.length
                    : 0
            }`
        );

        console.log(
            `Logs encontrados: ${
                Array.isArray(logs)
                    ? logs.length
                    : 0
            }`
        );

        console.log('');
        console.log('============================================================');
        console.log(' FIM DO TESTE');
        console.log('============================================================');
    }

    catch (erro) {

        console.error('');
        console.error('============================================================');
        console.error(' ERRO NO TESTE');
        console.error('============================================================');

        console.error(
            erro.message
        );

        console.error(
            erro.stack
        );

    }

    finally {

        await encerrarSessao(
            sessao
        );
    }
}


/* ============================================================
 * INICIAR
 * ============================================================ */

executar();