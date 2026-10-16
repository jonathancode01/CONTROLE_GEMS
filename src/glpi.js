require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
});


/* ============================================================
 * CONFIGURAÇÕES
 * ============================================================ */

const GLPI_URL_BASE =
    process.env.GLPI_URL_BASE ||
    'https://servicosti.seduc.am.gov.br/apirest.php';

const TIMEZONE =
    process.env.GLPI_TIMEZONE ||
    'America/Manaus';


/* ============================================================
 * CACHES
 * ============================================================ */

const cacheUsuariosGLPI = new Map();
const cacheTecnicosChamados = new Map();
const cacheTicketUsers = new Map();
const cacheLogsChamados = new Map();
const cacheFollowupsChamados = new Map();


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
 * BUSCAR CHAMADO ESPECÍFICO
 * ============================================================ */

async function buscarChamadoPorId(
    sessao,
    chamadoId
) {

    const id =
        String(
            chamadoId || ''
        ).trim();

    if (!id) {
        return null;
    }

    const parametros = [

        `criteria[0][field]=2`,

        `criteria[0][searchtype]=equals`,

        `criteria[0][value]=${encodeURIComponent(
            id
        )}`,

        `forcedisplay[0]=2`,
        `forcedisplay[1]=15`,
        `forcedisplay[2]=83`,
        `forcedisplay[3]=12`,
        `forcedisplay[4]=21`,
        `forcedisplay[5]=5`,
        `forcedisplay[6]=19`,

        `expand_dropdowns=true`,

        `range=0-1`
    ];

    const url =
        `${GLPI_URL_BASE}/search/Ticket?` +
        parametros.join('&');

    try {

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

        const registros =
            Array.isArray(dados.data)
                ? dados.data
                : [];

        return registros[0] || null;

    }
    catch (erro) {

        console.error(
            `Erro buscando chamado ${id}:`,
            erro.message
        );

        return null;
    }
}


/* ============================================================
 * BUSCAR USUÁRIO PELO ID
 * ============================================================ */

async function buscarNomeUsuarioGLPI(
    sessao,
    usuarioId
) {

    const id =
        String(
            usuarioId || ''
        ).trim();

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

            cacheUsuariosGLPI.set(
                id,
                ''
            );

            return '';
        }

        const usuario =
            await resposta.json();

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

        cacheUsuariosGLPI.set(
            id,
            ''
        );

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
        String(
            chamadoId || ''
        ).trim();

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

            cacheTicketUsers.set(
                id,
                []
            );

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

        cacheTicketUsers.set(
            id,
            []
        );

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

        return {
            nome: '',
            id: ''
        };
    }

    const tecnicos =
        chamadosUsers.filter(
            usuario =>
                String(
                    usuario.type
                ) === '2'
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

            return {
                nome,
                id:
                    String(usuarioId)
            };
        }
    }

    return {
        nome: '',
        id: ''
    };
}


/* ============================================================
 * RESOLVER TÉCNICO DO CHAMADO
 * ============================================================ */

async function resolverTecnicoChamado(
    sessao,
    chamado
) {

    if (!chamado) {

        return {
            nome: '',
            id: ''
        };
    }

    const chamadoId =
        String(
            chamado['2'] ||
            chamado.id ||
            ''
        ).trim();

    if (!chamadoId) {

        return {
            nome: '',
            id: ''
        };
    }

    if (
        cacheTecnicosChamados.has(
            chamadoId
        )
    ) {

        return cacheTecnicosChamados.get(
            chamadoId
        );
    }

    let nomeTecnico = '';
    let tecnicoId = '';


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

                tecnicoId =
                    String(id);

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

                    tecnicoId =
                        String(id);

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

                tecnicoId =
                    valor;

                nomeTecnico =
                    await buscarNomeUsuarioGLPI(
                        sessao,
                        valor
                    );
            }
            else {

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

        const resultado =
            await resolverTecnicoTicketUser(
                sessao,
                usuarios
            );

        nomeTecnico =
            resultado.nome;

        tecnicoId =
            resultado.id;
    }


    /* ========================================================
     * RESULTADO FINAL
     * ======================================================== */

    const resultadoFinal = {

        nome:
            String(
                nomeTecnico || ''
            ).trim(),

        id:
            String(
                tecnicoId || ''
            ).trim()
    };

    cacheTecnicosChamados.set(
        chamadoId,
        resultadoFinal
    );

    return resultadoFinal;
}


