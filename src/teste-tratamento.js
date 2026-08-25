const tratamento = require('./tratamento');


console.log('====================================');
console.log('TESTE DO TRATAMENTO');
console.log('====================================');


const chamadoTeste = {

    '2': '123456',

    '12': '5',

    '15': '2026-08-20 10:35:42',

    '21':
        '<p>Computador apresentou problema de conexão.</p>',

    '83':
        'CDE 01'

};


const resultado =
    tratamento.tratarChamado(
        chamadoTeste
    );


console.log(
    'Resultado tratado:'
);

console.log(
    resultado
);


const linha =
    tratamento.chamadoParaLinhaSheets(
        resultado
    );


console.log(
    'Linha para o Google Sheets:'
);

console.log(
    linha
);