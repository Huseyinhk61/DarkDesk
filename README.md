# DarkDesk

React + Tailwind CSS + Electron ile yerel masaüstü düzenleyici. Node.js 22 veya 24 önerilir.

```sh
npm ci
npm run dev       # tarayıcıda etkileşimli demo
npm run desktop   # Electron: gerçek işletim sistemi masaüstü
npm run build
npm test
```

Electron için grafik masaüstü ve platformun Electron sistem kütüphaneleri gerekir. Web önizlemesi 12 örnek öğeyle çalışır; gerçek dosyalara erişmez. Pencere kontrolleri yalnızca Electron içinde çalışır.

## Dosya işlemleri

Electron `app.getPath('desktop')` üzerinden mevcut kullanıcının masaüstünü bulur. Yalnızca doğrudan masaüstündeki normal dosyalar taranır; alt klasörler ve sembolik bağlantılar taranmaz. Dosya adları ve uzantılarına göre kategoriler önerilir; hedefler kartlardan değiştirilebilir. Windows `.lnk` hedefinin çözülmesi yerine kısayolun kendi yolu gösterilir. Uygulamalar yürütülmez, kısayol veya dosya kendisi taşınır/kopyalanır. Ortak/Public masaüstü taranmaz.

Ayarlar bölümünden taşıma veya kopyalama seçilir. Seçili dosyalar açık onaydan sonra gerçek kategori klasörlerine yerleştirilir. Kopyalama `.lnk` dosyasının kendisini kopyalar; yeni OS kısayolu üretmez. Var olan hedeflerin üzerine yazılmaz. İşlem geçmişi Electron kullanıcı verisi dizinindeki `history.json` dosyasında saklanır. Geri alma en son işlemi işler; değişen hedef veya yeniden oluşan orijinal dosya varsa işlemi durdurur. Boş kalan, uygulamanın oluşturduğu klasörler kaldırılır. Hata öncesinde tamamlanan adımlar geçmişte korunur. Ani güç kesintileri ve uygulama dışında eşzamanlı dosya değişiklikleri için atomik çoklu dosya işlemi garantisi verilmez; önemli dosyaların yedeğini tutun.

Renderer Node erişimine sahip değildir; context isolation, sandbox ve sınırlı preload IPC kullanılır. IPC hedefleri sabit kategorilerle sınırlıdır. İnternet servisi, API anahtarı veya hesap gerekmez.
