# Değişiklikler

## 3.1.0 — 3 Kasım 2026

- Güvenilir indeks üzerinden orijinal `.exe` / `.lnk` ikonları; lazy yükleme ve sınırlı fingerprint önbelleği.
- Boyut, dosya tarihleri, Windows sürüm kaynağından açıklama/üretici ve DarkDesk başlatma günlüğü ile ayrıntı paneli.
- Sabit başlık çubuğu/sidebar, yalnızca ana içerikte kaydırma ve büyük pencere kontrol alanları.
- Temalara uygun daha belirgin kategori kenarlıkları, metinler ve ikon vurguları.
- Klavyeden kısayol kaydedici, yinelenen atama kontrolü, çalışan kayıtları koruyan global kısayol güncellemesi.
- Kayıt sırasında geçici kısayol duraklatma; iptal, odak kaybı ve zaman aşımında geri yükleme.
- Windows görünürlük çıktısında gecikmiş stdout ve parçalı UTF-8 okuma düzeltmesi.

## 3.0.0 — 3 Kasım 2026

- Özgün Hidden niteliğini koruyan odak profilleri; Windows toplu nitelik API’si ve Linux `.hidden` adaptörü.
- Global profil kısayolları, görünür kalacak özel dosya/klasör adları ve çıkış/kesinti kurtarması.
- Ayrı glassmorphism Spotlight penceresi, fuzzy arama, klavye navigasyonu, kontrollü native açma ve sistem komutları.
- Yerel kullanım sayacı ve yalnızca gözlenen altı aylık pasiflik için Arşiv önerileri.
- Varsayılan IDE, Veritabanı, DevOps, Terminal, Sürücüler, Ağ, Sıkıştırma, Sistem Araçları ve Kurulumlar alt grupları.
- RE2JS regex kuralları, istisna/izin listeleri ve ayarlanabilir tarama derinliği.
- Bilinmeyen adlar için çevrimdışı vektör tabanlı etiket önerileri; kullanıcı onayı ve benzerlik açıklaması.
- Kapalı başlayan arşiv/Downloads otomasyonları, kararlılık gecikmesi, geri alma ve geri alınan dosyayı yeniden işlememe.
- İç ve native sürükle-bırak; dış dosyalarda kontrollü önizleme.
- X ile tepsiye gizlenme, native sağ tık menüsü, sıradaki işi bekleyen güvenli çıkış.
- Profil değişiminin `ctime` etkisini dosya içeriği hash’iyle yeniden doğrulayan önizleme köprüsü.

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
