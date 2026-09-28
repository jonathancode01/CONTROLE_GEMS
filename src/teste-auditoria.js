require('dotenv').config();

const {
  obterDadosPlanilha,
  removerLinhasBatch,
} = require('./google-sheets');

const {
  iniciarSessaoGLPI,
  encerrarSessaoGLPI,
  buscarChamados,
} = require('./glpi');

/* ============================================================
 * CONFIGURAÇÕES
 * ============================================================ */

const DATA_INICIO = process.env.DATA_INICIO || '2026-01-01';
const DATA_FIM = process.env.DATA_FIM || '2027-01-01';
const TAMANHO_PAGINA = 100;

/* ============================================================
 * BUSCAR TODOS OS CHAMADOS ATUAIS DA GEMS
 * ============================================================ */

async function buscarTodosChamadosGems(sessao) {
  console.log('');
  console.log('====================================');
  console.log(' CONSULTANDO CHAMADOS ATUAIS DA GEMS');
  console.log('====================================');
  console.log('');

  const chamados = [];
  let offset = 0;
  let totalEsperado = null;

  while (true) {
    const resposta = await buscarChamados(
      sessao,
      DATA_INICIO,
      DATA_FIM,
      offset,
      TAMANHO_PAGINA
    );

    const registros = Array.isArray(resposta.data) ? resposta.data : [];

    if (totalEsperado === null) {
      totalEsperado = Number(resposta.totalcount || 0);
    }

    chamados.push(...registros);
    console.log(`Página processada: ${registros.length} chamados`);

    if (registros.length === 0) {
      break;
    }

    if (registros.length < TAMANHO_PAGINA) {
      break;
    }

    if (totalEsperado > 0 && chamados.length >= totalEsperado) {
      break;
    }

    offset += TAMANHO_PAGINA;
  }

  const mapa = new Map();

  chamados.forEach((chamado) => {
    const glpi = String(chamado['2'] || chamado.id || '').trim();

    if (glpi) {
      mapa.set(glpi, chamado);
    }
  });

  console.log('');
  console.log(`✓ Chamados recebidos da GEMS: ${chamados.length}`);
  console.log(`✓ GLPIs únicos na GEMS: ${mapa.size}`);
  console.log(`✓ Total informado pelo GLPI: ${totalEsperado}`);
  console.log('');

  const consultaCompleta = totalEsperado === 0 || mapa.size >= totalEsperado;

  if (!consultaCompleta) {
    throw new Error(
      `Consulta da GEMS incompleta. ` +
        `GLPI informou ${totalEsperado} chamados, ` +
        `mas somente ${mapa.size} foram recuperados. ` +
        'Nenhuma linha será removida.'
    );
  }

  return mapa;
}

/* ============================================================
 * IDENTIFICAR CHAMADOS FORA DA GEMS
 * ============================================================ */

function identificarChamadosForaDaGems(dadosPlanilha, chamadosGems) {
  const chamadosFora = [];

  dadosPlanilha.forEach((linha, indice) => {
    const data = String(linha[0] || '').trim();
    const glpi = String(linha[1] || '').trim();
    const tecnico = String(linha[4] || '').trim();
    const status = String(linha[5] || '').trim();
    const observacao = String(linha[6] || '').trim();

    if (!glpi) {
      return;
    }

    if (!chamadosGems.has(glpi)) {
      chamadosFora.push({
        glpi,
        linha: indice + 2,
        data,
        tecnico,
        status,
        observacao,
      });
    }
  });

  return chamadosFora;
}

/* ============================================================
 * AUDITORIA PRINCIPAL
 * ============================================================ */

