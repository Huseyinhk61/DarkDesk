import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Copy, RefreshCw } from 'lucide-react';
import { currencies } from '../../shared/currency';
import { api } from '../service';
import { usePreferences } from '../preferences';
import '../currency.css';
export default function CurrencyConverter({ compact = false }) {
  const { t, locale, language } = usePreferences();
  const [amount, setAmount] = useState('1'),
    [from, setFrom] = useState('USD'),
    [to, setTo] = useState(language === 'tr' ? 'TRY' : 'EUR');
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
  const copy = async () => {
    if (!result || loading) return;
    const version = request.current;
    try {
      await api.copyText(String(result.value));
      if (version === request.current) setCopied(true);
    } catch {
      if (version === request.current) setError(t('converter.copyError'));
    }
  };
  return (
    <section
      className={'currency-converter ' + (compact ? 'compact' : '')}
      aria-label={t('converter.title')}
    >
      {!compact && (
        <>
          <div className="eyebrow">{t('nav.currency')}</div>
          <h1 className="settings-title">{t('converter.title')}</h1>
          <p className="muted">{t('converter.body')}</p>
        </>
      )}
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
              {[...currencies].sort().map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="tool-btn"
            aria-label={t('converter.swap')}
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <ArrowLeftRight size={16} />
          </button>
          <label>
            {t('converter.to')}
            <select
              aria-label={t('converter.to')}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {[...currencies].sort().map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="currency-result" role="status" aria-live="polite">
        {!valid ? (
          t('converter.invalid')
        ) : loading ? (
          t('launcherNext.fxLoading')
        ) : result ? (
          <>
            <strong>
              {new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(result.value)}{' '}
              {to}
            </strong>
            <small>
              {result.identity
                ? t('converter.same')
                : t('launcherNext.fxDate', { date: result.date })}
              {result.cached ? ' · ' + t('launcherNext.fxCached') : ''}
            </small>
            <small>
              1 {from} ={' '}
              {new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(result.rate)} {to}
            </small>
          </>
        ) : null}
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
          <RefreshCw size={14} />
          {t('currency.refresh')}
        </button>
        <button
          className="btn secondary"
          type="button"
          disabled={!result || loading}
          onClick={copy}
        >
          <Copy size={14} />
          {t(copied ? 'converter.copied' : 'converter.copy')}
        </button>
      </div>
      <small className="muted currency-disclaimer">{t('converter.reference')}</small>
    </section>
  );
}
