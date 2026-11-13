# MEBBİS Süper Asistan

MEBBİS (`mebbis.meb.gov.tr`) üzerinde çalışan bir Chrome uzantısı (Manifest V3).

## Özellikler

- **Seans Onay Otomasyonu** — seansları toplu onaylama
- **Turbo mod** — hızlı seans işleme
- **Manuel Öğrenci Gezgini** — öğrenci listesinde gezinme
- **Ders Süresi Takibi**
- **A4 PDF Raporlayıcı** — `html2pdf` ile rapor çıktısı
- **Eğitmen Raporu** — eğitmen → öğrenciler, seans ve ders süresi; detaylı modda giriş-çıkış uyumu

## Kurulum

1. Bu depoyu indirin veya klonlayın.
2. Chrome'da `chrome://extensions` adresini açın.
3. Sağ üstten **Geliştirici modu**'nu etkinleştirin.
4. **Paketlenmemiş öğe yükle** ile bu klasörü seçin.
5. `mebbis.meb.gov.tr` üzerinde oturum açın; uzantı simgesinden paneli açın.

## Dosya yapısı

| Yol | Açıklama |
|---|---|
| `manifest.json` | Manifest V3 tanımı, izinler, içerik betiği sırası |
| `background.js` | Service worker |
| `popup/` | Araç çubuğu popup arayüzü |
| `src/00-core.js` | Ortak çekirdek, yardımcılar |
| `src/05-seans.js` | Seans işlemleri |
| `src/10-turbo.js` | Turbo mod |
| `src/20-gezgin.js` | Öğrenci gezgini |
| `src/30-sure.js` | Süre takibi |
| `src/40-rapor.js` | Raporlama |
| `src/45-egitmen.js` | Eğitmen raporu |
| `src/50-panel.js` | Arayüz paneli |
| `src/90-main.js` | Başlatma |
| `version.json` | Sürüm bilgisi (tek kaynak) |
| `icons/` | Uzantı simgeleri |
| `html2pdf.bundle.min.js` | PDF üretimi için bağımlılık |

## Sürüm

Güncel sürüm `version.json` dosyasından okunur.

## Geliştirici

Sercan ÖZDEMİR
