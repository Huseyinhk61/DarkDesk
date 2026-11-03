# Katkı rehberi

Node.js 24 LTS kullanarak `npm ci` çalıştır. Web demosu `npm run dev`, gerçek masaüstü geliştirme akışı `npm run desktop` komutuyla açılır.

## Değişiklik yaparken

- Profil, zamanlayıcı, tepsi ve launcher değiştirici işlemlerini `DesktopRuntime` koordinatöründen geçir.
- Profil gizleme günlüğünü, özgün nitelikleri ve kesinti/çıkış kurtarmasını koru. Launcher keyfi shell veya dosya yolu kabul etmemeli.
- Gerçek dosya işlemlerini yalnızca Electron ana sürecinde tut. Renderer’a genel dosya sistemi veya sınırsız IPC erişimi verme.
- Taşıma/kopyalama öncesi açık önizleme ve kullanıcı onayını koru. Otomatik tarama dosya taşımamalı.
- Dosyaların üzerine yazma. Geri alma ve kesinti senaryolarını yeni dosya işlemleriyle birlikte değerlendir.
- Kişisel masaüstünde denemeden önce geçici dosyalarla servis testini genişlet.
- Arayüz metinlerini `src/locales/tr.json` ve `en.json` dosyalarına birlikte ekle; anahtar ve yer tutucuları eş tut.
- Kategori ve ayar doğrulamasını `shared/` altında ortak tut. Sistem uygulamalarını taşımak yerine yalnızca kısayol oluştur.
- UI değişikliklerinde klavye kullanımı ve 390 px genişlikte taşma kontrolünü koru.

## Kontroller

```sh
npx playwright install chromium
npm run format
npm run check
npm run test:desktop
```

Son komut Linux’ta sanal ekranla çalıştırılır: `xvfb-run -a npm run test:desktop`. Windows’ta doğrudan çalıştırılır. Dosya sistemi testleri gerçek masaüstüne erişmez.

PR açıklamasında davranış değişikliğini, nasıl doğruladığını ve platform sınırlamalarını yaz. Derleme çıktıları, `node_modules`, işlem geçmişi ve kişisel dosyaları commit etme.