/* ============================================================
 * BUSCAR LOG DO CHAMADO
 * ============================================================ */

async function buscarLogsChamado(
    sessao,
    chamadoId
) {

    const id =
        String(
            chamadoId || ''
        ).trim();

    if (!id) {
        return [];
    }

    if (
        cacheLogsChamados.has(id)
    ) {

        return cacheLogsChamados.get(id);
    }

    try {

        const resposta =
            await fetch(
                `${GLPI_URL_BASE}/Ticket/${id}/Log/`,
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
                `Erro Log ${id}: HTTP ${resposta.status}`
            );

            cacheLogsChamados.set(
                id,
                []
            );

            return [];
        }

        const dados =
            await resposta.json();

        const logs =
            Array.isArray(dados)
                ? dados
                : [];

        cacheLogsChamados.set(
            id,
            logs
        );

        return logs;

    }
    catch (erro) {

        console.error(
            `Erro buscando Log ${id}:`,
            erro.message
        );

        cacheLogsChamados.set(
            id,
            []
        );

        return [];
    }
}


/* ============================================================
 * BUSCAR FOLLOWUPS / DEVOLUTIVAS
 * ============================================================ */

async function buscarFollowupsChamado(
    sessao,
    chamadoId
) {

    const id =
        String(
            chamadoId || ''
        ).trim();

    if (!id) {
        return [];
    }

    if (
        cacheFollowupsChamados.has(id)
    ) {

        return cacheFollowupsChamados.get(id);
    }

    try {

        const resposta =
            await fetch(
                `${GLPI_URL_BASE}/Ticket/${id}/TicketFollowup/`,
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
                `Erro TicketFollowup ${id}: HTTP ${resposta.status}`
            );

            cacheFollowupsChamados.set(
                id,
                []
            );

            return [];
        }

        const dados =
            await resposta.json();

        const followups =
            Array.isArray(dados)
                ? dados
                : [];

        cacheFollowupsChamados.set(
            id,
            followups
        );

        return followups;

    }
    catch (erro) {

        console.error(
            `Erro buscando Followups ${id}:`,
            erro.message
        );

        cacheFollowupsChamados.set(
            id,
            []
        );

        return [];
    }
}


/* ============================================================
 * EXTRAIR DATA DA ATRIBUIÇÃO
 * ============================================================ */

function extrairDataAtribuicao(
    logs,
    tecnicoId
) {

    if (
        !Array.isArray(logs) ||
        !logs.length ||
        !tecnicoId
    ) {

        return '';
    }

    const idTecnico =
        String(
            tecnicoId
        ).trim();

    const atribuicoes =
        logs.filter(
            log => {

                const campo =
                    String(
                        log?.id_search_option || ''
                    ).trim();

                if (
                    campo !== '5'
                ) {
                    return false;
                }

                const novoValor =
                    String(
                        log?.new_value || ''
                    );

                return novoValor.includes(
                    `(${idTecnico})`
                );
            }
        );

    if (
        !atribuicoes.length
    ) {

        return '';
    }

    atribuicoes.sort(
        (a, b) =>
            String(
                a.date_mod || ''
            ).localeCompare(
                String(
                    b.date_mod || ''
                )
            )
    );

    return String(
        atribuicoes[
            atribuicoes.length - 1
        ]?.date_mod || ''
    ).trim();
}


/* ============================================================
 * OBTER DATA ATUAL NO FUSO DA GEMS
 * ============================================================ */

function obterDataAtualGLPI() {

    const formatter =
        new Intl.DateTimeFormat(
            'en-CA',
            {
                timeZone:
                    TIMEZONE,

                year:
                    'numeric',

                month:
                    '2-digit',

                day:
                    '2-digit'
            }
        );

    return formatter.format(
        new Date()
    );
}


/* ============================================================
 * VERIFICAR SE A ATRIBUIÇÃO FOI HOJE
 * ============================================================ */

