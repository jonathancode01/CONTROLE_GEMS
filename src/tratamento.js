/* ============================================================
 * TRATAMENTO DOS CHAMADOS GLPI
 * ============================================================ */

const MESES = [

    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'

];


/* ============================================================
 * NORMALIZAÇÃO
 * ============================================================ */

function normalizarTexto(texto) {

    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}


/* ============================================================
 * CONVERTER DATA DO GLPI
 *
 * Retorna:
 *
 * DD/MM/AAAA
 *
 * Sem UTC.
 * Sem conversão de timezone.
 * ============================================================ */

function converterDataGLPI(texto) {

    if (!texto) {
        return '';
    }

    const valor =
        String(texto).trim();

    /*
     * Formato padrão do GLPI:
     *
     * 2026-08-24 08:07:01
     */

    const match =
        valor.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

    if (match) {

        const ano =
            match[1];

        const mes =
            match[2];

        const dia =
            match[3];

        return `${dia}/${mes}/${ano}`;
    }

    /*
     * Caso já venha no formato DD/MM/AAAA.
     */

    const formatoBR =
        valor.match(
            /^(\d{2})\/(\d{2})\/(\d{4})/
        );

    if (formatoBR) {

        return valor.substring(
            0,
            10
        );
    }

    return '';
}


/* ============================================================
 * OBTER MÊS
 * ============================================================ */

function obterMesDaDataGLPI(texto) {

    if (!texto) {
        return '';
    }

    const valor =
        String(texto).trim();

    const match =
        valor.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

    if (match) {

        const numeroMes =
            Number(match[2]);

        if (
            numeroMes >= 1 &&
            numeroMes <= 12
        ) {

            return MESES[
                numeroMes - 1
            ];
        }
    }

    const formatoBR =
        valor.match(
            /^\d{2}\/(\d{2})\/\d{4}/
        );

    if (formatoBR) {

        const numeroMes =
            Number(formatoBR[1]);

        if (
            numeroMes >= 1 &&
            numeroMes <= 12
        ) {

            return MESES[
                numeroMes - 1
            ];
        }
    }

    return '';
}


/* ============================================================
 * CLASSIFICAR LOCAL
 * ============================================================ */

function classificarLocal(local) {

    const texto =
        String(local || '')
            .toUpperCase();

    if (!texto) {
        return '';
    }

    return texto.includes('CDE')
        ? 'ROTA'
        : 'SEDE';
}


/* ============================================================
 * STATUS
 * ============================================================ */

const MAPA_STATUS = {

    '1': 'PENDENTE',

    '2': 'EM EXECUÇÃO',

    '3': 'EM EXECUÇÃO',

    '4': 'PENDENTE',

    '5': 'CONCLUIDO',

    '6': 'CONCLUIDO'

};


/* ============================================================
 * LIMPAR OBSERVAÇÃO
 * ============================================================ */

function limparObservacao(texto) {

    if (!texto) {
        return '';
    }

    return String(texto)

        .replace(/&#60;/g, '<')

        .replace(/&#62;/g, '>')

        .replace(/&lt;/g, '<')

        .replace(/&gt;/g, '>')

        .replace(/&amp;/g, '&')

        .replace(/&quot;/g, '"')

        .replace(
            /&#39;|&apos;/g,
            "'"
        )

        .replace(
            /<[^>]*>/g,
            ' '
        )

        .replace(
            /\s+/g,
            ' '
        )

        .trim();
}


/* ============================================================
 * TRATAR TÉCNICO
 * ============================================================ */

function tratarTecnicoResponsavel(tecnico) {

    if (
        tecnico === undefined ||
        tecnico === null
    ) {

        return '';
    }

    if (
        Array.isArray(tecnico)
    ) {

        return tecnico

            .map(
                item => {

                    if (
                        typeof item === 'object' &&
                        item !== null
                    ) {

                        return (
                            item.completename ||
                            item.name ||
                            item.realname ||
                            ''
                        );
                    }

                    return String(item);
                }
            )

            .map(
                item =>
                    String(item).trim()
            )

            .filter(Boolean)

            .join(', ');
    }

    if (
        typeof tecnico === 'object' &&
        tecnico !== null
    ) {

        return String(

            tecnico.completename ||
            tecnico.name ||
            tecnico.realname ||
            ''

        ).trim();
    }

    return String(tecnico).trim();
}


/* ============================================================
 * TRATAR CHAMADO
 * ============================================================ */

function tratarChamado(chamado) {

    if (!chamado) {
        return null;
    }

    /* ========================================================
     * GLPI
     * ======================================================== */

    const numeroGlpi =
        String(
            chamado['2'] ||
            chamado.id ||
            ''
        ).trim();

    if (!numeroGlpi) {
        return null;
    }


    /* ========================================================
     * DATA
     * ======================================================== */

    const dataOriginal =
        chamado['15'] ||
        chamado.date ||
        '';

    const dataAbertura =
        converterDataGLPI(
            dataOriginal
        );

    const mes =
        obterMesDaDataGLPI(
            dataOriginal
        );


    /* ========================================================
     * LOCAL
     * ======================================================== */

    const local =
        classificarLocal(
            chamado['83']
        );


    /* ========================================================
     * STATUS
     * ======================================================== */

    const codigoStatus =
        String(
            chamado['12'] ||
            chamado.status ||
            ''
        ).trim();

    const status =
        MAPA_STATUS[codigoStatus] ||
        'PENDENTE';


    /* ========================================================
     * OBSERVAÇÃO
     * ======================================================== */

    const observacao =
        limparObservacao(
            chamado['21'] ||
            chamado.content
        );


    /* ========================================================
     * TÉCNICO
     * ======================================================== */

    const tecnicoResponsavel =
        tratarTecnicoResponsavel(
            chamado.tecnicoResponsavel
        );


    /* ========================================================
     * RESULTADO
     * ======================================================== */

    return {

        glpi:
            numeroGlpi,

        dataAbertura:
            dataAbertura,

        mes:
            mes,

        local:
            local,

        tecnicoResponsavel:
            tecnicoResponsavel,

        status:
            status,

        observacao:
            observacao
    };
}


/* ============================================================
 * TRANSFORMAR PARA GOOGLE SHEETS
 *
 * A = DATA
 * B = GLPI
 * C = MES
 * D = LOCAL
 * E = TECNICO RESPONSAVEL
 * F = STATUS
 * G = OBSERVACAO
 * ============================================================ */

function chamadoParaLinhaSheets(chamado) {

    if (!chamado) {
        return null;
    }

    return [

        chamado.dataAbertura || '',

        chamado.glpi || '',

        chamado.mes || '',

        chamado.local || '',

        chamado.tecnicoResponsavel || '',

        chamado.status || '',

        chamado.observacao || ''

    ];
}


/* ============================================================
 * EXPORTAÇÕES
 * ============================================================ */

module.exports = {

    tratarChamado,

    chamadoParaLinhaSheets,

    converterDataGLPI,

    obterMesDaDataGLPI,

    classificarLocal,

    limparObservacao,

    tratarTecnicoResponsavel,

    normalizarTexto

};