import { CheckCircle2, AlertTriangle, FolderOpen, Undo2 } from 'lucide-react';
import { usePreferences } from '../preferences';

export default function OperationReceipt({ batch, onReveal, undo, busy, native }) {
  const { t, errorMessage } = usePreferences();
  if (!batch || batch.status === 'undone') return null;
  const done = batch.entries.filter(
    (item) => !['planned', 'undone'].includes(item.stage) && item.verified !== false,
  );
  const summary = batch.summary || {
    moved: done.filter((item) => item.stage === 'moved').length,
    copied: done.filter((item) => item.action !== 'shortcut' && item.stage === 'copied').length,
    shortcuts: done.filter((item) => item.action === 'shortcut').length,
    skipped: batch.skipped?.length || 0,
    failed: batch.error ? 1 : 0,
  };
  const directories = [...new Set(done.map((item) => item.target.replace(/[\\/][^\\/]+$/, '')))];
  const warning = batch.error || batch.warnings?.length;
  return (
    <section
      className={`operation-receipt ${warning ? 'with-warning' : ''}`}
      aria-label={t('receipt.title')}
    >
      <div className="receipt-heading">
        {warning ? <AlertTriangle size={21} /> : <CheckCircle2 size={21} />}
        <div>
          <h2>{t(batch.error ? 'receipt.partial' : 'receipt.title')}</h2>
          <p>{t('receipt.summary', summary)}</p>
        </div>
        <button className="btn secondary" disabled={!!busy || !batch.entries.length} onClick={undo}>
          <Undo2 size={15} />
          {t('receipt.undo')}
        </button>
      </div>
      {batch.error && <p className="warning-text">{errorMessage(batch.error)}</p>}
      {!!batch.warnings?.length && (
        <p className="receipt-warning">{t('receipt.cosmetic', { count: batch.warnings.length })}</p>
      )}
      <details>
        <summary>{t('receipt.folders', { count: directories.length })}</summary>
        {directories.map((directory, index) => (
          <div className="receipt-folder" key={directory}>
            <code>{directory}</code>
            <button
              className="text-btn"
              disabled={!native || !!busy}
              onClick={() => onReveal(batch.id, index)}
            >
              <FolderOpen size={16} />
              {t('receipt.open')}
            </button>
          </div>
        ))}
        {(batch.skippedDetails || []).map((item) => (
          <p key={item.id} className="receipt-skip">
            {item.id} · {errorMessage(item.code)}
          </p>
        ))}
        {(batch.warnings || []).map((item, index) => (
          <p key={index} className="receipt-skip">
            {item.id || item.path} · {errorMessage(item.code)}
          </p>
        ))}
      </details>
    </section>
  );
}
