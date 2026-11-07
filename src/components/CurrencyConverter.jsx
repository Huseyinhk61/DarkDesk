import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Copy, RefreshCw, Coins, ArrowUpRight } from 'lucide-react';
import { currencies, normalizeCurrencyPreferences } from '../../shared/currency';
import { api } from '../service';
import { usePreferences } from '../preferences';
import '../currency.css';
export default function CurrencyConverter({ compact = false }) {
  const { t, locale, language, settings, setSettings, errorMessage } = usePreferences();
  const preferences = normalizeCurrencyPreferences(settings.currency, language);
  const [saving, setSaving] = useState(false);
  const save = async (value) => {
    setSaving(true);
    try {
      setSettings(await api.saveCurrencyPreferences(value));
      setError('');
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };
  const [amount, setAmount] = useState('1'),
    [from, setFrom] = useState('USD'),
    [to, setTo] = useState(preferences.target);
  const [result, setResult] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0),
    [copied, setCopied] = useState(false);
  const request = useRef(0),
    force = useRef(false);
  const number = /^\d+(?:[.,]\d{1,8})?$/.test(amount) ? Number(amount.replace(',', '.')) : NaN;
  const valid = Number.isFinite(number) && number >= 0 && number <= 1e12;
  useEffect(() => {
    const version = ++request.current;
    setResult(null);
    setError('');
    setCopied(false);
    setLoading(valid);
    if (!valid) return;
    if (from === to) {
      setResult({ value: number, rate: 1, identity: true });
      setLoading(false);
      return;
    }
    const fresh = force.current;
    force.current = false;
    const timer = setTimeout(() => {
      api
        .currencyQuote({ amount: number, from, to, refresh: fresh })
        .then((value) => {
          if (request.current === version) setResult(value);
        })
        .catch(() => {
          if (request.current === version) setError(t('launcherNext.fxError'));
        })
        .finally(() => {
          if (request.current === version) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      ++request.current;
    };
  }, [number, valid, from, to, refresh, t]);
  useEffect(() => {
    const update = () => {
      if (!document.hidden) setRefresh((n) => n + 1);
    };
    const timer = setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const copy = async () => {
    if (!result || loading || error) return;
    const version = request.current;
    try {
      await api.copyText(String(result.value));
      if (version === request.current) setCopied(true);
    } catch {
      if (version === request.current) setError(t('converter.copyError'));
    }
  };
  const names = new Intl.DisplayNames([locale], { type: 'currency' });
  const options = [...currencies].sort().map((code) => (
    <option key={code} value={code}>
      {code} · {names.of(code)}
    </option>
  ));
  return (
    <section
      className={'currency-converter ' + (compact ? 'compact' : '')}
      aria-label={t('converter.title')}
    >
      {!compact && (
        <header className="converter-page-heading">
          <span className="converter-page-icon">
            <Coins size={26} />
          </span>
          <div>
            <div className="eyebrow">{t('nav.currency')}</div>
            <h1 className="settings-title">{t('converter.title')}</h1>
            <p className="muted">{t('converter.body')}</p>
          </div>
        </header>
      )}
      {!compact && (
        <div className="currency-quick-pairs" role="group" aria-label={t('ux311.quickPairs')}>
          {preferences.pairs.map(([base, quote]) => (
            <span className="saved-currency-pair" key={base + quote}>
              <button
                key={base + quote}
                type="button"
                aria-pressed={from === base && to === quote}
                onClick={() => {
                  setFrom(base);
                  setTo(quote);
                }}
              >
                {base}
                <ArrowUpRight size={13} />
                {quote}
              </button>
              <button
                type="button"
                disabled={saving}
                aria-label={t('ux312.removePair', { pair: base + ' / ' + quote })}
                onClick={() =>
                  save({
                    ...preferences,
                    pairs: preferences.pairs.filter(
                      (pair) => pair[0] !== base || pair[1] !== quote,
                    ),
                  })
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {!compact && (
        <div className="currency-preferences">
          <button
            className="btn secondary"
            type="button"
            disabled={
              saving ||
              from === to ||
              preferences.pairs.length >= 12 ||
              preferences.pairs.some((pair) => pair[0] === from && pair[1] === to)
            }
            onClick={() => save({ ...preferences, pairs: [...preferences.pairs, [from, to]] })}
          >
            {t('ux312.addPair', { from, to })}
          </button>
          <label>
            {t('ux312.defaultCurrency')}
            <select
              value={preferences.target}
              disabled={saving}
              onChange={(event) => save({ ...preferences, target: event.target.value })}
            >
              {options}
            </select>
          </label>
          <small>{t('ux312.currencyHint', { target: preferences.target })}</small>
        </div>
      )}
      <div className="conversion-workbench">
        <div className="currency-form">
          <label>
            {t('converter.amount')}
            <input
              inputMode="decimal"
              aria-label={t('converter.amount')}
              value={amount}
              maxLength={24}
              aria-invalid={!valid}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="currency-pair">
            <label>
              {t('converter.from')}
              <select
                aria-label={t('converter.from')}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                {options}
              </select>
            </label>
            <button
              type="button"
              className="tool-btn currency-swap"
              aria-label={t('converter.swap')}
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
            >
              <ArrowLeftRight size={18} />
            </button>
            <label>
              {t('converter.to')}
              <select
                aria-label={t('converter.to')}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                {options}
              </select>
            </label>
          </div>
        </div>
        <div className="currency-quote-panel">
          {!compact && (
            <span className="currency-result-caption">{t('ux311.convertedAmount')}</span>
          )}
          <div className="currency-result" role="status" aria-live="polite" aria-busy={loading}>
            {!valid ? (
              t('converter.invalid')
            ) : loading ? (
              t('launcherNext.fxLoading')
            ) : result ? (
              <>
                <strong>
                  {new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(result.value)}{' '}
                  <span>{to}</span>
                </strong>
                <small className="currency-rate-equation">
                  1 {from} ={' '}
                  {new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(result.rate)}{' '}
                  {to}
                </small>
                <small>
                  {result.identity
                    ? t('converter.same')
                    : t('launcherNext.fxDate', { date: result.date })}
                  {result.cached ? ' · ' + t('launcherNext.fxCached') : ''}
                </small>
              </>
            ) : (
              <strong>
                — <span>{to}</span>
              </strong>
            )}
          </div>
          {error && (
            <p className="currency-error" role="alert">
              {error}
            </p>
          )}
          <div className="currency-actions">
            <button
              className="btn secondary"
              type="button"
              disabled={loading || !valid || from === to}
              onClick={() => {
                force.current = true;
                setRefresh((n) => n + 1);
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              {t('currency.refresh')}
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={!result || loading || !!error}
              onClick={copy}
            >
              <Copy size={14} />
              {t(copied ? 'converter.copied' : 'converter.copy')}
            </button>
          </div>
        </div>
      </div>
      <footer className="currency-disclaimer">
        <span>Frankfurter · {t('ux311.referenceRates')}</span>
        <small>{t('converter.reference')}</small>
      </footer>
    </section>
  );
}
