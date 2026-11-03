<div align="center">
  <img src="docs/assets/banner.svg" alt="DarkDesk — Her şey yerli yerinde." width="100%" />
  <br /><br />
  <a href="https://github.com/Huseyinhk61/DarkDesk/actions/workflows/ci.yml"><img src="https://github.com/Huseyinhk61/DarkDesk/actions/workflows/ci.yml/badge.svg?branch=main" alt="Test & Build" /></a>
  <img src="https://img.shields.io/badge/Electron-45-9b8ae6?logo=electron&amp;logoColor=white" alt="Electron 45" />
  <img src="https://img.shields.io/badge/React-19-7fa8df?logo=react&amp;logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Tailwind-4-72b8b8?logo=tailwindcss&amp;logoColor=white" alt="Tailwind CSS 4" />
  <br /><br />
  <strong>Masaüstünü sadeleştir. Odağını geri kazan.</strong>
  <p>Dosya ve kısayollarını analiz eden, gerçek klasörlere düzenleyen,<br />her adımda kontrolü sana bırakan yerel masaüstü uygulaması.</p>
  <a href="#-hızlı-başlangıç">Başlangıç</a> ·
  <a href="#-neler-yapabilirsin">Özellikler</a> ·
  <a href="docs/WINDOWS.md">Windows rehberi</a> ·
  <a href="https://github.com/Huseyinhk61/DarkDesk/actions/workflows/windows.yml">Windows paketi</a> ·
  <a href="https://github.com/Huseyinhk61/DarkDesk/issues">Hata bildir</a>
  <br /><br />
  <img src="docs/assets/workspace.png" alt="DarkDesk çalışma alanı: beş renkli akıllı kategori ve dosya kontrol kartları" width="100%" />
  <sub>Web önizlemesinden gerçek ekran görüntüsü. Örnek veriler kullanılır.</sub>
</div>

## ✦ Neler yapabilirsin?

| Özellik                       | Nasıl çalışır?                                                                                                                                                              |
| :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Akıllı kategoriler**        | Yazılım, tasarım, oyun, ofis ve sistem araçları için dosya adı/uzantısı analizi. Windows `.lnk` hedefleri de değerlendirilir.                                               |
| **Gerçek masaüstü düzenleme** | Seçtiğin öğeler, işletim sisteminin masaüstü konumunda oluşturulan gerçek klasörlere taşınır veya kopyalanır. OneDrive ile yönlendirilmiş masaüstü için OS yolu kullanılır. |
| **Önce önizleme**             | Her öğenin hedefini, toplam boyutu ve isim çakışmalarını onaydan önce gör. Çakışmalar atlanır; var olan dosyaların üzerine yazılmaz.                                        |
| **Geri alınabilir işlemler**  | Kalıcı işlem günlüğü, SHA-256 içerik kontrolü ve son işlemden başlayarak geri alma. Uygulamayı kapatıp açtığında da geçmiş korunur.                                         |
| **Sana göre kategoriler**     | Dosya kartından hedef grubu değiştir. Tercihin sonraki taramalarda hatırlanır.                                                                                              |
| **Canlı masaüstü takibi**     | Dosyalar eklendiğinde/kaldırıldığında liste otomatik yenilenir. Onayın olmadan taşıma yapılmaz.                                                                             |
| **Hızlı çalışma alanı**       | Arama, kategori ve dosya türü filtreleri, ad/boyut/tarih sıralaması, kart/liste görünümü, görünen öğeleri toplu seçme.                                                      |
| **Kalıcı ayarlar**            | Taşı/kopyala seçimi, canlı takip, hariç tutulacak uzantılar ve kategori tercihleri bu cihazda saklanır.                                                                     |
| **Yerel ve hesapsız**         | Dosya işlemleri için hesap, API anahtarı veya bulut servisi gerekmez.                                                                                                       |

## 🚀 Hızlı başlangıç

