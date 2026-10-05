const crypto = require('crypto');

const LICENSE_SECRET = 'WICHTELWEG_KOTTENHEIM_SECRET_KEY_2026';

function generateLicenseKey() {
    // Generiert 3 zufaellige Blöcke (je 4 Zeichen Hex)
    const block1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const block2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const block3 = crypto.randomBytes(2).toString('hex').toUpperCase();

    const dataPart = `${block1}-${block2}-${block3}`;

    // Berechnet die korrekte Prüfsumme
    const checksum = crypto
        .createHmac('sha256', LICENSE_SECRET)
        .update(dataPart)
        .digest('hex')
        .substring(0, 4)
        .toUpperCase();

    return `${dataPart}-${checksum}`;
}

console.log("Neuer gueltiger Lizenzschluessel:");
console.log(generateLicenseKey());