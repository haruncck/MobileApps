// Testlerin ortak girişi: üretim dosyalarını yükler, kısa doğrulama adları verir.
const assert = require('node:assert/strict');
const BR = require('../../../berber/hesap.js');
for (const dosya of ['ornek.js', 'ses.js']) { try { require('../../../berber/' + dosya); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; } }
module.exports = { BR, test: require('node:test').test, eq: assert.equal, deepEq: assert.deepEqual, ok: assert.ok };
