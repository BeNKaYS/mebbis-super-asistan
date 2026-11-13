/*
 * MEBBİS Süper Asistan — 2. Manuel Gezgin & Hızlı Onay
 * - Listede manuel (M-M, M-O, O-M) öğrencileri işaretler ve aralarında gezdirir.
 * - Seans tablosunda: aynı gün onay/ret, tüm M-M ret, tüm manuel onayları sil.
 * - Seans penceresi açıkken önceki/sonraki seansa geçiş ve "Seri" mod.
 */
(function () {
  'use strict';
  const M = window.__MSA;
  if (!M || M.kilitli) return;

  const ANAHTAR = 'mg3_durum_v31'; // sessionStorage
  M.GEZGIN_ANAHTARI = ANAHTAR;

  /** Kullanıcının tabloda seçtiği / gezindiği seans (satır no + tarih). */
  M.secili = { no: null, tarih: null };
  /** Aynı anda iki toplu işlem başlamasın. */
  M.islemde = false;

  // ---------------------------------------------------------------------------
  // Durum
  // ---------------------------------------------------------------------------
  M.gezginOku = () => {
    try {
      const d = JSON.parse(sessionStorage.getItem(ANAHTAR));
      if (d && Array.isArray(d.ogrenciler)) return d;
    } catch (e) { /* bozuk kayıt */ }
    return { ogrenciler: [], aktifIndex: 0, bekleyenGecis: null };
  };
  M.gezginYaz = (d) => {
    try { sessionStorage.setItem(ANAHTAR, JSON.stringify(d)); } catch (e) { /* kota */ }
  };

  M.seriAcik = () => localStorage.getItem('msa_seri_ilerle') !== 'false';
  M.seriAyarla = (acik) => localStorage.setItem('msa_seri_ilerle', acik ? 'true' : 'false');

  // ---------------------------------------------------------------------------
  // Öğrenci listesi
  // ---------------------------------------------------------------------------
  /** Liste sütunlarındaki "M:" / "O:" işaretinden eşleşme türü. */
  function turBelirle(giris, cikis) {
    const gM = giris.includes('M:'), cM = cikis.includes('M:');
    const gO = giris.includes('O:'), cO = cikis.includes('O:');
    if (gM && cM) return 'MM';
    if (gM && cO) return 'MO';
    if (gO && cM) return 'OM';
    if (gM || cM) return 'M-?';
    return null;
  }

  function manuelOgrencileriTopla() {
    const sonuc = [];
    document.querySelectorAll(`${M.LISTE_TABLO} > tbody > tr`).forEach((tr, i) => {
      if (!tr.querySelector('td:nth-child(1) a')) return;
      const tur = turBelirle(M.hucre(tr, 14), M.hucre(tr, 15));
      if (!tur) return;
      sonuc.push({
        listeIndex: i,
        siraNo: i + 1,
        adSoyad: M.tcTemizle(`${M.hucre(tr, 3)} ${M.hucre(tr, 4)}`.trim()) || `Öğrenci #${i + 1}`,
        tc: M.hucre(tr, 2),
        tur,
      });
    });
    return sonuc;
  }

  /** Listede öğrenciyi (önce index, tutmazsa TC ile) bulup seanslarını açar. */
  function ogrenciyiAc(ogr) {
    if (!ogr) return false;
    const satirlar = document.querySelectorAll(`${M.LISTE_TABLO} > tbody > tr`);
    let tr = satirlar[ogr.listeIndex];
    const tutmuyor = !tr || !tr.querySelector('td:nth-child(1) a') || (ogr.tc && !tr.innerText.includes(ogr.tc));
    if (tutmuyor && ogr.tc) tr = [...satirlar].find((s) => s.innerText.includes(ogr.tc)) || tr;
    if (!tr) return false;

    const link = tr.querySelector('td:nth-child(1) a') || tr.querySelector('td:nth-child(1) img') || tr.querySelector('td:nth-child(1)');
    if (!link) return false;
    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    tr.style.outline = '3px solid #ff9500';
    M.tikla(link);
    return true;
  }

  /** Liste sayfası açıldığında: manuel öğrencileri topla, boya, bekleyen geçiş varsa uygula. */
  M.listeSayfasiHazirla = async () => {
    const satirlar = document.querySelectorAll(`${M.LISTE_TABLO} > tbody > tr`);
    if (!satirlar.length) return;

    const ogrenciler = manuelOgrencileriTopla();
    const d = M.gezginOku();
    d.ogrenciler = ogrenciler;
    if (d.aktifIndex >= ogrenciler.length) d.aktifIndex = Math.max(0, ogrenciler.length - 1);

    satirlar.forEach((tr) => {
      if (turBelirle(M.hucre(tr, 14), M.hucre(tr, 15))) tr.style.backgroundColor = '#fff3cd';
    });

    if (d.bekleyenGecis != null) {
      const hedef = d.bekleyenGecis.hedefIndex;
      d.bekleyenGecis = null;
      d.aktifIndex = hedef;
      M.gezginYaz(d);
      M.gezginPaneliGuncelle();
      const ogr = d.ogrenciler[hedef];
      if (ogr) {
        M.toast(`🚀 [${hedef + 1}/${d.ogrenciler.length}] ${ogr.adSoyad} seans tablosu açılıyor...`);
        await M.bekle(300);
        ogrenciyiAc(ogr);
      }
    } else {
      M.gezginYaz(d);
      M.gezginPaneliGuncelle();
    }
  };

  // ---------------------------------------------------------------------------
  // Seans tablosu bilgileri
  // ---------------------------------------------------------------------------
  /** Seans tablosundaki öğrencinin adı. */
  M.ogrenciBasligi = () => {
    const ilk = document.querySelector(`${M.SEANS_TABLO} tr:nth-child(2)`);
    if (ilk) {
      const ad = `${M.hucre(ilk, 2)} ${M.hucre(ilk, 3)}`.trim();
      if (ad) return { adSoyad: M.tcTemizle(ad) };
    }
    const etiket = document.querySelector('#lblBaslik, #lblOgrenciBilgi, span[id*="lblOgrenci"]');
    const m = etiket?.innerText?.match(/([A-ZÇĞİÖŞÜ\s]{3,})/);
    return { adSoyad: m ? M.tcTemizle(m[1].trim()) : '' };
  };

  /** Açık seansın tarihi: seçili satır → modal metnindeki ilk tarih. */
  M.aktifTarih = () => {
    if (M.secili.tarih) return M.secili.tarih;
    if (M.secili.no) {
      const tr = M.seansSatirlari()[M.secili.no];
      if (tr) return M.satirTarihi(tr);
    }
    const kap =
      document.querySelector('#pnlOgrenciTakip') ||
      document.querySelector('#pnlDenetimBilgisi') ||
      document.querySelector('#imgRamFoto')?.closest('.modal, div[id*="Modal"], div[id*="pnl"], table') ||
      document.querySelector('#btnDenetimKaydet')?.closest('div, table') ||
      document.body;
    const m = (kap?.innerText || '').match(/\b(\d{2}[./]\d{2}[./]\d{4})\b/);
    return m ? m[1] : null;
  };

  /** Açık seansın tablodaki satır numarası (1..n). */
  M.aktifSeansNo = () => {
    const satirlar = M.seansSatirlari();
    if (satirlar.length <= 1) return null;
    if (M.secili.no >= 1 && M.secili.no < satirlar.length) return M.secili.no;

    for (let i = 1; i < satirlar.length; i++) {
      const o = satirlar[i].style.outline;
      if (o && o !== 'none') return i;
    }

    const tarih = M.aktifTarih();
    const olay = M.xpath('//*[@id="rptOlaylar_ctl01_btnOlay"]/span[2]') || document.querySelector('#rptOlaylar_ctl01_btnOlay');
    const saat = (olay?.innerText || '').match(/(\d{1,2})[:.](\d{2})/);
    if (tarih) {
      for (let i = 1; i < satirlar.length; i++) {
        if (M.satirTarihi(satirlar[i]) !== tarih) continue;
        if (!saat || M.hucre(satirlar[i], 6).includes(saat[1])) return i;
      }
    }
    return 1;
  };

  /** Belirli tarihteki, karara göre henüz işlenmemiş manuel/diğer seanslar. */
  function ayniGunBekleyenler(tarih, karar) {
    if (!tarih) return [];
    const sonuc = [];
    const satirlar = M.seansSatirlari();
    for (let i = 1; i < satirlar.length; i++) {
      const tr = satirlar[i];
      if (M.satirTarihi(tr) !== tarih) continue;
      const d = M.denetimDurumu(M.denetimMetni(tr));
      const bekliyor = karar === 'ONAY' ? !d.uyumlu : !d.uyumsuz;
      if (bekliyor) sonuc.push({ tr, no: i, tarih });
    }
    return sonuc;
  }

  /** Tabloda seçili yoksa: önce denetlenmemiş manuel, sonra herhangi bir manuel seans. */
  function hedefSeansBul() {
    const satirlar = M.seansSatirlari();
    const kayit = (i) => ({ tr: satirlar[i], no: i, tarih: M.satirTarihi(satirlar[i]) });
    if (M.secili.no && satirlar[M.secili.no]) return kayit(M.secili.no);
    for (let i = 1; i < satirlar.length; i++) {
      if (M.manuelMi(satirlar[i]) && !M.denetimDurumu(M.denetimMetni(satirlar[i])).uyumlu) return kayit(i);
    }
    for (let i = 1; i < satirlar.length; i++) {
      if (M.manuelMi(satirlar[i])) return kayit(i);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Tablo boyama ve satır seçimi
  // ---------------------------------------------------------------------------
  function satirTiklamaDinle() {
    const satirlar = M.seansSatirlari();
    satirlar.forEach((tr, i) => {
      if (i === 0 || tr.dataset.msaDinleyici === '1') return;
      tr.dataset.msaDinleyici = '1';
      tr.style.cursor = 'pointer';
      tr.addEventListener(
        'click',
        (e) => {
          M.secili.no = i;
          M.secili.tarih = M.satirTarihi(tr);
          if (e.target.closest('a')) return;
          M.seansSatirlari().forEach((s, j) => { if (j > 0) s.style.outline = 'none'; });
          tr.style.outline = '2px solid #af52de';
          M.toast(`🎯 Seans ${i} (${M.secili.tarih || 'Tarih yok'}) seçildi.`);
        },
        true
      );
    });
  }

  /** Manuel seans satırlarını denetim durumuna göre renklendirir. */
  M.manuelSatirlariBoya = () => {
    const satirlar = M.seansSatirlari();
    if (!satirlar.length) return;
    for (let i = 1; i < satirlar.length; i++) {
      const tr = satirlar[i];
      if (!M.manuelMi(tr)) continue;
      tr.setAttribute('data-manuel', 'true');
      const d = M.denetimDurumu(M.denetimMetni(tr));
      tr.style.backgroundColor = d.uyumlu ? '#e8f5e9' : d.uyumsuz ? '#ffebee' : '#fff3cd';
    }
    M.rozetleriTemizle?.();
    satirTiklamaDinle();
  };

  // ---------------------------------------------------------------------------
  // Seans penceresi içinde önceki / sonraki seansa geçiş
  // ---------------------------------------------------------------------------
  M.seansaGit = async (no) => {
    const satirlar = M.seansSatirlari();
    const toplam = satirlar.length > 1 ? satirlar.length - 1 : 0;
    if (toplam <= 0) { M.toast('⚠ Seans tablosu bulunamadı.'); return; }
    if (no < 1) { M.toast('ℹ️ İlk seanstasınız, daha önceki seans yok.'); return; }
    if (no > toplam) { M.toast('ℹ️ Son seanstasınız, daha sonraki seans yok.'); return; }
    if (M.islemde) return;

    M.islemde = true;
    try {
      const tr = satirlar[no];
      if (!tr) return;
      const link = M.seansLinki(tr);
      if (!link) { M.toast(`⚠ Seans ${no} için inceleme linki bulunamadı.`); return; }

      M.secili.no = no;
      M.secili.tarih = M.satirTarihi(tr);
      satirlar.forEach((s, j) => { if (j > 0) s.style.outline = 'none'; });
      tr.style.outline = '2px solid #af52de';
      try { tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* yoksay */ }

      await M.denetimPenceresiniKapat();

      const tarih = M.satirTarihi(tr);
      const saat = M.hucre(tr, 6);
      const bilgi = `${tarih}${saat ? ' ' + saat : ''}`;
      M.toast(`⏳ Seans ${no}/${toplam} açılıyor... (${bilgi})`);
      M.tikla(link);
      await M.postbackBekle(6000);
      await M.bekle(300);
      await M.gorunurBekle('#imgRamFoto, #imgKamera, #btnDenetimBilgisi', 5000);
      M.modalGorselleriniHazirla();
      if (M.lightboxAcikMi()) M.lightboxGuncelle();
      M.toast(`🎯 Seans ${no}/${toplam} yüklendi (${bilgi})`);
    } catch (e) {
      console.error('Modal içi seans geçiş hatası:', e);
      M.toast('❌ Seans geçişinde hata oluştu.');
    } finally {
      M.islemde = false;
    }
  };

  // ---------------------------------------------------------------------------
  // Toplu işlemler
  // ---------------------------------------------------------------------------
  const BUTONLAR = {
    ONAY: { btn: 'msa-btn-onayla', txt: 'msa-btn-onayla-txt', bos: '⚡ Seansı Onayla', calisiyor: '⏳ Onaylanıyor' },
    RET: { btn: 'msa-btn-ret-gun', txt: 'msa-btn-ret-gun-txt', bos: '❌ Seansı Ret Et', calisiyor: '⏳ Ret Ediliyor' },
    MM: { btn: 'msa-btn-ret-tum-mm', txt: 'msa-btn-ret-tum-mm-txt', bos: '🚫 Tüm M-M Ret', calisiyor: '⏳ Ret Ediliyor' },
    SIL: { btn: 'msa-btn-sil', txt: 'msa-btn-sil-txt', bos: '🗑️ Onayları Sil', calisiyor: '⏳ Siliniyor' },
  };
  const butonKilit = (tip, kilitli, metin) => {
    const b = BUTONLAR[tip];
    const btn = document.getElementById(b.btn);
    const txt = document.getElementById(b.txt);
    if (btn) btn.style.pointerEvents = kilitli ? 'none' : 'auto';
    if (txt) txt.textContent = metin || (kilitli ? `${b.calisiyor}...` : b.bos);
  };
  const butonMetni = (tip, metin) => {
    const txt = document.getElementById(BUTONLAR[tip].txt);
    if (txt) txt.textContent = metin;
  };

  const seansTablosuKontrol = () => {
    if (M.seansTablosundaMi()) return true;
    M.toast('⚠ Önce öğrencinin seanslar tablosuna girin!');
    return false;
  };

  /**
   * Açık / seçili seansı ve aynı gündeki diğer seansları onaylar ya da ret eder.
   * Seri mod açıkken ve pencere açıkken: kaydettikten sonra sıradaki seansa geçer.
   * @param {'ONAY'|'RET'} karar
   */
  M.ayniGunIsle = async (karar) => {
    if (M.islemde || !seansTablosuKontrol()) return;
    const onay = karar === 'ONAY';
    M.durdurmaBayraginiTemizle();
    M.islemde = true;
    butonKilit(karar, true);

    try {
      let tarih = null;
      const pencereAcikti = M.modalAcikMi();

      if (pencereAcikti) {
        tarih = M.aktifTarih();
      } else {
        const satirlar = M.seansSatirlari();
        const hedef =
          M.secili.no && satirlar[M.secili.no]
            ? { tr: satirlar[M.secili.no], no: M.secili.no, tarih: M.satirTarihi(satirlar[M.secili.no]) }
            : hedefSeansBul();
        if (!hedef) { M.toast(onay ? '⚠ Onaylanacak seans bulunamadı!' : '⚠ İşlem yapılacak seans bulunamadı!'); return; }

        tarih = hedef.tarih || M.satirTarihi(hedef.tr);
        M.toast(`📂 Seans ${hedef.no} (${tarih || ''}) açılıyor...`);
        if (!hedef.tr.querySelector('td:nth-child(19) a, td:nth-child(19) img')) { M.toast('⚠ Seans açma linki bulunamadı.'); return; }
        if (!(await M.seansiAc(hedef.tr))) { M.toast('⚠ Seans penceresi açılamadı.'); return; }
      }

      const sonuc = await M.denetimKaydet(karar);
      if (sonuc === 'aciklama-yok') {
        M.toast('⚠ Açıklama kutusu açılamadı.');
        await M.modalKapat();
        return;
      }

      // Seri mod: pencere içinde sıradaki seansa geç
      if (pencereAcikti && M.seriAcik()) {
        const toplam = M.seansSayisi();
        const mevcut = M.aktifSeansNo() || 1;
        await M.denetimPenceresiniKapat();
        if (mevcut < toplam) {
          const sonraki = mevcut + 1;
          M.toast(`${onay ? '✅' : '⛔'} Seans ${mevcut} ${onay ? 'onaylandı' : 'ret edildi'}! Sıradaki seansa (${sonraki}/${toplam}) geçiliyor... ⏩`);
          M.islemde = false;
          await M.bekle(250);
          await M.seansaGit(sonraki);
          return;
        }
        // Son seans: pencereyi kapat, tabloyu ve paneli güncelle
        await M.modalKapat();
        await M.bekle(300);
        M.manuelSatirlariBoya();
        M.gezginPaneliGuncelle();
        M.toast(`🎉 Tebrikler! Bu öğrencinin TÜM seansları tamamlandı (${toplam} seans).`, 5000);
        return;
      }

      await M.modalKapat();
      await M.bekle(350);

      let sayac = 1;
      if (tarih) {
        sayac = await M.topluIsle({
          karar,
          baslangic: 1,
          sinir: 20,
          bul: () => ayniGunBekleyenler(tarih, karar),
          etiketle: (s, n) => {
            butonMetni(karar, `${BUTONLAR[karar].calisiyor} (${n})...`);
            M.toast(onay ? `⚡ [${tarih}] Seans ${s.no} onaylanıyor...` : `❌ [${tarih}] Seans ${s.no} ret ediliyor...`);
          },
        });
      }

      await M.bekle(300);
      M.manuelSatirlariBoya();
      M.gezginPaneliGuncelle();
      const gun = tarih ? `${tarih} tarihindeki ` : '';
      M.toast(onay ? `🎉 ${gun}seans(lar) onaylandı (${sayac} seans).` : `❌ ${gun}seans(lar) ret edildi (${sayac} seans).`, 4000);
    } catch (e) {
      console.error(`[Gezgin] ${onay ? 'Onay' : 'Ret'} hatası:`, e);
      M.toast(onay ? '❌ Onay sırasında bir hata oluştu.' : '❌ Ret sırasında bir hata oluştu.');
    } finally {
      M.islemde = false;
      butonKilit(karar, false);
    }
  };
  M.onayla = () => M.ayniGunIsle('ONAY');
  M.retEt = () => M.ayniGunIsle('RET');

  const mmBekleyenler = () =>
    [...M.seansSatirlari()]
      .map((tr, no) => ({ tr, no }))
      .filter(({ tr, no }) => no > 0 && M.ciftManuelMi(tr) && !M.denetimDurumu(M.denetimMetni(tr)).uyumsuz);

  /** Öğrencinin tüm M-M (çift manuel) seanslarını ret eder. */
  M.tumMMRet = async () => {
    if (M.islemde || !seansTablosuKontrol()) return;
    if (M.modalAcikMi()) { await M.modalKapat(); await M.bekle(300); }

    const toplam = mmBekleyenler().length;
    if (toplam === 0) {
      const mmVar = [...M.seansSatirlari()].some((tr, i) => i > 0 && M.ciftManuelMi(tr));
      M.toast(mmVar ? 'ℹ Bu öğrencinin tüm M-M (Çift Manuel) seansları zaten ret edilmiş durumda.' : 'ℹ Bu öğrencinin M-M (Çift Manuel) seansı bulunmuyor.');
      return;
    }

    M.durdurmaBayraginiTemizle();
    M.islemde = true;
    butonKilit('MM', true);
    try {
      const n = await M.topluIsle({
        karar: 'RET',
        sinir: toplam + 5,
        ara: 400,
        bul: mmBekleyenler,
        etiketle: (s, i) => {
          butonMetni('MM', `⏳ Ret Ediliyor (${i}/${toplam})...`);
          M.toast(`❌ [${i}/${toplam}] Seans ${s.no} (M-M) ret ediliyor...`);
        },
      });
      await M.bekle(300);
      M.manuelSatirlariBoya();
      M.gezginPaneliGuncelle();
      if (n > 0) M.toast(`🎉 Bu öğrencinin tüm M-M seansları ret edildi (${n} seans).`, 4000);
    } catch (e) {
      console.error('[Gezgin] Tüm M-M Ret hatası:', e);
      M.toast('❌ Ret işlemi sırasında bir hata oluştu.');
    } finally {
      M.islemde = false;
      butonKilit('MM', false);
    }
  };

  const silinecekler = () =>
    [...M.seansSatirlari()]
      .map((tr, no) => ({ tr, no }))
      .filter(({ tr, no }) => no > 0 && M.manuelMi(tr) && M.denetlenmisMi(tr));

  /** Öğrencinin denetlenmiş tüm manuel seanslarının denetimini siler. */
  M.tumOnaylariSil = async () => {
    if (M.islemde || !seansTablosuKontrol()) return;
    const toplam = silinecekler().length;
    if (toplam === 0) { M.toast('ℹ Bu öğrencinin silinecek onaylı manuel seansı (M-M, M-O, O-M) yok.'); return; }

    M.durdurmaBayraginiTemizle();
    M.islemde = true;
    butonKilit('SIL', true);
    try {
      const n = await M.topluIsle({
        karar: 'SIL',
        sinir: toplam + 5,
        ara: 400,
        bul: silinecekler,
        durdurMesaji: '🛑 Silme işlemi kullanıcı tarafından durduruldu.',
        etiketle: (s, i) => {
          butonMetni('SIL', `⏳ Siliniyor (${i}/${toplam})...`);
          M.toast(`🗑️ [${i}/${toplam}] Seans ${s.no} onayı siliniyor...`);
        },
      });
      await M.bekle(300);
      M.manuelSatirlariBoya();
      M.gezginPaneliGuncelle();
      if (n > 0) M.toast(`🎉 Bu öğrencinin tüm manuel onayları silindi (${n} seans).`, 4000);
    } catch (e) {
      console.error('[Gezgin] Onay silme hatası:', e);
      M.toast('❌ Silme sırasında hata oluştu.');
    } finally {
      M.islemde = false;
      butonKilit('SIL', false);
    }
  };

  // ---------------------------------------------------------------------------
  // Öğrenciler arası gezinme
  // ---------------------------------------------------------------------------
  M.ogrenciGecis = (yon) => {
    const d = M.gezginOku();
    if (!d.ogrenciler.length) { M.toast('⚠ Manuel öğrenci bulunamadı.'); return; }
    const hedef = d.aktifIndex + yon;
    if (hedef < 0) { M.toast('🏁 Zaten ilk manuel öğrencidesiniz.'); return; }
    if (hedef >= d.ogrenciler.length) { M.toast('🏁 Son manuel öğrencidesiniz.'); return; }

    d.aktifIndex = hedef;
    M.akordeonHatirla('msa-icerik-gezgin');
    const sira = `[${hedef + 1}/${d.ogrenciler.length}]`;
    if (M.seansTablosundaMi()) {
      d.bekleyenGecis = { hedefIndex: hedef };
      M.gezginYaz(d);
      M.toast(`⏳ ${sira} Sıradaki öğrencinin seans tablosuna geçiliyor...`);
      M.listeyeDon();
    } else {
      M.gezginYaz(d);
      M.toast(`🚀 ${sira} ${d.ogrenciler[hedef].adSoyad} seansları açılıyor...`);
      M.gezginPaneliGuncelle();
      setTimeout(() => ogrenciyiAc(d.ogrenciler[hedef]), 200);
    }
  };

  /** Aktif manuel öğrencinin seans tablosunu açar (zaten açıksa ilk manuel satıra kaydırır). */
  M.seanslaraGit = async () => {
    const d = M.gezginOku();
    if (!d.ogrenciler.length) { M.toast('⚠ Manuel öğrenci bulunamadı.'); return; }
    const ogr = d.ogrenciler[d.aktifIndex];
    if (!ogr) return;
    M.akordeonHatirla('msa-icerik-gezgin');

    if (M.seansTablosundaMi()) {
      await M.modalKapat();
      M.manuelSatirlariBoya();
      const ilk = document.querySelector(`${M.SEANS_TABLO} tr[data-manuel="true"]`);
      if (ilk) {
        ilk.scrollIntoView({ behavior: 'smooth', block: 'center' });
        ilk.style.outline = '3px solid #ff9500';
        setTimeout(() => { ilk.style.outline = 'none'; }, 2000);
      }
      M.toast('📍 Seans tablosundasınız.');
      return;
    }
    M.toast(`📂 [${d.aktifIndex + 1}/${d.ogrenciler.length}] ${ogr.adSoyad} seansları açılıyor...`);
    ogrenciyiAc(ogr);
  };

  // ---------------------------------------------------------------------------
  // Panel bilgi kartı
  // ---------------------------------------------------------------------------
  M.gezginPaneliGuncelle = (adOverride = '') => {
    const panel = M.panel;
    if (!panel) return;
    const q = (s) => panel.querySelector(s);
    const d = M.gezginOku();
    const tabloda = M.seansTablosundaMi();
    const adet = d.ogrenciler.length;
    const ogr = d.ogrenciler[d.aktifIndex];

    if (q('#msa-gezgin-onay-kutu')) q('#msa-gezgin-onay-kutu').style.display = tabloda ? 'grid' : 'none';
    if (q('#msa-gezgin-liste-kutu')) q('#msa-gezgin-liste-kutu').style.display = tabloda ? 'block' : 'none';
    if (q('#msa-btn-seans-txt')) q('#msa-btn-seans-txt').textContent = tabloda ? '↩ Seans Tablosuna Dön' : '📂 Seanslarına Dön / Aç';

    const durumEl = q('#msa-seans-durum');
    if (!adet) {
      if (q('#msa-sayac')) q('#msa-sayac').textContent = '0 / 0';
      if (q('#msa-ad')) q('#msa-ad').textContent = adOverride || 'Taranıyor veya hepsi O-O';
      if (q('#msa-tur')) q('#msa-tur').textContent = '-';
      if (durumEl) durumEl.style.display = 'none';
      return;
    }

    if (q('#msa-sayac')) q('#msa-sayac').textContent = `${d.aktifIndex + 1} / ${adet}`;
    if (q('#msa-tur')) q('#msa-tur').textContent = ogr ? ogr.tur : '-';
    if (q('#msa-ad')) {
      const ad = M.tcTemizle(adOverride || (ogr ? ogr.adSoyad : 'Öğrenci'));
      q('#msa-ad').textContent = ad;
      q('#msa-ad').title = ad;
    }

    if (tabloda && durumEl) {
      const satirlar = [...M.seansSatirlari()].slice(1);
      // Manuel seans yoksa tüm seanslar üzerinden sayılır
      const hedefler = satirlar.some(M.manuelMi) ? satirlar.filter(M.manuelMi) : satirlar;
      let uyumlu = 0, uyumsuz = 0, bekleyen = 0;
      hedefler.forEach((tr) => {
        const dd = M.denetimDurumu(M.denetimMetni(tr));
        if (dd.uyumlu) uyumlu++;
        else if (dd.uyumsuz) uyumsuz++;
        else bekleyen++;
      });
      const toplam = hedefler.length;
      const denetlenen = uyumlu + uyumsuz;

      if (toplam === 0) {
        durumEl.style.display = 'none';
      } else if (bekleyen > 0) {
        Object.assign(durumEl.style, { display: 'block', color: '#ff9f0a', background: 'rgba(255,159,10,0.12)', borderColor: 'rgba(255,159,10,0.3)' });
        durumEl.textContent = `🎯 Denetim: ${denetlenen} / ${toplam} (${bekleyen} Bekliyor)`;
        durumEl.title = `Toplam: ${toplam} | Denetlenen: ${denetlenen} (${uyumlu} Uyumlu, ${uyumsuz} Uyumsuz) | ${bekleyen} Seans Bekliyor`;
      } else {
        Object.assign(durumEl.style, { display: 'block', color: '#30d158', background: 'rgba(48,209,88,0.12)', borderColor: 'rgba(48,209,88,0.3)' });
        const ek = uyumsuz > 0 && uyumlu > 0 ? ` • ${uyumlu} Onay, ${uyumsuz} Ret` : uyumsuz > 0 ? ' • Tümü Ret' : '';
        durumEl.textContent = `✅ Denetim Tamam (${toplam}/${toplam}${ek})`;
        durumEl.title = `Tüm Seanslar Denetlendi (${toplam}/${toplam}) | Uyumlu: ${uyumlu} | Ret (Uyumsuz): ${uyumsuz}`;
      }
    } else if (durumEl) {
      durumEl.style.display = 'none';
    }

    if (q('#msa-gezgin-alt')) {
      q('#msa-gezgin-alt').textContent = tabloda
        ? 'Alt+A: Onayla | Alt+R: Ret | Alt+M: Tüm M-M | Alt+S: Sil'
        : `${ogr ? `Listede ${ogr.siraNo}. sıra • ` : ''}Alt+Enter: Seanslar`;
    }
    if (q('#msa-btn-geri')) q('#msa-btn-geri').style.opacity = d.aktifIndex <= 0 ? '0.4' : '1';
    if (q('#msa-btn-ileri')) q('#msa-btn-ileri').style.opacity = d.aktifIndex >= adet - 1 ? '0.4' : '1';
  };
})();
