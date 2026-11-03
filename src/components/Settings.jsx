import { useEffect, useState } from 'react';
import {
  Settings2,
  History,
  ShieldCheck,
  Undo2,
  Check,
  Save,
  Radio,
  Folder,
  RotateCcw,
} from 'lucide-react';
import { canUndo } from '../utils';
const labels = {
  completed: 'Tamamlandı',
  interrupted: 'Yarım kaldı',
  running: 'Kesinti / kontrol gerekli',
  undoing: 'Geri alma yarım kaldı',
  undone: 'Geri alındı',
};
export default function Settings({ settings, onSave, stats, history, undo, busy }) {
  const [draft, setDraft] = useState(settings);
  const [extensions, setExtensions] = useState(settings.excludedExtensions.join(', '));
  const [error, setError] = useState('');
  useEffect(() => {
    setDraft(settings);
    setExtensions(settings.excludedExtensions.join(', '));
  }, [settings]);
  const submit = async (event) => {
    event.preventDefault();
    const list = extensions
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((x) => (x.startsWith('.') ? x.toLowerCase() : '.' + x.toLowerCase()));
    if (list.some((x) => !/^\.[a-z0-9]{1,12}$/i.test(x))) {
      setError('Uzantıları .tmp, .ini biçiminde, virgülle ayırarak girin.');
      return;
    }
    setError('');
    await onSave({ ...draft, excludedExtensions: [...new Set(list)] });
  };
  return (
    <>
      <div className="eyebrow">KONTROL SENDE</div>
      <h1 className="settings-title">Senin masaüstün, senin kuralların.</h1>
      <p className="muted">
        Tercihlerin bu cihazda saklanır. Yeniden açtığında kaldığın yerden devam et.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={!!busy}>
          <section className="settings-panel">
            <h2>
              <Settings2 size={20} /> Düzenleme yöntemi
            </h2>
            <div role="radiogroup" aria-label="Düzenleme yöntemi">
              {[
                [
                  'move',
                  'Dosyaları taşı',
                  'Dosyalar kategori klasörlerine taşınır; masaüstündeki orijinal konumdan kaldırılır.',
                ],
                [
                  'copy',
                  'Dosyaları kopyala',
                  'Orijinaller masaüstünde kalır. Kategori klasörüne bir kopya eklenir.',
                ],
              ].map(([id, title, desc]) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={draft.mode === id}
                  className={`mode-option ${draft.mode === id ? 'chosen' : ''}`}
                  key={id}
                  onClick={() => setDraft({ ...draft, mode: id })}
                >
                  <span className="radio">{draft.mode === id && <span />}</span>
                  <div>
                    <b>{title}</b>
                    <p>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="info-note">
              <ShieldCheck size={18} />
              Her işlemden önce onayını alırız. Mevcut dosyaların üzerine yazılmaz.
            </div>
            <h2>
              <Radio size={19} /> Canlı masaüstü takibi
            </h2>
            <label className="toggle-setting">
              <span>
                <b>Dosyalar değiştiğinde listeyi yenile</b>
                <small>Yalnızca tarar. Onayın olmadan dosya taşımaz.</small>
              </span>
              <input
                type="checkbox"
                checked={draft.autoScan}
                onChange={(e) => setDraft({ ...draft, autoScan: e.target.checked })}
              />
              <span className="switch" />
            </label>
            <label className="field-label" htmlFor="extensions">
              Taramadan hariç tutulacak uzantılar
            </label>
            <input
              className="settings-input"
              id="extensions"
              placeholder=".ini, .tmp"
              value={extensions}
              onChange={(e) => setExtensions(e.target.value)}
            />
            <p className="muted">
              Gizli dosyalar, klasörler ve sembolik bağlantılar her zaman dışarıda kalır.
            </p>
            <h2>Masaüstü konumu</h2>
            <code className="desktop-path">{stats?.desktop || 'Yükleniyor…'}</code>
            <div className="settings-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setDraft({ ...draft, overrides: {} })}
              >
                <RotateCcw size={15} />
                Kategori tercihlerini sıfırla
              </button>
              <button className="btn primary" type="submit">
                <Save size={15} />
                Ayarları kaydet
              </button>
            </div>
            {error && (
              <p role="alert" className="warning-text">
                {error}
              </p>
            )}
          </section>
        </fieldset>
      </form>
      <section className="settings-panel" id="history">
        <div className="history-heading">
          <h2>
            <History size={20} />
            İşlem geçmişi <span className="count-badge">{history.length}</span>
          </h2>
          <button className="btn secondary" disabled={!canUndo(history) || !!busy} onClick={undo}>
            <Undo2 size={15} />
            Son işlemi geri al
          </button>
        </div>
        {history.length ? (
          <div className="history-list">
            {[...history].reverse().map((batch) => (
              <div className="history-row" key={batch.id}>
                <span className={`history-icon ${batch.status === 'undone' ? 'done' : ''}`}>
                  {batch.status === 'undone' ? <Check size={18} /> : <Folder size={18} />}
                </span>
                <span>
                  <b>
                    {batch.entries.filter((e) => e.stage !== 'planned').length} öğe ·{' '}
                    {batch.mode === 'move' ? 'Taşıma' : 'Kopyalama'}
                  </b>
                  <small>
                    {new Date(batch.date).toLocaleString('tr-TR')}
                    {batch.skipped?.length > 0 && ` · ${batch.skipped.length} öğe atlandı`}
                  </small>
                  {batch.error && <small className="warning-text">{batch.error}</small>}
                </span>
                <span
                  className={`status-badge ${batch.status === 'undone' ? 'success' : batch.error ? 'warning' : ''}`}
                >
                  {labels[batch.status] || 'Tamamlandı'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Henüz bir düzenleme yapılmadı. İlk işlemin burada görünecek.</p>
        )}
        <p className="muted history-note">
          Geri alma en son aktif işlemden başlar. Değiştirilmiş dosyalar veya dolu orijinal konumlar
          varsa işlem güvenle durur.
        </p>
      </section>
    </>
  );
}
