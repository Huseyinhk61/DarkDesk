# Değişiklikler

## 2.0.0 — 3 Kasım 2026

- Program Files, Başlat Menüsü, App Paths ve kayıtlı kurulum konumları için salt okunur, durdurulabilir tarayıcı; Linux uygulama dizinleri desteği.
- Kurulu uygulamaları taşımadan kategori klasörlerine native kısayol oluşturma ve geri alma.
- Dinamik kategori/alt grup yönetimi, güvenli klasör adları, döngü ve çakışma doğrulaması.
- Ad/hedef metni ve uzantı kuralları; sıralama, düzenleme, etkinleştirme/devre dışı bırakma.
- Midnight Dark, Cyberpunk Neon ve açık Minimal Slate; CSS değişkenleri ve kalıcı tercihler.
- Lucide, Tabler ve Minimalist ikon setleri; kategori/öğe seçimi ve 36 native klasör ikonu.
- Türkçe/İngilizce JSON sözlükleri; menü, ayar, durum, hata ve bildirim çevirileri.
- Sağ altta geri alınabilir bildirimler, resimli boş durumlar, CSS animasyonları ve azaltılmış hareket desteği.
- Eski ayarlar için kategori kimliği göçü; eski ve yeni hedefleri koruyan işlem günlüğü.
- 48’lik kademeli kart yükleme, tarama sınırları ve erişim uyarıları.

## 1.1.0 — 3 Kasım 2026

### Yeni

- Dosya bazında hedef, boyut ve çakışma gösteren onay önizlemesi.
- Kaydedilen taşı/kopyala tercihi, kategori atamaları, hariç tutulan uzantılar ve canlı tarama ayarı.
- Windows kısayol hedeflerini okuma, dosya boyutu/tarih sıralaması ve dosya/kısayol filtreleri.
- Masaüstü değişikliklerinde otomatik liste yenileme; onaysız taşıma yapılmaz.
- Kalıcı, durum bilgili işlem geçmişi ve yeniden başlatma sonrası geri alma.
- ZIP indiren Windows kullanıcıları için klasörü otomatik seçen çift tıklamalı başlatıcı.
- Windows NSIS kurulum ve portable EXE paketleme iş akışı; uygulama simgeleri.
- Windows/Linux test otomasyonu, Chromium arayüz testleri ve gerçek Electron/IPC smoke testi.
- Ekran görüntüleri, Windows kurulum/sorun giderme rehberi ve katkı rehberi.

### Düzeltilenler

- Geri alma yalnızca boyut ve tarih yerine SHA-256 içerik doğrulaması kullanır.
- Kesinti sonrası kopyalama, taşıma ve geri yükleme aşamaları ayrı kaydedilir.
- Çakışan dosyalar üzerine yazılmadan atlanır; onaydan sonra değişen kaynak/hedef kontrol edilir.
- Filtrelenmiş görünümde toplu seçim yalnızca görünen öğelere uygulanır.
- Renderer’dan dosyayı çalıştırmak yerine Explorer/Finder’da gösterme kullanılır.
- IPC çağrıları ana pencere/çerçeve ile sınırlandırıldı; izin istekleri ve yeni pencere açma reddedildi.
- Önizleme için odak yönetimi, Tab çevrimi ve Escape desteği eklendi.

## 1.0.0

React, Tailwind CSS ve Electron ile ilk çalışma alanı, dosya kategorileri, temel taşı/kopyala ve geri alma akışı.