function atribuicaoFoiHoje(
    dataAtribuicao
) {

    if (
        !dataAtribuicao
    ) {
        return false;
    }

    const data =
        String(
            dataAtribuicao
        ).substring(
            0,
            10
        );

    return (
        data ===
        obterDataAtualGLPI()
    );
}


/* ============================================================
 * VERIFICAR DEVOLUTIVA DO TÉCNICO
 * ============================================================ */

function obterDevolutivasDoTecnico(
    followups,
    tecnicoId,
    dataAtribuicao
) {

    if (
        !Array.isArray(followups) ||
        !followups.length ||
        !tecnicoId
    ) {

        return [];
    }

    const idTecnico =
        String(
            tecnicoId
        ).trim();

    const dataInicio =
        String(
            dataAtribuicao || ''
        ).trim();

    return followups.filter(
        followup => {

            const usuarioId =
                String(
                    followup?.users_id || ''
                ).trim();

            /*
             * A devolutiva precisa ser do técnico
             * atualmente responsável pelo chamado.
             */

            if (
                usuarioId !==
                idTecnico
            ) {

                return false;
            }

            const dataFollowup =
                String(
                    followup?.date ||
                    followup?.date_creation ||
                    ''
                ).trim();

            if (
                !dataFollowup
            ) {

                return false;
            }

            /*
             * A devolutiva precisa ter ocorrido
             * na mesma data ou depois da atribuição.
             *
             * Como o formato é YYYY-MM-DD HH:mm:ss,
             * a comparação lexicográfica funciona
             * corretamente.
             */

            if (
                dataInicio &&
                dataFollowup < dataInicio
            ) {

                return false;
            }

            return true;
        }
    );
}


/* ============================================================
 * ENRIQUECER ATRIBUIÇÃO E DEVOLUTIVAS
 * ============================================================ */

async function enriquecerAtribuicaoEDevolutivas(
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
        'Identificando atribuições e devolutivas...'
    );

    let processados =
        0;

    for (
        const chamado of chamados
    ) {

        /*
         * Inicializa sempre os campos utilizados
         * pela classificação gerencial.
         */

        chamado.atribuicaoHoje =
            false;

        chamado.dataAtribuicao =
            '';

        chamado.devolutivas =
            [];

        const status =
            String(
                chamado['12'] ||
                chamado.status ||
                ''
            ).trim();

        /*
         * Somente chamados em atendimento precisam
         * da análise de atribuição/devolutiva.
         */

        if (
            status !== '2' &&
            status !== '3'
        ) {

            continue;
        }

        const chamadoId =
            String(
                chamado['2'] ||
                chamado.id ||
                ''
            ).trim();

        if (!chamadoId) {
            continue;
        }

        try {

            const tecnicoId =
                String(
                    chamado.tecnicoId || ''
                ).trim();

            if (!tecnicoId) {
                continue;
            }

            /*
             * Primeiro buscamos o Log para descobrir
             * quando o técnico atual foi atribuído.
             */

            const logs =
                await buscarLogsChamado(
                    sessao,
                    chamadoId
                );

            const dataAtribuicao =
                extrairDataAtribuicao(
                    logs,
                    tecnicoId
                );

            chamado.dataAtribuicao =
                dataAtribuicao;

            /*
             * Se foi atribuído hoje:
             *
             * EM EXECUÇÃO.
             *
             * Não precisamos consultar followups.
             */

            if (
                atribuicaoFoiHoje(
                    dataAtribuicao
                )
            ) {

                chamado.atribuicaoHoje =
                    true;

                chamado.devolutivas =
                    [];

                processados++;

                continue;
            }

            /*
             * Foi atribuído anteriormente.
             *
             * Agora verificamos se o técnico atual
             * possui alguma devolutiva após sua atribuição.
             */

            const followups =
                await buscarFollowupsChamado(
                    sessao,
                    chamadoId
                );

            chamado.devolutivas =
                obterDevolutivasDoTecnico(
                    followups,
                    tecnicoId,
                    dataAtribuicao
                );

            processados++;

        }
        catch (erro) {

            console.error(
                `Erro analisando atribuição/devolutiva do chamado ${chamadoId}:`,
                erro.message
            );

            /*
             * Em caso de erro, deixamos os dados vazios.
             *
             * O tratamento.js possui fallback seguro
             * para não classificar como SEM DEVOLUTIVA
             * quando não existe data de atribuição.
             */

            chamado.dataAtribuicao =
                '';

            chamado.devolutivas =
                [];

            chamado.atribuicaoHoje =
                false;
        }
    }

    console.log(
        `✓ Atribuições/devolutivas analisadas: ${processados}`
    );

    return chamados;
}



