require('dotenv').config();

/* ============================================================
 * CONFIGURAÇÕES
 * ============================================================ */

const GLPI_URL_BASE =
    process.env.GLPI_URL_BASE ||
    'https://servicosti.seduc.am.gov.br/apirest.php';


/* ============================================================
 * CACHES
 * ============================================================ */

const cacheUsuariosGLPI = new Map();
const cacheTecnicosChamados = new Map();
const cacheTicketUsers = new Map();
const cacheTicketTasks = new Map();


/* ============================================================
 * INICIAR SESSÃO
 * ============================================================ */

async function iniciarSessaoGLPI() {

    console.log('Iniciando sessão no GLPI...');

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
            `Erro initSession. HTTP ${resposta.status}: ${texto}`
        );
    }

    const dados =
        await resposta.json();

    if (!dados.session_token) {

        throw new Error(
            'GLPI não retornou session_token.'
        );
    }

    console.log(
        'Sessão GLPI iniciada.'
    );

    return {

        sessionToken:
            dados.session_token,

        appToken:
            appToken
    };
}


/* ============================================================
 * ENCERRAR SESSÃO
 * ============================================================ */

async function encerrarSessaoGLPI(sessao) {

    if (!sessao) {
        return;
    }

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

        if (!resposta.ok) {

            const texto =
                await resposta.text();

            throw new Error(
                `HTTP ${resposta.status}: ${texto}`
            );
        }

        console.log(
            'Sessão GLPI encerrada.'
        );

    }
    catch (erro) {

        console.error(
            'Erro ao encerrar sessão GLPI:',
            erro.message
        );
    }
}


/* ============================================================
 * BUSCAR CHAMADOS
 * ============================================================ */

async function buscarChamados(
    sessao,
    dataInicio,
    dataFim,
    offset,
    tamanhoPagina
) {

    const grupoGems =
        process.env.GLPI_GRUPO_GEMS || '13';

    const inicio =
        Number(offset) || 0;

    const tamanho =
        Number(tamanhoPagina) || 100;

    const fim =
        inicio +
        tamanho -
        1;

    console.log(
        `Consultando chamados: ${inicio} até ${fim}`
    );

    const parametros = [

        `criteria[0][field]=8`,

        `criteria[0][searchtype]=equals`,

        `criteria[0][value]=${encodeURIComponent(
            grupoGems
        )}`,

        `criteria[1][link]=AND`,

        `criteria[1][field]=15`,

        `criteria[1][searchtype]=morethan`,

        `criteria[1][value]=${encodeURIComponent(
            dataInicio
        )}`,

        `criteria[2][link]=AND`,

        `criteria[2][field]=15`,

        `criteria[2][searchtype]=lessthan`,

        `criteria[2][value]=${encodeURIComponent(
            dataFim
        )}`,

        `forcedisplay[0]=2`,

        `forcedisplay[1]=15`,

        `forcedisplay[2]=83`,

        `forcedisplay[3]=12`,

        `forcedisplay[4]=21`,

        `forcedisplay[5]=5`,

        `forcedisplay[6]=19`,

        `expand_dropdowns=true`,

        `range=${inicio}-${fim}`
    ];

    const url =
        `${GLPI_URL_BASE}/search/Ticket?` +
        parametros.join('&');

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
            `Erro na consulta GLPI. HTTP ${resposta.status}: ${texto}`
        );
    }

    const dados =
        await resposta.json();

    const registros =
        Array.isArray(dados.data)
            ? dados.data
            : [];

    const total =
        Number(
            dados.totalcount || 0
        );

    console.log(
        `Progresso: ${Math.min(
            inicio + registros.length,
            total
        )} / ${total}`
    );

    return {

        data:
            registros,

        totalcount:
            total
    };
}


/* ============================================================
 * BUSCAR USUÁRIO PELO ID
 * ============================================================ */

async function buscarNomeUsuarioGLPI(
    sessao,
    usuarioId
) {

    const id =
        String(usuarioId || '').trim();

    if (!id) {
        return '';
    }

    if (
        cacheUsuariosGLPI.has(id)
    ) {

        return cacheUsuariosGLPI.get(id);
    }

    try {

        const resposta =
            await fetch(
                `${GLPI_URL_BASE}/User/${id}`,
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

            console.error(
                `Erro ao consultar usuário ${id}: HTTP ${resposta.status}`
            );

            cacheUsuariosGLPI.set(id, '');

            return '';
        }

        const usuario =
            await resposta.json();

        /*
         * PRIORIDADE:
         *
         * 1. completename
         * 2. firstname + realname
         * 3. name
         *
         * Não utiliza CPF.
         */

        let nome = '';

        if (usuario.completename) {

            nome =
                usuario.completename;

        }
        else {

            const primeiroNome =
                String(
                    usuario.firstname || ''
                ).trim();

            const sobrenome =
                String(
                    usuario.realname || ''
                ).trim();

            nome =
                `${primeiroNome} ${sobrenome}`.trim();

            if (!nome) {

                nome =
                    usuario.name || '';
            }
        }

        const nomeFinal =
            String(
                nome || ''
            ).trim();

        cacheUsuariosGLPI.set(
            id,
            nomeFinal
        );

        return nomeFinal;

    }
    catch (erro) {

        console.error(
            `Erro buscando usuário ${id}:`,
            erro.message
        );

        cacheUsuariosGLPI.set(id, '');

        return '';
    }
}