**Gerekenler:** [Node.js 24 LTS](https://nodejs.org/) ve grafik masaüstü ortamı. Node.js 22.12+ da desteklenir. Windows ilk hedef platformdur; Linux için paketleme komutu da bulunur.

### Git kurmadan

1. **[Kaynak kodu ZIP olarak indir](https://github.com/Huseyinhk61/DarkDesk/archive/refs/heads/main.zip)** ve **Tümünü ayıkla** ile çıkar.
2. Çıkan `DarkDesk-main` klasörünü aç. İçeride **`package.json`** dosyasını gördüğünden emin ol.
3. Windows Dosya Gezgini adres çubuğuna `powershell` yazıp Enter’a bas.
4. İstersen **`DarkDesk-Baslat.cmd` dosyasına çift tıkla**; ilk bağımlılık kurulumunu ve açılışı yapar. Terminalle ilerlemek için sırayla çalıştır:

```powershell
npm ci
npm run desktop
```

> Komutları kullanıcı ana klasöründe veya ZIP’in içinde çalıştırma. Kurulum hata verirse ikinci komuta geçmeden [Windows sorun giderme rehberine](docs/WINDOWS.md) bak. İlk kurulum Electron’u indirdiği için internet gerektirir.

### Git ile

```powershell
git clone https://github.com/Huseyinhk61/DarkDesk.git
cd DarkDesk
npm ci
npm run desktop
```

### Yalnızca arayüzü denemek için

```sh
npm run dev
```

Vite’ın terminalde gösterdiği adresi aç. **Web modu örnek verilerle çalışır; gerçek masaüstü dosyalarına erişmez.** Gerçek işlemler için `npm run desktop` kullanılır. Web modundaki pencere kontrolleri bu nedenle devre dışıdır.

## 🗂️ Düzenleme akışı

1. **Tara:** Masaüstündeki dosyalar ve kısayollar listelenir. Alt klasörlerin içi taranmaz.
2. **Gözden geçir:** Kategorileri düzenle, taşı/kopyala yöntemini ayarlardan seç, istenmeyen öğelerin seçimini kaldır.
3. **Önizle:** Hedefleri, toplam boyutu ve atlanacak çakışmaları gör.
4. **Onayla:** Yalnızca çakışmasız seçili dosyalar işlenir. İlerleme gösterilir.
5. **Geri al:** Kontrol panelindeki **Geri al** veya ayarlardaki işlem geçmişini kullan.

<div align="center">
  <img src="docs/assets/preview.png" alt="Onay öncesi dosya hedeflerini ve çakışmaları gösteren düzenleme önizlemesi" width="90%" />
</div>

**Kısayol:** `Ctrl+K` / `⌘+K` aramaya odaklanır. `Esc` önizlemeyi kapatır. `Tab` ile diyalog içinde dolaşılabilir.

## 🛡️ Dosyaların nasıl korunuyor?

- Renderer’da Node.js erişimi kapalıdır; sandbox ve context isolation açıktır. Dosya işlemleri yalnızca sınırlı, ana pencereye ait IPC çağrıları üzerinden çalışır.
- İşlem öncesi kaynakların hâlâ aynı dosya olduğu kontrol edilir. Önizlemeler tek kullanımlıktır ve beş dakika sonra geçersiz olur.
- Kopyalar içerik özetiyle doğrulanır. Taşıma sırasında kaynak ancak doğrulama sonrasında kaldırılır.
- Geri alma, hedef içeriği değişmişse veya orijinal konumda başka bir dosya varsa durur. Kullanıcının yeni verisinin üzerine yazılmaz.
- Dosya işlemleri sıraya alınmaz; aynı anda ikinci değiştirme işlemi reddedilir. Uygulama tek örnek olarak çalışır.
- Gizli dosyalar, sembolik bağlantılar ve alt klasörler kapsam dışıdır. Hedef kategori klasörünün sembolik bağlantıyla değiştirilmesi reddedilir.
- Karttaki dış bağlantı düğmesi dosyayı Explorer/Finder’da **gösterir**; `.exe` veya kısayol çalıştırmaz.

İşlem geçmişi `history.json`, tercihler `settings.json` dosyasında, Electron kullanıcı verisi dizininde tutulur (Windows’ta genellikle `%APPDATA%\DarkDesk` veya geliştirme sürümünde `%APPDATA%\darkdesk`). Uygulama internet API’sine dosya listesi göndermez. Sisteminizin OneDrive gibi mevcut senkronizasyonu kendi ayarlarıyla çalışmaya devam eder.

**Sınırlar:** Çok dosyalı işlemler tüm işletim sistemi için atomik değildir. Güç kesintisi veya başka bir uygulamanın eşzamanlı değişikliği durumunda günlük üzerinden kurtarma denenir; sahipliği kesinleştirilemeyen hedeflerde otomatik silme yerine elle kontrol istenir. Bir yedekleme uygulamasının yerini tutmaz. Public/ortak masaüstü taranmaz. `.lnk` kopyalama mevcut kısayolu kopyalar; yeni kısayol üretmez. Kategori analizi yerel kurallara dayanır; bir çevrimiçi AI servisi kullanılmaz.

## 📦 Windows kurulum paketi

GitHub Actions içindeki **[Windows Installer](https://github.com/Huseyinhk61/DarkDesk/actions/workflows/windows.yml)** iş akışı:

- `DarkDesk-Setup-1.1.0.exe`: Kurulum sihirbazı ve masaüstü kısayolu.
- `DarkDesk-Portable-1.1.0.exe`: Kurulum gerektirmeyen sürüm.
- `SHA256SUMS.txt`: İndirilen dosyaları doğrulamak için özetler.

`main` dalına gönderilen güncellemeler Windows paketini otomatik oluşturur. Depo sahibi ayrıca **Run workflow** ile derlemeyi başlatabilir. Başarılı çalışmanın **Artifacts → DarkDesk-Windows** bölümünden paket indirilir. `v*` etiketi gönderildiğinde testlerden geçen paketler GitHub Releases’e eklenir. **İş akışı başarıyla tamamlanmadan hazır bir EXE bulunduğunu varsayma.**

Windows’ta kendin paketlemek için:

```powershell
npm run dist:win
```

Çıktılar `release/` klasörüne yazılır. Paketler şu aşamada kod imzalı değildir; Windows SmartScreen yayıncı uyarısı gösterebilir. Linux AppImage için `npm run dist:linux` kullanılabilir. macOS için imzalı/noter onaylı dağıtım henüz hazırlanmadı.

## 🧪 Geliştirme ve test

| Komut                     | İşlev                                                   |
| :------------------------ | :------------------------------------------------------ |
| `npm run dev`             | Vite ile web demosu                                     |
| `npm run desktop`         | Geliştirme sunucusu + Electron                          |
| `npm run desktop:preview` | Üretim derlemesini Electron’da aç                       |
| `npm run build`           | Üretim arayüzünü derle                                  |
| `npm test`                | Gerçek, geçici dosya sisteminde servis ve ayar testleri |
| `npm run test:e2e`        | Playwright ile tarayıcı akışları                        |
| `npm run test:desktop`    | İzole masaüstü üzerinde üretim Electron + IPC testi     |
| `npm run check`           | Servis testleri + derleme + tarayıcı testleri           |
| `npm run format`          | Kaynakları Prettier ile biçimlendir                     |

Tarayıcı testinden önce bir kez:

```sh
npx playwright install chromium
npm run check
```

Linux CI’de Electron testi için `xvfb-run -a npm run test:desktop` gerekir. Tüm testler geçici klasörler kullanır; test kullanıcısının gerçek masaüstüne dokunmaz. Playwright raporu `playwright-report/` altına yazılır.

Dağıtım bağımlılıklarında bilinen açık bulunmadı (`npm audit --omit=dev`). Tam araç zinciri denetiminde paketleyicinin geçişli geliştirme bağımlılıklarında orta seviye bildirimler bulunuyor; bunlar için eski bir paketleyici sürümüne otomatik düşürme yapılmadı.

**v1.1 yerel doğrulaması:** 28 servis/ayar testi, 10 Chromium arayüz testi, üretim derlemesi ve Linux sanal ekranında gerçek Electron/IPC testi geçti. Windows’a özgü test ve EXE oluşturma ayrıca GitHub Actions üzerinde tanımlıdır; sonuçları üstteki canlı test rozetinden ve Actions sayfasından takip edilebilir.

<details>
<summary><strong>Proje yapısı</strong></summary>

```text
electron/
  main.cjs            Pencere, sınırlı IPC ve masaüstü takibi
  preload.cjs         Renderer için dar yetkili köprü
  service.cjs         Tarama, önizleme, SHA-256, işlem günlüğü ve geri alma
  settings.cjs        Doğrulanan kalıcı kullanıcı tercihleri
src/
  components/         Sidebar, Header, CategoryGrid, ItemCard, Settings, PreviewModal
  App.jsx             Çalışma alanı ve işlem akışları
  service.js          Native köprü / etkileşimli web demosu
  styles.css          Tailwind + duyarlı koyu tema
scripts/              Electron smoke testi ve ekran görüntüsü aracı
tests/                Playwright senaryoları ve izole Electron test giriş noktası
.github/workflows/    Windows/Linux testleri ve Windows EXE paketleme
```

</details>

## 🤝 Katkıda bulun

Bir hata bulduğunda [issue aç](https://github.com/Huseyinhk61/DarkDesk/issues): işletim sistemi, Node.js sürümü, yaptığın işlem ve hata metnini ekle. Kişisel dosya içeriklerini veya gizli bilgileri paylaşma. Geliştirmeden önce [katkı rehberine](CONTRIBUTING.md) göz at.

---

<div align="center"><sub>Daha sade bir masaüstü, daha net bir zihin. · <strong>DarkDesk</strong></sub></div>