/* ============================================================
 * HISTÓRICO DE ATRIBUIÇÃO E DEVOLUTIVAS
 * ============================================================ */

const TIMEZONE = 'America/Manaus';

async function consultarRelacaoGLPI(sessao, chamadoId, relacao) {
    const id = String(chamadoId || '').trim();

    if (!id) {
        throw new Error('ID do chamado não informado.');
    }

    const resposta = await fetch(
        `${GLPI_URL_BASE}/Ticket/${id}/${relacao}/`,
        {
            method: 'GET',
            headers: {
                'Session-Token': sessao.sessionToken,
                'App-Token': sessao.appToken
            }
        }
    );

    if (!resposta.ok) {
        const texto = await resposta.text();
        throw new Error(
            `${relacao} do chamado ${id}: HTTP ${resposta.status}: ${texto}`
        );
    }

    const dados = await resposta.json();

    if (Array.isArray(dados)) {
        return dados;
    }

    if (Array.isArray(dados.data)) {
        return dados.data;
    }

    return [];
}

async function buscarLogsChamado(sessao, chamadoId) {
    return consultarRelacaoGLPI(sessao, chamadoId, 'Log');
}

async function buscarFollowupsChamado(sessao, chamadoId) {
    return consultarRelacaoGLPI(sessao, chamadoId, 'ITILFollowup');
}

function obterDataAtualGLPI() {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const valores = {};

    for (const parte of partes) {
        valores[parte.type] = parte.value;
    }

    return `${valores.year}-${valores.month}-${valores.day}`;
}

function extrairDataAtribuicao(logs, tecnicoId) {
    const idTecnico = String(tecnicoId || '').trim();

    if (!idTecnico || !Array.isArray(logs)) {
        return '';
    }

    const atribuicoes = logs.filter(log => {
        const campo = String(log.id_search_option ?? '').trim();
        const novoValor = String(log.new_value ?? '').trim();

        return campo === '5' &&
            (
                novoValor === idTecnico ||
                novoValor.includes(`(${idTecnico})`)
            ) &&
            Boolean(log.date_mod);
    });

    atribuicoes.sort((a, b) =>
        String(b.date_mod).localeCompare(String(a.date_mod))
    );

    return atribuicoes[0]?.date_mod || '';
}

function obterDevolutivasDoTecnico(followups, tecnicoId, dataAtribuicao) {
    const idTecnico = String(tecnicoId || '').trim();
    const dataInicio = String(dataAtribuicao || '').slice(0, 10);

    if (
        !idTecnico ||
        !dataInicio ||
        !Array.isArray(followups)
    ) {
        return [];
    }

    return followups.filter(item => {
        const autorId = String(
            item.users_id ?? item.users_id_editor ?? ''
        ).trim();

        const dataRegistro = String(
            item.date ?? item.date_creation ?? ''
        ).slice(0, 10);

        return autorId === idTecnico &&
            /^\d{4}-\d{2}-\d{2}$/.test(dataRegistro) &&
            dataRegistro >= dataInicio;
    });
}

async function obterTecnicoIdChamado(sessao, chamado, nomeTecnico) {
    const campoTecnico = chamado['5'];

    // Quando o campo 5 contém diretamente o ID do usuário.
    if (
        typeof campoTecnico === 'number' ||
        (
            typeof campoTecnico === 'string' &&
            /^\d+$/.test(campoTecnico.trim())
        )
    ) {
        return String(campoTecnico).trim();
    }

    // Quando o campo 5 contém um objeto com o ID.
    if (campoTecnico && typeof campoTecnico === 'object' &&
        !Array.isArray(campoTecnico)) {
        const id = campoTecnico.id ?? campoTecnico.users_id;

        if (id) {
            return String(id);
        }
    }

    // Alternativa: identificar o técnico pelos vínculos Ticket_User.
    const usuarios = await buscarTicketUsers(
        sessao,
        chamado['2'] ?? chamado.id
    );

    for (const usuario of usuarios) {
        if (String(usuario.type) !== '2' || !usuario.users_id) {
            continue;
        }

        const nome = await buscarNomeUsuarioGLPI(
            sessao,
            usuario.users_id
        );

        if (
            nome &&
            nome.trim().toLowerCase() ===
                String(nomeTecnico || '').trim().toLowerCase()
        ) {
            return String(usuario.users_id);
        }
    }

    return '';
}

