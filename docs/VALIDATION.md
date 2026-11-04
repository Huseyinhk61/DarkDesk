# DarkDesk 3.4.1 doğrulama raporu

Tarih: 4 Kasım 2026. Yerel doğrulama ortamı: Linux, Node.js 24, Electron 45, Chromium ve Xvfb.

| Kontrol                             | Sonuç                                                                                                                                          |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                          | 156 servis/model/ayar testi geçti; başarısız veya atlanan test yok.                                                                            |
| `npm run build`                     | Üretim React/Tailwind derlemesi geçti.                                                                                                         |
| `npm run test:e2e`                  | 67 Chromium senaryosu geçti.                                                                                                                   |
| `npm run test:desktop`              | İzole gerçek Electron/IPC testi geçti.                                                                                                         |
| Linux `electron-builder --dir`      | Uygulama dizini ve ASAR oluşturuldu. Bu kontrol AppImage veya Windows EXE üretildiği anlamına gelmez.                                          |
| Paketlenmiş ASAR’dan Electron testi | Paylaşılan ESM/JSON modülleri, preload, tarayıcı, ikon dosyaları ve renderer paket içinden çalıştı.                                            |
| Paket içeriği                       | Native ikonlar, runtime/profil/otomasyon modülleri, dil sözlükleri ve RE2 regex bağımlılığı mevcut; test giriş noktaları dağıtıma dahil değil. |
| `npm audit --omit=dev`              | Dağıtım bağımlılıklarında bilinen açık raporlanmadı.                                                                                           |

## 3.4.1 gizli depo ve EXE doğrulaması

7 erişim deposu ve 8 özel güncelleme bağlayıcısı testi; şifreli yazma/okuma, bozuk dosya, sembolik bağlantı, anahtarsız istek engeli, kimlik bilgisi değiştirme/silme, yeniden denetim zorunluluğu ve durumlarda anahtar sızıntısı olmamasını kontrol eder. İki UI testi parola alanının kayıttan sonra temizlenmesini ve erişim silinince denetimin kapanmasını doğrular. Windows DPAPI uygulaması Electron `safeStorage` API'sidir; bu Linux oturumunda gerçek kullanıcı anahtarıyla GitHub isteği veya Windows yükseltme çalıştırılmadı.

Windows Setup ve Portable **3.4.1** EXE dosyaları Linux üzerinde çapraz derlendi. Resmî electron-builder `UninstallerReader` yardımcısı, geçici NSIS uninstaller üretimi için kullanıldı; uygulama üretim kaynaklarına bunun için değişiklik yapılmadı. İki EXE'nin `7zz t` NSIS arşiv bütünlük kontrolü geçti. `verify-windows-release.cjs` sürüm, boyut ve SHA-512 değerlerini, blockmap'i ve token içermeyen `private: true` güncelleme yapılandırmasını doğruladı. Bunlar canlı Windows kurulumu testinin yerine geçmez.

- Setup: 128.245.857 bayt; SHA-256 `bb1cbafffc41adc0b32d647f5f7065ea64c4f4f483ad9f41c307c843667f2af1`.
- Portable: 114.613.163 bayt; SHA-256 `b3fca2637eb6880192259afa264489990b07ade14064318994008cb38b7d4e47`.

## 3.4 kapsamı

Tarama testleri üç kaynağı ayrı ayrı seçip tarar; kurulular görünümünden masaüstüne ve indirilenlere geri dönüldüğünde farklı koleksiyonlar korunur. Filtre temizliği, kaynak okuma hatası ve gecikmiş sonuç koruması test edilir. Native Electron testi aynı geçişleri gerçek geçici Desktop/Downloads/Program Files dizinleriyle uygular.

Görünüm ve grup servis testleri yeni tema/font/ikon tercihlerini, 60 ICO kaynağını, schema4 grup geçişini, silinmiş grupların korunmasını ve eski geçmişin geri alınmasını kapsar. Yeni varsayılan Alt+X ve kayıtlı özel tuşun korunması ayrıca doğrulandı.

Güncelleme servisi enjekte edilmiş `electron-updater` adaptörüyle kontrol edildi: eşzamanlı istekler, tek sürüm bildirimi, açık indirme, checksum hatası, erişilemeyen kaynak, kurulum sıralaması, dosya işi sırasında erteleme ve kurulum başlatma hatasından toparlanma. UI testleri indirme/ilerleme/yeniden başlatma ve portable sınırlarını kapsar. **Gerçek bir Windows makinede eski sürümden yeni sürüme kurulum bu Linux oturumunda uygulanmadı.** GitHub Release görünürlüğü ve uzaktaki iş sonucu bu ortamda doğrulanamadı (web/API erişimleri 404/403 döndü).