async function executarAuditoria() {
  console.log('');
  console.log('====================================');
  console.log(' AUDITORIA GOOGLE SHEETS');
  console.log(' CONTROLE GEMS');
  console.log('====================================');
  console.log('');

  let sessao = null;

  try {
    /* ----------------------------------------------------
     * 1. LER PLANILHA
     * ---------------------------------------------------- */
    console.log('1. Lendo dados da planilha...');
    const dados = await obterDadosPlanilha();
    console.log(`✓ Total de linhas encontradas: ${dados.length}`);
    console.log('');

    /* ----------------------------------------------------
     * 2. AUDITORIA ORIGINAL
     * ---------------------------------------------------- */
    let linhasComGlpi = 0;
    let linhasSemGlpi = 0;
    let linhasComData = 0;
    let linhasSemData = 0;
    let linhasComGlpiEDatas = 0;

    const mapaGlpi = new Map();

    dados.forEach((linha, indice) => {
      const data = String(linha[0] || '').trim();
      const glpi = String(linha[1] || '').trim();

      if (data) {
        linhasComData++;
      } else {
        linhasSemData++;
      }

      if (glpi) {
        linhasComGlpi++;

        if (data) {
          linhasComGlpiEDatas++;
        }

        if (!mapaGlpi.has(glpi)) {
          mapaGlpi.set(glpi, {
            quantidade: 1,
            linhas: [indice + 2],
          });
        } else {
          const item = mapaGlpi.get(glpi);
          item.quantidade++;
          item.linhas.push(indice + 2);
        }
      } else {
        linhasSemGlpi++;
      }
    });

    /* ----------------------------------------------------
     * 3. IDENTIFICAR DUPLICADOS
     * ---------------------------------------------------- */
    const duplicados = [];

    mapaGlpi.forEach((item, glpi) => {
      if (item.quantidade > 1) {
        duplicados.push({
          glpi,
          quantidade: item.quantidade,
          linhas: item.linhas,
        });
      }
    });

    const glpisUnicos = mapaGlpi.size;
    let totalLinhasDuplicadas = 0;

    duplicados.forEach((item) => {
      totalLinhasDuplicadas += item.quantidade - 1;
    });

    /* ----------------------------------------------------
     * 4. RESULTADOS DA AUDITORIA
     * ---------------------------------------------------- */
    console.log('====================================');
    console.log(' RESULTADO DA AUDITORIA');
    console.log('====================================');
    console.log('');
    console.log(`Total de linhas: ${dados.length}`);
    console.log(`Linhas com GLPI: ${linhasComGlpi}`);
    console.log(`Linhas sem GLPI: ${linhasSemGlpi}`);
    console.log('');
    console.log(`GLPIs únicos: ${glpisUnicos}`);
    console.log(`GLPIs duplicados: ${duplicados.length}`);
    console.log(`Linhas duplicadas: ${totalLinhasDuplicadas}`);
    console.log('');
    console.log(`Linhas com data: ${linhasComData}`);
    console.log(`Linhas sem data: ${linhasSemData}`);
    console.log('');
    console.log(`GLPI + data preenchidos: ${linhasComGlpiEDatas}`);
    console.log('');

    /* ----------------------------------------------------
     * 5. MOSTRAR DUPLICADOS
     * ---------------------------------------------------- */
    if (duplicados.length > 0) {
      console.log('====================================');
      console.log(' CHAMADOS DUPLICADOS');
      console.log('====================================');
      console.log('');

      duplicados.slice(0, 30).forEach((item) => {
        console.log(`GLPI ${item.glpi} → ${item.quantidade} ocorrências`);
        console.log(`Linhas: ${item.linhas.join(', ')}`);
        console.log('');
      });

      if (duplicados.length > 30) {
        console.log(`... e mais ${duplicados.length - 30} duplicados.`);
        console.log('');
      }
    }

    /* ----------------------------------------------------
     * 6. INICIAR SESSÃO GLPI
     * ---------------------------------------------------- */
    console.log('====================================');
    console.log(' VERIFICANDO VÍNCULO COM A GEMS');
    console.log('====================================');
    console.log('');

    sessao = await iniciarSessaoGLPI();

    /* ----------------------------------------------------
     * 7. BUSCAR CHAMADOS ATUAIS DA GEMS
     * ---------------------------------------------------- */
    const chamadosGems = await buscarTodosChamadosGems(sessao);

    /* ----------------------------------------------------
     * 8. COMPARAR PLANILHA X GEMS
     * ---------------------------------------------------- */
    const chamadosForaDaGems = identificarChamadosForaDaGems(dados, chamadosGems);

    console.log('====================================');
    console.log(' CHAMADOS FORA DA GEMS');
    console.log('====================================');
    console.log('');

    if (chamadosForaDaGems.length === 0) {
      console.log('✓ Nenhum chamado fora da GEMS foi encontrado.');
      console.log('');
    } else {
      chamadosForaDaGems.forEach((item) => {
        console.log(`GLPI: ${item.glpi}`);
        console.log(`Linha: ${item.linha}`);
        console.log(`Data: ${item.data || 'SEM DATA'}`);
        console.log(`Técnico: ${item.tecnico || 'SEM TÉCNICO'}`);
        console.log(`Status: ${item.status || 'SEM STATUS'}`);
        console.log(`Observação: ${item.observacao || 'SEM OBSERVAÇÃO'}`);
        console.log('------------------------------------');
      });

      console.log('');
      console.log(`Total de chamados fora da GEMS: ${chamadosForaDaGems.length}`);
      console.log('');
    }

    /* ----------------------------------------------------
     * 9. REMOVER CHAMADOS FORA DA GEMS
     * ---------------------------------------------------- */
    if (chamadosForaDaGems.length > 0) {
      console.log('====================================');
      console.log(' REMOVENDO CHAMADOS FORA DA GEMS');
      console.log('====================================');
      console.log('');

      const linhasParaRemover = chamadosForaDaGems.map((item) => item.linha);
      console.log(`Linhas que serão removidas: ${linhasParaRemover.join(', ')}`);
      console.log('');

      await removerLinhasBatch(linhasParaRemover);
      console.log(`✓ ${linhasParaRemover.length} linha(s) removida(s) da planilha.`);
      console.log('');
    }

    /* ----------------------------------------------------
     * 10. FINALIZAÇÃO
     * ---------------------------------------------------- */
    console.log('====================================');
    console.log(' AUDITORIA CONCLUÍDA');
    console.log('====================================');
  } catch (erro) {
    console.error('');
    console.error('ERRO DURANTE A AUDITORIA:');
    console.error(erro.message);
    console.error('');
  } finally {
    if (sessao) {
      try {
        await encerrarSessaoGLPI(sessao);
      } catch (erro) {
        console.error('Erro ao encerrar sessão GLPI:', erro.message);
      }
    }
  }
}

executarAuditoria();
