const fs = require('node:fs');
const path = require('node:path');
function validateIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error(
      'Store identity is required. Copy build/store-identity.example.json to build/store-identity.local.json and use the exact Partner Center values.',
    );
  for (const key of ['identityName', 'publisher', 'publisherDisplayName', 'displayName'])
    if (
      typeof value[key] !== 'string' ||
      !value[key].trim() ||
      value[key].length > 200 ||
      /REPLACE|[<>\x00-\x1f]/.test(value[key])
    )
      throw Error(`Invalid Store identity field: ${key}`);
  if (!/^[a-zA-Z0-9.-]{3,50}$/.test(value.identityName) || !/^CN=.+/.test(value.publisher))
    throw Error('Package identityName / publisher must match Partner Center.');
  return Object.fromEntries(
    ['identityName', 'publisher', 'publisherDisplayName', 'displayName'].map((key) => [
      key,
      value[key].trim(),
    ]),
  );
}
function readIdentity(
  file = process.env.DARKDESK_STORE_IDENTITY ||
    path.resolve(__dirname, '../build/store-identity.local.json'),
) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw Error('Missing Store identity. See docs/MICROSOFT_STORE.md.');
  }
  return validateIdentity(value);
}
if (require.main === module) {
  try {
    const value = readIdentity();
    console.log(
      `Store configuration valid: ${value.identityName}. Partner Center validation and Windows certification are still required.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { readIdentity, validateIdentity };
