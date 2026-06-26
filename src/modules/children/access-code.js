const crypto = require('crypto');

const WORDS = ['PAZ', 'FE', 'LUZ', 'VIDA', 'AMOR', 'ROCA'];
const SAFE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateSafeSuffix(length = 4) {
  return Array.from({ length }, () => SAFE_CHARACTERS[crypto.randomInt(0, SAFE_CHARACTERS.length)]).join('');
}

function generateAccessCode() {
  const word = WORDS[crypto.randomInt(0, WORDS.length)];

  return `${word}-${generateSafeSuffix()}`;
}

module.exports = {
  generateAccessCode,
};
