# Yerel ikonlar, ayrıntılar ve kısayollar

## Uygulama ikonları ve bilgi paneli

DarkDesk, kartlarda ve Spotlight sonuçlarında Electron `app.getFileIcon` ile dosyanın işletim sistemi ikonunu gösterir. `.lnk` için önce kısayolun ikonu, okunamazsa yerel hedefin ikonu denenir. İşletim sistemi ikon sağlayamazsa seçili kategori/öğe ikonu kullanılır. İkon paketi seçimi kategori ve yedek ikon görünümünü kişiselleştirir.

Kartın ikonuna veya adına tıklamak bilgi panelini açar. Klavyeyle Tab ve Enter da kullanılabilir. Dosya boyutu ve tarihler dosya sisteminden gelir; kısayollarda bu alanlar kısayol dosyasını anlatır. Windows `.exe` açıklaması ve üretici alanı sürüm kaynağından okunur; `.lnk` için yerel executable hedef kullanılır. Bu alanlar her dosyada bulunmaz ve doğrulanmış üretici kimliği sayılmaz. Eksik alanlar açıkça belirtilir.

Son başlatma, yalnızca DarkDesk üzerinden başarılı olarak iletilen başlatma isteklerini gösterir. Uygulamanın başka yerden açılması veya ne kadar çalıştığı izlenmez. Tarayıcı demosu yerel ikon veya üretici bilgisi uydurmaz.

Renderer, dosya yolu göndererek bilgi okuyamaz: yalnızca taranmış güvenilir öğenin kimliği IPC ile kabul edilir. İkonlar görünür kartlar için yüklenir; paralel istekler ve önbellek boyutu sınırlıdır. Windows metadata okuması dosya adını komuta birleştirmez; JSON stdin, zaman aşımı ve çıktı sınırı kullanır.

## Global kısayollar

**Çalışma Profilleri → Global kısayollar** bölümünde başlatıcı kombinasyonunu veya profil kısayolunu düzenleyin. Ayarlarda da başlatıcı kaydedicisi bulunur:

1. **Tuş kaydet** düğmesine veya kısayol alanına tıklayın.
2. Ctrl/Alt/Command gibi bir değiştiriciyle harf, sayı, Space veya fonksiyon tuşuna basın.
3. Yeni kombinasyonu kaydedin. Escape kaydı iptal eder; Tab, odak kaybı ve zaman aşımı da kayıt modundan çıkarır.

Kayıt sırasında DarkDesk global kısayolları geçici durur; böylece profil tuşuna basmak yanlışlıkla profili değiştirmez. İşlem sonunda yeniden kaydedilir. Aynı kombinasyonun birden fazla profile atanması engellenir. Yeni kombinasyon başka uygulama/OS tarafından ayrılmışsa kayıt reddedilir ve önceki çalışan atama korunur. Tema gibi ilgisiz ayar değişiklikleri çalışan tuşları silip tekrar kaydetmez.

Global kayıt başarılı olduğunda DarkDesk odakta olmasa veya tepside olsa da Electron kombinasyonu dinler. Başka uygulamanın ayırdığı tuşlar, işletim sistemi kısıtlamaları, bazı tam ekran oyunlar ve güvenli masaüstü ekranları nedeniyle evrensel tetiklenme garantisi verilemez. Durum paneli gerçek kayıt sonucunu gösterir; çakışmada örneğin `Ctrl+Shift+Space` gibi başka kombinasyon seçin. Tarayıcı demosunda tuşlar yalnızca sayfa odaktayken çalışır.

![Klavyeden kısayol kaydetme · tarayıcı önizlemesi](assets/shortcuts.png)

## Sabit pencere düzeni

Sidebar ve sürüklenebilir başlık çubuğu ana içerik kaydırılırken yerinde kalır. Pencere kontrol alanları en az 44 × 44 pikseldir. Mobil ve kısa ekranlarda gezinme alanı erişilebilir kalacak şekilde kendi içinde kayabilir. Bilgi paneli ve diğer diyaloglar pencere üstünde açılır; Escape ile kapanır ve odağı açan düğmeye döndürür.
