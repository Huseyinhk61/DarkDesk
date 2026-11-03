# Windows’ta DarkDesk

## İlk kurulum

1. [Node.js 24 LTS](https://nodejs.org/) kur. Kurulumdan sonra PowerShell’i kapatıp yeniden aç.
2. [ZIP dosyasını indir](https://github.com/Huseyinhk61/DarkDesk/archive/refs/heads/main.zip) ve **Tümünü ayıkla** ile çıkar.
3. `DarkDesk-main` içinde `package.json` dosyasını bul. Adres çubuğuna `powershell` yazıp Enter’a bas.
4. Daha kolay açılış için `DarkDesk-Baslat.cmd` dosyasına çift tıklayabilirsin. Terminal kullanıyorsan `npm ci` çalıştır. Hatasız tamamlanınca `npm run desktop` çalıştır.

OneDrive masaüstü kullanıyorsan klasörün `C:\Users\...\OneDrive\Masaüstü` altında olabilir. DarkDesk gerçek dosya işlemleri için işletim sisteminin bildirdiği masaüstü yolunu kullanır; bu yolu ayarlardan görebilirsin.

## Sık karşılaşılan sorunlar

### `git is not recognized`

Git kurulu değil veya PATH’te yok. ZIP yöntemini kullanabilirsin. Git kullanmak istersen [Git for Windows](https://git-scm.com/downloads/win) kur ve terminali yeniden aç.

### `ENOENT ... package.json` veya `npm ci` için kilit dosyası hatası

Yanlış klasördesin. Şunu çalıştır:

```powershell
Get-Location
Test-Path .\package.json
Test-Path .\package-lock.json
```

Son iki komut `True` dönmeli. `False` ise `package.json` bulunan klasöre geç. ZIP içindeki dosyaları çıkarmadan çalıştırma. Başarısız `cd` komutundan sonra kurulum komutlarına devam etme.

### PowerShell `npm.ps1 cannot be loaded` hatası

Sistem yürütme politikasını değiştirmeden `.cmd` uzantılı komutu kullan:

```powershell
npm.cmd ci
npm.cmd run desktop
```

### Node sürümü uyumsuz

```powershell
node --version
npm --version
```

Node.js 24 LTS önerilir; asgari sürüm 22.12.0’dır. Eski Node ile kurulmuş bağımlılıklar için sürümü güncelledikten sonra proje klasöründe yeniden `npm ci` çalıştır.

### Electron indirme / ağ hatası

İlk kurulum npm kayıt sunucusuna ve Electron’un GitHub sürüm dosyalarına erişim gerektirir. Bağlantını ve kurum ağının proxy/CA ayarlarını kontrol et. TLS/sertifika doğrulamasını kapatma. Bağlantı düzeldiğinde proje klasöründe `npm ci` komutunu yeniden çalıştır.

### `Port 5173 is already in use`

Daha önce açtığın DarkDesk/Vite terminalinde `Ctrl+C` ile durdurup `npm run desktop` komutunu yeniden çalıştır. Başka bir projeye ait sunucuyu kapatmak istemiyorsan geliştirme sunucusuna ihtiyaç duymayan `npm run desktop:preview` kullan.

### Dosya taşıma başarısız / OneDrive dosyası çevrimdışı

Dosyanın başka bir uygulamada açık olmadığını ve yerelde erişilebilir olduğunu kontrol et. OneDrive kullanıyorsan ilgili dosya için **Her zaman bu cihazda tut** seçeneğini kullanabilirsin. Önizleme çakışan hedefleri atlar. Yarım kalan bir işlem varsa geçmişi kontrol et; yeniden düzenlemeden önce tamamlanan adımları geri al.

### Geri alma duruyor

DarkDesk, hedef dosya düzenlenmişse veya orijinal konumda yeni bir dosya oluşmuşsa üzerine yazmaz. Her iki konumu Explorer’dan kontrol et. Yeni dosyalarını ayrı bir yere yedekledikten sonra çakışmayı çöz ve geri almayı yeniden dene. `history.json` dosyasını silmek dosyaları geri taşımaz; kurtarma kaydını kaybetmemek için bu dosyayı koru.

## Güncelleme

Git ile indirdiysen, yerel kod değişikliklerini koruyarak:

```powershell
git pull --ff-only
npm ci
npm run desktop
```

ZIP ile indirdiysen yeni ZIP’i farklı bir klasöre çıkarıp aynı kurulum adımlarını uygula. `npm ci` yalnızca projenin bağımlılıklarını kurar; masaüstü dosyalarını taşımaz.

## Hazır EXE paketi

[Windows Installer](https://github.com/Huseyinhk61/DarkDesk/actions/workflows/windows.yml) iş akışındaki başarılı çalışmadan **Artifacts → DarkDesk-Windows** arşivini indir. Arşivde kurulum ve portable sürümlerle `SHA256SUMS.txt` bulunur. `main` güncellemeleri derlemeyi otomatik başlatır. Gerekirse depo sahibi **Run workflow** ile de başlatabilir. `v*` etiketiyle yayımlanan sürümler varsa ayrıca [Releases](https://github.com/Huseyinhk61/DarkDesk/releases) sayfasında görünür.

İndirdiğin EXE özetini kontrol etmek için:

```powershell
Get-FileHash .\DarkDesk-Setup-2.0.0.exe -Algorithm SHA256
```

Sonucu aynı paketteki `SHA256SUMS.txt` ile karşılaştır. Paket şu aşamada kod imzalı değildir; Windows yayıncı uyarısı gösterebilir.

## Tema, dil, gruplar ve sistem taraması (2.0)

- **Otomasyon & Ayarlar → Görünüm & dil** üzerinden tema, Türkçe/İngilizce ve ikon paketini seç. Değişiklikler cihazda kalır.
- **Kategoriler & Kurallar** bölümünde grupları, alt grupları ve eşleştirme kurallarını yönet. Manuel dosya atamaları kurallardan önceliklidir.
- **Sistem Tarama** masaüstünün yanında Program Files, iki Başlat Menüsü ve App Paths/Uninstall kayıtlarından uygulama keşfi yapar. Erişilemeyen alanlar atlanır ve bildirilir. Kayıt defteri değiştirilmez.
- Kurulu `.exe` dosyaları orijinal konumunda kalır. Onayladığında kategori klasöründe `.lnk` oluşturulur; geri alma bu kısayolu kaldırır.
- Seçilen ikon, yeni kısayollara uygulanır. Windows’ta yeni kategori klasörlerinde `desktop.ini` ve `.darkdesk.ico` kullanılır. Explorer ikon önbelleği nedeniyle görüntü gecikebilir; klasörü yenilemeyi dene. Mevcut kategori klasörlerine ve dosya ikonlarına geriye dönük müdahale edilmez.
- Sürüme geçişte eski taşı/kopyala ayarı ve kategori atamaları korunur. Eski işlem geçmişi geri alınabilir. Dil değiştirmek klasörleri yeniden adlandırmaz.
