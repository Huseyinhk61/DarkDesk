import { ArrowRight, AlertTriangle, FolderCheck, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import { categories } from '../data';
import { formatBytes } from '../utils';
export default function PreviewModal({ plan, native, onClose, onConfirm }) {
  return (
    <Modal title="Son bir göz atalım." onClose={onClose}>
      <p>
        {plan.ready} öğe {plan.mode === 'move' ? 'taşınmaya' : 'kopyalanmaya'} hazır. Onayladığında
        aşağıdaki klasörler masaüstünde oluşturulacak.
      </p>
      {!native && (
        <div className="notice">
          <ShieldCheck size={17} />
          Demo modundasın. Gerçek dosyaların değişmeyecek.
        </div>
      )}
      <div className="preview-totals">
        <span>
          <FolderCheck size={18} />
          <b>{plan.ready}</b> hazır
        </span>
        <span>
          <b>{formatBytes(plan.bytes)}</b> toplam
        </span>
        <span className={plan.conflicts ? 'warning-text' : ''}>
          <AlertTriangle size={16} />
          {plan.conflicts} çakışma
        </span>
      </div>
      {plan.conflicts > 0 && (
        <div className="notice warning">
          Çakışan öğeler atlanacak. Mevcut dosyaların üzerine yazılmaz.
        </div>
      )}
      <div className="preview-entries">
        {plan.entries.map((entry) => (
          <div className={`preview-entry ${entry.conflict ? 'conflict' : ''}`} key={entry.id}>
            <div>
              <b>{entry.id}</b>
              <small title={entry.target}>
                {entry.conflict || `Masaüstü / ${categories[entry.category].folder}`}
              </small>
            </div>
            <span>{entry.conflict ? 'Atlanacak' : formatBytes(entry.size)}</span>
          </div>
        ))}
      </div>
      <div className="info-note">
        <ShieldCheck size={16} />
        İçerik doğrulanır. İşlem geçmişinden geri alabilirsin.
      </div>
      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>
          Vazgeç
        </button>
        <button className="btn primary" disabled={!plan.ready} onClick={onConfirm}>
          {plan.ready} öğeyi {plan.mode === 'move' ? 'taşı' : 'kopyala'}
          <ArrowRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
