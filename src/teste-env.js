require('dotenv').config();

console.log('====================================');
console.log('TESTE DAS VARIÁVEIS');
console.log('====================================');

console.log(
    'GOOGLE_SHEETS_ID:',
    process.env.GOOGLE_SHEETS_ID
        ? 'ENCONTRADO'
        : 'NÃO ENCONTRADO'
);

console.log(
    'GOOGLE_SHEETS_ABA:',
    process.env.GOOGLE_SHEETS_ABA
        ? process.env.GOOGLE_SHEETS_ABA
        : 'NÃO ENCONTRADO'
);

console.log(
    'GOOGLE_CLIENT_EMAIL:',
    process.env.GOOGLE_CLIENT_EMAIL
        ? 'ENCONTRADO'
        : 'NÃO ENCONTRADO'
);

console.log(
    'GOOGLE_PRIVATE_KEY:',
    process.env.GOOGLE_PRIVATE_KEY
        ? 'ENCONTRADA'
        : 'NÃO ENCONTRADA'
);

console.log('====================================');