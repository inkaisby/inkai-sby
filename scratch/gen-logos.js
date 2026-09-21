const fs = require('fs');
const path = require('path');

const forkiPath = path.join(__dirname, '..', 'public', 'logo-forki.png');
const inkaiPath = path.join(__dirname, '..', 'public', 'logo-inkai.png');
const stempelPath = path.join(__dirname, '..', 'public', 'stempel-inkai.png');

const forki = fs.readFileSync(forkiPath).toString('base64');
const inkai = fs.readFileSync(inkaiPath).toString('base64');
const stempel = fs.readFileSync(stempelPath).toString('base64');

const code = `export const LOGO_FORKI_BASE64 = "data:image/png;base64,${forki}";
export const LOGO_INKAI_BASE64 = "data:image/png;base64,${inkai}";
export const STEMPEL_INKAI_BASE64 = "data:image/png;base64,${stempel}";
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'logos-base64.ts'), code);
console.log('src/lib/logos-base64.ts created successfully!');
