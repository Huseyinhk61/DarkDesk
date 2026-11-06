import { validateRates } from './currency.js';
export async function readCurrencyResponse(response, now = Date.now()) {
  if (!response.ok || Number(response.headers?.get('content-length') || 0) > 131072)
    throw Error('FX_UNAVAILABLE');
  let text = '',
    size = 0;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 131072) throw Error('FX_UNAVAILABLE');
    text += decoder.decode(chunk, { stream: true });
  }
  text += decoder.decode();
  return validateRates(JSON.parse(text), now);
}
