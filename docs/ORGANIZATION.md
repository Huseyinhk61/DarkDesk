# Klasörleme, ikonlar ve kullanım açıklamaları

## Dosyaları gerçekten düzenleme

1. Masaüstünü tarayın veya Sistem Tarama ekranında yüklü uygulamaları bulun.
2. Kartları seçin ve her öğenin hedef kategorisini kontrol edin. Başlık seçili/toplam sayısını ve taranan kaynağı gösterir.
3. **Masaüstünü Fiziksel Düzenle** ile hedefleri önizleyin. Ardından taşıma/kopyalama ya da kısayol oluşturma onayını verin.
4. Sonuç panelinde gerçek aksiyon sayılarını inceleyin. Hedef klasörleri açabilir veya son işlemi geri alabilirsiniz.

Kategori seçmek veya bir kartı başka gruba sürüklemek tek başına dosyayı taşımaz. Kurulu uygulamaların executable dosyaları yerinden alınmaz; kategori klasörüne çalışan kısayol oluşturulur. Masaüstündeki kendi dosya/kısayollarınız Ayarlar'daki taşıma/kopyalama tercihine göre işlenir.

Klasör ikonu veya dosya tarihini koruma hatası taşıma işlemini durdurmaz; sonuçta uyarı görünür. Kritik kopyalama, doğrulama, günlük veya silme hatası açıkça bildirilir. Kaynak silinemediyse doğrulanmış kopya ve kaynak korunur. Mevcut hedeflerin üzerine yazılmaz. Atlanan öğenin nedeni sonuç ayrıntılarında görünür; aynı isimli bir dosya varsa önce kontrol edin.

![İşlem sonucu · etkileşimli tarayıcı demosu](assets/result.png)

## Uygulama logosu görünmüyorsa

**İkonları yenile** düğmesi geçici hata önbelleğini temizler. Windows'ta kısayolun özel ikon dosyası ve indeksi, executable ikon kaynakları ve `.url` dosyasındaki yerel `IconFile` bilgisi denenir. Windows kaynak çıkarımı başarısızsa Electron Shell ikonu kullanılır. Kaynağa erişilemiyorsa baş harf yedeği gösterilir; bu yedek özgün logo olarak sunulmaz.

Tarayıcı demosu işletim sistemi ikonlarına erişemez. README ekran görüntülerindeki baş harfler bu durumu gösterir. Yeni kurulu uygulama kısayolları özgün ikonunu korur; kullanıcı açıkça özel ikon seçerse o tercih uygulanır. Klasör ikon paketi uygulamanın kimliğiyle ayrı bir tercihtir.

## Ne işe yarar?

Kart ve ayrıntı paneli, yerel katalogda tanınan uygulamalar için kullanım amacını gösterir. Örneğin Visual Studio Code kod yazmaya, Chrome web sayfalarını açmaya, Blender 3D içerik üretmeye yardımcı olur. Katalog eşleşmesi ad/hedef üzerinden yapılır ve executable kimliği doğrulaması değildir.

Tanınmayan öğelerde dosya türü veya kategoriye dayanan genel tahmin açıkça işaretlenir. Dosya içerikleri bu açıklamalar için okunmaz; çevrimiçi AI isteği yapılmaz. Kullanıcı grupları ve kendi kuralları otomatik sınıflandırmadan önceliklidir. Arama alanında uygulama adı yanında kullanım açıklaması da aranabilir.