/* ============================================================
 * BUSCAR TICKET_USER
 * ============================================================ */

async function buscarTicketUsers(
    sessao,
    chamadoId
) {

    const id =
        String(chamadoId || '').trim();

    if (!id) {
        return [];
    }

    if (
        cacheTicketUsers.has(id)
    ) {

        return cacheTicketUsers.get(id);
    }

    try {

        const resposta =
            await fetch(
                `${GLPI_URL_BASE}/Ticket/${id}/Ticket_User/`,
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

            console.error(
                `Erro Ticket_User ${id}: HTTP ${resposta.status}`
            );

            cacheTicketUsers.set(id, []);

            return [];
        }

        const dados =
            await resposta.json();

        const usuarios =
            Array.isArray(dados)
                ? dados
                : [];

        cacheTicketUsers.set(
            id,
            usuarios
        );

        return usuarios;

    }
    catch (erro) {

        console.error(
            `Erro Ticket_User ${id}:`,
            erro.message
        );

        cacheTicketUsers.set(id, []);

        return [];
    }
}


/* ============================================================
 * BUSCAR TAREFAS
 * ============================================================ */

async function buscarTicketTasks(
    sessao,
    chamadoId
) {

    const id =
        String(chamadoId || '').trim();

    if (!id) {
        return [];
    }

    if (
        cacheTicketTasks.has(id)
    ) {

        return cacheTicketTasks.get(id);
    }

    try {

        const resposta =
            await fetch(
                `${GLPI_URL_BASE}/Ticket/${id}/TicketTask/`,
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

            console.error(
                `Erro TicketTask ${id}: HTTP ${resposta.status}`
            );

            cacheTicketTasks.set(id, []);

            return [];
        }

        const dados =
            await resposta.json();

        const tarefas =
            Array.isArray(dados)
                ? dados
                : [];

        cacheTicketTasks.set(
            id,
            tarefas
        );

        return tarefas;

    }
    catch (erro) {

        console.error(
            `Erro TicketTask ${id}:`,
            erro.message
        );

        cacheTicketTasks.set(id, []);

        return [];
    }
}


/* ============================================================
 * RESOLVER TÉCNICO PELO TICKET_USER
 * ============================================================ */

async function resolverTecnicoTicketUser(
    sessao,
    chamadosUsers
) {

    if (
        !Array.isArray(chamadosUsers) ||
        chamadosUsers.length === 0
    ) {

        return '';
    }

    /*
     * GLPI:
     *
     * type 1 = requerente
     * type 2 = técnico
     * type 3 = observador
     */

    const tecnicos =
        chamadosUsers.filter(
            usuario =>
                String(usuario.type) === '2'
        );

    for (
        const tecnico of tecnicos
    ) {

        const usuarioId =
            tecnico.users_id;

        if (!usuarioId) {
            continue;
        }

        const nome =
            await buscarNomeUsuarioGLPI(
                sessao,
                usuarioId
            );

        if (nome) {
            return nome;
        }
    }

    return '';
}


/* ============================================================
 * RESOLVER TÉCNICO DAS TAREFAS
 * ============================================================ */

async function resolverTecnicoDasTarefas(
    sessao,
    tarefas
) {

    if (
        !Array.isArray(tarefas) ||
        tarefas.length === 0
    ) {

        return '';
    }

    for (
        const tarefa of tarefas
    ) {

        const usuarioId =
            tarefa.users_id_tech;

        if (!usuarioId) {
            continue;
        }

        const nome =
            await buscarNomeUsuarioGLPI(
                sessao,
                usuarioId
            );

        if (nome) {
            return nome;
        }
    }

    return '';
}


/* ============================================================
 * RESOLVER TÉCNICO DO CHAMADO
 * ============================================================ */

