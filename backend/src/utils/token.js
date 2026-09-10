'use strict';

const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

/**
 * Genera un token de sesión simple usando HMAC-SHA256.
 * El token es: base64(payload) + "." + base64(firma)
 *
 * @param {object} payload - Datos a incluir en el token (ej. { playerId, gameId, name })
 * @returns {string} Token firmado.
 */
function generateToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verifica y decodifica un token de sesión.
 * Lanza un error si la firma es inválida o el token está malformado.
 *
 * @param {string} token
 * @returns {object} Payload decodificado.
 * @throws {Error} Si el token es inválido.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token inválido: debe ser un string.');
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Token inválido: formato incorrecto.');
  }

  const [data, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('base64url');

  // Comparación en tiempo constante para evitar timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new Error('Token inválido: firma incorrecta.');
  }

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Token inválido: payload malformado.');
  }
}

module.exports = { generateToken, verifyToken };