## 3.3 kapsamı

Dosya sistemi regresyonları klasör ikonu/attrib hatasını, tarih ayarı hatasını, kritik günlük hatasını ve kaynak silme izni reddini enjekte ederek gerçek geçici dosyalarda taşıma/geri almayı kontrol eder. Bozuk hedef checksum testi başarının yanlış sayılmasını engeller. Yeni kısayolların kaynak executable ikonunu/argümanlarını koruduğu ve `.lnk`/`.url` dosyalarının kopyalanırken değişmediği test edilir.

Windows ikon servisi sabit PowerShell ve Windows kaynak API'leriyle uygulanmıştır. Yerel testlerde custom ikon önceliği, `.url` UTF-16 okuması, kaynak fingerprint'i, PNG doğrulaması ve sınırlı process iletişimi enjekte edilmiş adaptörlerle doğrulandı. **Bu Linux oturumunda canlı Windows ikon çıkarımı yapılmadı.** GitHub Actions Windows Electron dalına gerçek Electron executable'ına işaret eden `.lnk` üzerinden `windows-native` PNG çıkarma kontrolü eklendi; uzak işin başarı durumu bu rapordan çıkarılamaz.

Kullanım kataloğu 82 tanımlı uygulama içerir. Testler ortak başlatıcılar, kısayol etiketleri, yanlış belge eşleşmesi, manuel kural önceliği ve belirsizlik etiketlerini kapsar. Açıklamalar uzaktan üretilmez; adı taklit edilmiş bir dosyanın kimliği veya üreticisi doğrulanmış sayılmaz.

Yeni UI senaryoları 1366×768 ekranda koleksiyonun başlangıcını, küçük pencerede %130 metni, opak başlatıcıyı, açıklama panelini, manuel ikon yenilemeyi ve gerçek aksiyon sayılarıyla işlem sonucunu doğrular. Gerçek Electron ve ASAR testleri izole masaüstünde taşı/geri al ve sonuç panelini de kontrol etti.

## 3.2 kapsamı

Vite izleyicisi dağıtım çıktıları, test raporları ve dokümanları dışarıda bırakır. Bu dosyaların yazılması sırasında geliştirme görünümünün sıfırlanmasına yol açan yenileme giderilmiştir.

Yeni servis testleri 7 palet ve Sistem Teması için kalıcılığı, eski ayarlara görünüm varsayılanlarının eklenmesini, geçersiz görünüm değerlerinin reddini ve ana metin tokenlarının taban yüzeylerde kontrastını doğrular. Bu, tüm ekranların bir erişilebilirlik standardına göre sertifikalandırılması anlamına gelmez.

Pencere geometrisi testleri kaldırılan monitörü, negatif koordinatlı ekranları, küçük çalışma alanını, bozuk kayıtları ve sıralı kalıcı yazmayı kapsar. Gerçek Electron testi pencere durumu IPC'sini ve çıkışta kayıt dosyasını kontrol eder; fiziksel monitör çıkarma testi yapılmadı.

Arayüz senaryoları yeni paletler, canlı OS tema değişimi, %130 metin, azaltılmış hareket, kompakt yoğunluk, kaydedilmemiş işlem tercihlerini koruma, yardım ekranı ve içeriğe geçişi kapsar. Diyalog testleri yazarken imlecin korunmasını, arka plan yalıtımını, hata mesajının diyalog içinde okunmasını, odağın açan düğmeye dönüşünü ve Spotlight combobox gezinmesini doğrular. Otomatik kontroller, gerçek ekran okuyucu kullanıcı testi yerine geçmez.

## 3.1 kapsamı

Yeni servis testleri ikon kaynağı/hedef fallback davranışını, güvenilir indeks kontrolünü, metadata önbellek tahliyesi sırasında eşzamanlı istekleri, parçalı UTF-8/çıkış sonrası stdout okumasını ve kısayol çakışmasında geri almayı kapsar. UI testleri native PNG servisi simülasyonuyla ikon önceliğini, gerçek klavye kaydı/iptalini, bilgi paneli hata/yeniden deneme/odak dönüşünü ve sabit pencere düzenini kontrol eder.