async function enriquecerAtribuicaoEDevolutivas(sessao, chamado) {
    chamado.dadosGerenciaisConsultados = false;
    chamado.atribuicaoHoje = false;
    chamado.dataAtribuicao = '';
    chamado.devolutivas = [];

    const codigoStatus = String(
        chamado['12'] ?? chamado.status ?? ''
    ).trim();

    // O histórico adicional só é necessário para chamados em atendimento.
    if (codigoStatus !== '2' && codigoStatus !== '3') {
        return chamado;
    }

    try {
        const idChamado = chamado['2'] ?? chamado.id;
        const tecnicoId = await obterTecnicoIdChamado(
            sessao,
            chamado,
            chamado.tecnicoResponsavel
        );

        if (!tecnicoId) {
            throw new Error('Não foi possível identificar o ID do técnico atual.');
        }

        const [logs, followups] = await Promise.all([
            buscarLogsChamado(sessao, idChamado),
            buscarFollowupsChamado(sessao, idChamado)
        ]);

        const dataAtribuicao = extrairDataAtribuicao(
            logs,
            tecnicoId
        );

        if (!dataAtribuicao) {
            throw new Error('Não foi encontrada a data de atribuição ao técnico atual.');
        }

        chamado.tecnicoId = tecnicoId;
        chamado.dataAtribuicao = dataAtribuicao;
        chamado.atribuicaoHoje =
            String(dataAtribuicao).slice(0, 10) === obterDataAtualGLPI();

        chamado.devolutivas = obterDevolutivasDoTecnico(
            followups,
            tecnicoId,
            dataAtribuicao
        );

        chamado.dadosGerenciaisConsultados = true;
    } catch (erro) {
        console.error(
            `Não foi possível classificar gerencialmente o chamado ${
                chamado['2'] ?? chamado.id ?? ''
            }:`,
            erro.message
        );
    }

    return chamado;
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

    let processados =
        0;

    for (
        const chamado of chamados
    ) {

        try {

            const resultado =
                await resolverTecnicoChamado(
                    sessao,
                    chamado
                );

            chamado.tecnicoResponsavel =
                resultado.nome;

            chamado.tecnicoId =
                resultado.id;

            await enriquecerAtribuicaoEDevolutivas(
            sessao,
            chamado
        );

            processados++;

            const id =
                chamado['2'] ||
                chamado.id ||
                '';

            console.log(
                `Técnico identificado: ${id} → ${resultado.nome || 'SEM TÉCNICO'}`
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

            chamado.tecnicoId =
                '';
        }
    }

    console.log(
        '✓ Técnicos identificados.'
    );

    /*
     * Segunda etapa:
     *
     * Agora que todos os chamados já possuem
     * tecnicoId, conseguimos consultar o histórico
     * de atribuição e as devolutivas.
     */

    await enriquecerAtribuicaoEDevolutivas(
        sessao,
        chamados
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
        String(
            login
        ).trim();

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

        if (
            !usuarios.length
        ) {

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

    cacheLogsChamados.clear();

    cacheFollowupsChamados.clear();
}


/* ============================================================
 * EXPORTAÇÕES
 * ============================================================ */

module.exports = {

    iniciarSessaoGLPI,

    encerrarSessaoGLPI,

    buscarChamados,

    enriquecerTecnicos,

    enriquecerAtribuicaoEDevolutivas,

    resolverTecnicoChamado,

    buscarNomeUsuarioGLPI,

    buscarChamadoPorId,

    buscarTicketUsers,

    buscarLogsChamado,

    buscarFollowupsChamado,

    buscarUsuarioPorLogin,

    limparCachesGLPI
};