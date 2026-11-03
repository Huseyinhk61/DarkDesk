# DarkDesk 3.0 doğrulama raporu

Tarih: 3 Kasım 2026. Yerel doğrulama ortamı: Linux, Node.js 24, Electron 45, Chromium ve Xvfb.

| Kontrol                             | Sonuç                                                                                                                                          |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                          | 69 servis/model/ayar testi geçti; başarısız veya atlanan test yok.                                                                             |
| `npm run build`                     | Üretim React/Tailwind derlemesi geçti.                                                                                                         |
| `npm run test:e2e`                  | 30 Chromium senaryosu geçti.                                                                                                                   |
| `npm run test:desktop`              | İzole gerçek Electron/IPC testi geçti.                                                                                                         |
| Linux `electron-builder --dir`      | Uygulama dizini ve ASAR oluşturuldu. Bu kontrol AppImage veya Windows EXE üretildiği anlamına gelmez.                                          |
| Paketlenmiş ASAR’dan Electron testi | Paylaşılan ESM/JSON modülleri, preload, tarayıcı, ikon dosyaları ve renderer paket içinden çalıştı.                                            |
| Paket içeriği                       | Native ikonlar, runtime/profil/otomasyon modülleri, dil sözlükleri ve RE2 regex bağımlılığı mevcut; test giriş noktaları dağıtıma dahil değil. |
| `npm audit --omit=dev`              | Dağıtım bağımlılıklarında bilinen açık raporlanmadı.                                                                                           |

## Doğrulanan davranışlar

- Masaüstü taraması, taşı/kopyala, içerik doğrulama, hedef çakışmaları ve geri alma.
- Yarım kalan taşıma/geri alma kayıtlarının kurtarılması; mevcut veya değiştirilmiş dosyaların korunması.
- Eski sayısal kategori tercihlerinin yeni sabit kimliklere göçü ve eski geçmişin geri alınması.
- Alt klasör oluşturma, döngü/rezerv Windows adları/yol kaçışı doğrulaması ve kategori silindikten sonra eski işlemi geri alma.
- Derin tarama kökleri, kayıtlı konumlar, yardımcı dosya elemesi, hedef+argüman bazlı tekilleştirme, erişim uyarıları, sınırlar ve durdurma.
- Kurulu uygulamaya dokunmadan `.desktop` kısayolu oluşturma, yeni kısayolu geri alma ve uygulamanın orijinal içeriğini koruma.
- Üç tema, iki dil, ikon paketi/öğe ikonu kalıcılığı, özel kategori ve kural akışları, arama ve filtreleme.
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