Gerçek Electron testi `app.getFileIcon` ile PNG veya ikon bulunamadığında `null` sonucunu, dosya sistemi metadata'sını, indeks dışındaki bilgi taleplerinin reddini ve kısayol capture/resume döngüsünü doğrular. Kayıtlı tuşlar ayrıca Electron `globalShortcut.isRegistered` ile kontrol edilir. Bu kontrol, başka bir uygulama/oyun odaktayken fiziksel tuşa basma testi değildir. Windows üretici/açıklama kaynağı enjekte edilmiş sürüm bilgisi ve sabit PowerShell süreci testleriyle doğrulanır; canlı Windows executable kaynakları bu oturumda okunmamıştır.

## Doğrulanan davranışlar

- Masaüstü taraması, taşı/kopyala, içerik doğrulama, hedef çakışmaları ve geri alma.
- Yarım kalan taşıma/geri alma kayıtlarının kurtarılması; mevcut veya değiştirilmiş dosyaların korunması.
- Eski sayısal kategori tercihlerinin yeni sabit kimliklere göçü ve eski geçmişin geri alınması.
- Alt klasör oluşturma, döngü/rezerv Windows adları/yol kaçışı doğrulaması ve kategori silindikten sonra eski işlemi geri alma.
- Derin tarama kökleri, kayıtlı konumlar, yardımcı dosya elemesi, hedef+argüman bazlı tekilleştirme, erişim uyarıları, sınırlar ve durdurma.
- Kurulu uygulamaya dokunmadan `.desktop` kısayolu oluşturma, yeni kısayolu geri alma ve uygulamanın orijinal içeriğini koruma.
- Yedi palet ve sistem teması, iki dil, ikon paketi/öğe ikonu kalıcılığı, özel kategori ve kural akışları, arama ve filtreleme.
- İngilizce açık tema dahil 390 px genişlikte taşma kontrolü, klavye araması, diyalog odağı ve geri alınabilir bildirim.
- Türkçe/İngilizce sözlüklerde eşit anahtarlar ve eşit yer tutucular.
- Profil görünürlüğü, önceden gizli öğelerin korunması, profil geçişi ve çıkışta geri yükleme; Linux üzerinde gerçek `.hidden` işlemleri.
- Profil görünürlüğü değişirken onaylanmış taşıma planının içerik doğrulamasını koruması.
- Spotlight klavye gezinmesi, fuzzy arama, komutlar ve güvenilir indeks dışındaki yolların reddedilmesi.
- Güvenli regex kuralları, alt kategoriler, gürültü filtreleri, yerel etiket önerileri ve yalnızca DarkDesk kullanım geçmişine dayanan arşiv önerileri.
- İsteğe bağlı arşiv/Downloads otomasyonu, geri alma sonrası aynı sürümün yeniden taşınmaması ve sürükle-bırak kategori ataması.
- Gerçek Electron ve paketlenmiş ASAR içinden profil/geri yükleme, Spotlight IPC, tepsiye gizlenme, arşiv ve Downloads akışları. Testte uygulama başlatma adaptörü kayıt tutan bir adaptörle değiştirilir; dış program başlatılmaz.

## Platform doğrulamasının sınırı

Bu oturumda gerçek Windows çalıştırılmadı. Windows kayıt defteri kaynağı enjekte edilmiş örneklerle ve sabit PowerShell komutunun yollarıyla test edildi; kullanıcının canlı kayıt defteri taranmadı. Windows Hidden niteliği ve Explorer yenilenmesi, global kısayolların canlı sistemde kaydı, `.lnk` yazma, `desktop.ini` ile Explorer ikonları ve Windows EXE kurulumu burada gerçek Windows üzerinde doğrulanmış değildir. Linux `.hidden` dosyasını masaüstü yöneticisinin görsel olarak uygulaması da ortamına bağlıdır. Gerçek işletim sisteminden insan eliyle dosya sürükleme ve harici uygulamanın açılması bu testlerin kapsamında değildir.

GitHub Actions Windows koşucusu, servis ve gerçek Electron testlerini çalıştıracak şekilde ayarlıdır. Electron testinin Windows dalı, oluşturulan `.lnk` hedefini/ikonunu ve `desktop.ini` içeriğini ayrıca kontrol eder. Bu işlerin uzaktaki başarı durumu, yerel testlerin başarısından çıkarılamaz; [Actions](https://github.com/Huseyinhk61/DarkDesk/actions) üzerinden görülmelidir.

Tam geliştirme araç zinciri denetiminde paketleyicinin geçişli geliştirme bağımlılıklarına ilişkin orta seviye bildirimler bulunur. Dağıtım bağımlılıkları denetimi bunlardan ayrıdır; testlerin geçmesi bütün güvenlik açıklarının yokluğunu garanti etmez.