async function resolverTecnicoChamado(
    sessao,
    chamado
) {

    if (!chamado) {
        return '';
    }

    const chamadoId =
        String(
            chamado['2'] ||
            chamado.id ||
            ''
        ).trim();

    if (!chamadoId) {
        return '';
    }

    if (
        cacheTecnicosChamados.has(chamadoId)
    ) {

        return cacheTecnicosChamados.get(
            chamadoId
        );
    }

    let nomeTecnico = '';

    /* ========================================================
     * 1. CAMPO 5
     * ======================================================== */

    const campoTecnico =
        chamado['5'];

    if (
        campoTecnico !== undefined &&
        campoTecnico !== null &&
        String(campoTecnico).trim() !== ''
    ) {

        if (
            typeof campoTecnico === 'object' &&
            !Array.isArray(campoTecnico)
        ) {

            const id =
                campoTecnico.id ||
                campoTecnico.users_id;

            if (id) {

                nomeTecnico =
                    await buscarNomeUsuarioGLPI(
                        sessao,
                        id
                    );
            }

            if (!nomeTecnico) {

                nomeTecnico =
                    campoTecnico.completename ||
                    campoTecnico.name ||
                    campoTecnico.realname ||
                    '';
            }
        }

        else if (
            Array.isArray(campoTecnico)
        ) {

            for (
                const item of campoTecnico
            ) {

                let id = null;

                if (
                    typeof item === 'object' &&
                    item !== null
                ) {

                    id =
                        item.id ||
                        item.users_id;
                }
                else {

                    const valor =
                        String(item).trim();

                    if (
                        /^\d+$/.test(valor)
                    ) {

                        id = valor;
                    }
                }

                if (!id) {
                    continue;
                }

                const nome =
                    await buscarNomeUsuarioGLPI(
                        sessao,
                        id
                    );

                if (nome) {

                    nomeTecnico =
                        nome;

                    break;
                }
            }
        }

        else {

            const valor =
                String(
                    campoTecnico
                ).trim();

            if (
                /^\d+$/.test(valor)
            ) {

                nomeTecnico =
                    await buscarNomeUsuarioGLPI(
                        sessao,
                        valor
                    );
            }
            else {

                /*
                 * Se o GLPI já retornou o nome,
                 * utilizar o nome.
                 */

                nomeTecnico =
                    valor;
            }
        }
    }

    /* ========================================================
     * 2. TICKET_USER
     * ======================================================== */

    if (!nomeTecnico) {

        const usuarios =
            await buscarTicketUsers(
                sessao,
                chamadoId
            );

        nomeTecnico =
            await resolverTecnicoTicketUser(
                sessao,
                usuarios
            );
    }

    /* ========================================================
     * 3. TAREFAS
     * ======================================================== */

    if (!nomeTecnico) {

        const tarefas =
            await buscarTicketTasks(
                sessao,
                chamadoId
            );

        nomeTecnico =
            await resolverTecnicoDasTarefas(
                sessao,
                tarefas
            );
    }

    nomeTecnico =
        String(
            nomeTecnico || ''
        ).trim();

    cacheTecnicosChamados.set(
        chamadoId,
        nomeTecnico
    );

    return nomeTecnico;
}


/* ============================================================
 * ENRIQUECER CHAMADOS
 * ============================================================ */

async function enriquecerTecnicos(
    sessao,
    chamados
) {

    if (
        !Array.isArray(chamados) ||
        chamados.length === 0
    ) {

        return [];
    }

    console.log('');
    console.log(
        'Identificando técnicos responsáveis...'
    );

    let processados = 0;

    for (
        const chamado of chamados
    ) {

        try {

            const nomeTecnico =
                await resolverTecnicoChamado(
                    sessao,
                    chamado
                );

            chamado.tecnicoResponsavel =
                nomeTecnico;

            processados++;

            console.log(
                `Técnicos identificados: ${processados}/${chamados.length}`
            );

        }
        catch (erro) {

            const id =
                chamado['2'] ||
                chamado.id ||
                '';

            console.error(
                `Erro identificando técnico do chamado ${id}:`,
                erro.message
            );

            chamado.tecnicoResponsavel =
                '';
        }
    }

    console.log(
        '✓ Técnicos identificados.'
    );

    return chamados;
}


/* ============================================================
 * BUSCAR USUÁRIO POR LOGIN
 * ============================================================ */

async function buscarUsuarioPorLogin(
    sessao,
    login
) {

    if (!login) {
        return '';
    }

    const valor =
        String(login).trim();

    if (!valor) {
        return '';
    }

    try {

        const parametros = [

            `criteria[0][field]=1`,

            `criteria[0][searchtype]=equals`,

            `criteria[0][value]=${encodeURIComponent(
                valor
            )}`,

            `forcedisplay[0]=2`,

            `forcedisplay[1]=9`,

            `forcedisplay[2]=34`
        ];

        const url =
            `${GLPI_URL_BASE}/search/User?` +
            parametros.join('&');

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
            return valor;
        }

        const dados =
            await resposta.json();

        const usuarios =
            Array.isArray(dados.data)
                ? dados.data
                : [];

        if (!usuarios.length) {
            return valor;
        }

        const usuario =
            usuarios[0];

        return String(
            usuario['9'] ||
            usuario['2'] ||
            valor
        ).trim();

    }
    catch (erro) {

        console.error(
            `Erro buscando usuário ${valor}:`,
            erro.message
        );

        return valor;
    }
}


/* ============================================================
 * LIMPAR CACHE
 * ============================================================ */

function limparCachesGLPI() {

    cacheUsuariosGLPI.clear();

    cacheTecnicosChamados.clear();

    cacheTicketUsers.clear();

    cacheTicketTasks.clear();
}


/* ============================================================
 * EXPORTAÇÕES
 * ============================================================ */

module.exports = {

    iniciarSessaoGLPI,

    encerrarSessaoGLPI,

    buscarChamados,

    enriquecerTecnicos,

    resolverTecnicoChamado,

    buscarNomeUsuarioGLPI,

    buscarTicketUsers,

    buscarTicketTasks,

    buscarUsuarioPorLogin,

    limparCachesGLPI

};