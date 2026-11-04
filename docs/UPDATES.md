# EXE kurulumu ve uygulama içi güncelleme

## İlk kurulum

[Releases](https://github.com/Huseyinhk61/DarkDesk/releases/latest) sayfasından **DarkDesk-Setup-3.4.1.exe** paketini indirin. İlk kurulumdan önce eski DarkDesk sürümünü tepsi menüsündeki **Çıkış** ile kapatın. NSIS kurulum sihirbazı uygulamayı kurar; Node.js veya terminal gerekmez. **Portable** paketi kurulum gerektirmeyen alternatiftir; uygulama içinden kendi üzerine kurulum desteklemez.

3.4 öncesi sürümlerde bu güncelleme servisi bulunmaz; gizli depo erişimi için ilk kez 3.4.1 veya daha yenisini kurun; ilk kez yeni Setup paketini kurmak veya kaynak kodu güncellemek gerekir. Sonraki uygun sürümler uygulamanın kendi güncelleme ekranından alınabilir. Güncelleme kullanıcı ayarlarını ve işlem geçmişini sıfırlamaz.

Paketler şu anda kod imzalı değildir. Windows yayıncı/SmartScreen uyarısı gösterebilir. İndirdiğiniz dosyayı resmi sürüm kaynağından alın ve `SHA256SUMS.txt` ile karşılaştırın.

## Uygulama içinden

Kurulu Windows sürümü başlangıçtan 30 saniye sonra ve arka planda 6 saatte bir sürüm denetler. Yeni sürüm varsa uygulama içinde ve işletim sistemi izin veriyorsa masaüstü bildirimi görünür. Ayarlar → **Güncellemeler** bölümünden istediğiniz zaman denetleyebilirsiniz.

1. **Güncellemeleri kontrol et** ile sürümü denetleyin.
2. **Güncellemeyi indir** ile paketi indirin; ilerleme ekranda görünür.
3. İndirme tamamlandıktan sonra **Yeniden başlat ve güncelle** seçin.

İndirme otomatik başlamaz; uygulamadan çıkmak paketi sessizce kurmaz. Dosya işlemi sürerken yeniden başlatma kapalıdır. Kurulumdan önce işlem kuyruğu ve profil görünürlüğü güvenle kapatılır. İndirme SHA-512 kontrolünü `electron-updater` uygular. Ağ/kaynak/kurulum hatasında yeniden deneme sunulur; hata halinde uygulama güncelmiş gibi gösterilmez.

Geliştirme, Linux ve portable sürümlerde native kurulum devre dışıdır; resmi EXE indirme sayfası açılabilir. Tarayıcı demosu gerçek bir güncelleme indirip kurmaz.

## Sürüm yayınlama

Yeni sürüm için `package.json` ve kilit dosyasındaki sürüm numarasını arttırıp `main` dalına gönderin. Windows iş akışı testlerden sonra Setup ve Portable EXE dosyalarını oluşturur. `scripts/verify-windows-release.cjs`, `latest.yml` sürümünü, installer dosyasını, boyutunu ve SHA-512 değerini gerçek dosyayla karşılaştırır. Blockmap ve SHA-256 özetleri de yayınlanır.

Başarılı iş akışı `v<version>` Release oluşturur. Yayınlanmış aynı sürüm değiştirilmez; başka bir güncelleme için sürüm numarası arttırılır. Yarım kalan taslak yayın tekrar çalıştırıldığında tamamlanabilir. İlgili GitHub Actions işinin yayın için `contents: write` yetkisi kullanması gerekir; uygulamaya `GITHUB_TOKEN` veya başka bir yayınlama anahtarı gömülmez.

Depo gizli kalır. İlk EXE indirmesi için GitHub'da depoya erişimi olan hesabınızla oturum açın. Uygulama içi güncellemeler, aşağıdaki okuma anahtarıyla özel Release varlıklarına erişir. Uygulamaya yayınlama anahtarı veya ortak bir depo anahtarı gömülmez.

## Gizli depo erişimi

1. GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens** bölümünde anahtar oluşturun.
2. Kaynak sahibi ve depo olarak **Huseyinhk61 / DarkDesk** seçin; yalnızca bu depoya erişim verin.
3. **Repository permissions → Contents: Read-only** seçin. Yayınlama/yazma izni gerekmez. Hesabınızın depoya erişimi olmalıdır.
4. Anahtarı DarkDesk **Ayarlar → Güncellemeler → Gizli depo erişimi** alanına girip kaydedin. Sohbete, issue'ya veya kaynak koda yapıştırmayın.
5. **Güncellemeleri kontrol et** ile bağlantıyı denetleyin. Süresi dolarsa aynı alanda yenileyin; **Erişimi kaldır** ile cihazdaki anahtarı silebilirsiniz.

Anahtar, Windows `safeStorage`/DPAPI ile şifrelenerek kullanıcı verisi dizininde tutulur. Arayüze geri okunmaz, durum bildiriminde veya işlem günlüğünde gösterilmez; parola alanı kayıttan sonra temizlenir. Anahtar olmadan otomatik özel depo isteği yapılmaz. Düz metin saklama alternatifi yoktur; geliştirme, Linux ve portable modunda anahtar saklama kapalıdır.

Anahtarı silmek sonraki denetimleri durdurur. Önceden indirilip doğrulanmış yerel güncelleme paketi için yeniden başlatıp kurma kullanılabilir. Gerçek bir sürümden sonraki sürüme canlı Windows yükseltmesi bu geliştirme ortamında ayrıca doğrulanmış değildir.
