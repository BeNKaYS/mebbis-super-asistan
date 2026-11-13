/*
 * MEBBİS Süper Asistan — 1. Turbo Otomasyon
 * Öğrenci listesini sırayla açar, her öğrencinin seanslarını seçilen moda göre
 * onaylar / siler, listeye dönüp bir sonrakine geçer. Sayfa yenilense de
 * localStorage'daki durumdan devam eder.
 */
(function () {
  'use strict';
  const M = window.__MSA;
  if (!M || M.kilitli) return;

  const ANAHTAR = 'seansOtomasyonV3_Turbo';
  M.TURBO_ANAHTARI = ANAHTAR;

  /** Çalışma modları: hangi giriş/çıkış kombinasyonu onaylanır. */
  M.TURBO_MODLARI = {
    OO: 'Sadece %100 Otomatik (O - O)',
    TEK_OTO: 'Tek Tarafı Otomatik (O-M, M-O)',
    EN_AZ_BIR: 'En Az Biri Otomatik (O-O, O-M, M-O)',
    MANUELSE_SIL: 'En Az Biri Manuelse SİL (M-M, O-M, M-O)',
    HEPSI: 'Tümünü Onayla (M-M Dahil)',
  };

  const varsayilan = () => ({
    aktif: false,
    index: 0,
    toplamOgrenci: 0,
    aramaDenendi: false,
    log: [],
    baslangicZamani: null,
    bitisZamani: null,
    onayModu: 'OO',
  });

  M.turboOku = () => {
    try {
      const d = JSON.parse(localStorage.getItem(ANAHTAR));
      return d ? { ...varsayilan(), ...d } : varsayilan();
    } catch (e) {
      return varsayilan();
    }
  };
  M.turboYaz = (d) => localStorage.setItem(ANAHTAR, JSON.stringify(d));
  M.turboVarsayilan = varsayilan;

  M.turboDurumYaz = (metin) => {
    const el = document.getElementById('msa-turbo-durum');
    if (el) el.textContent = metin;
  };

  /** Bir seans satırı için yapılacak işlemi belirler: ONAYLA | SIL | ATLA */
  function satirKarari(tr, mod) {
    const giris = M.girisMetni(tr);
    const cikis = M.cikisMetni(tr);
    const gOto = giris.includes('Otomatik');
    const cOto = cikis.includes('Otomatik');
    const manuelVar = giris.includes('Manuel') || cikis.includes('Manuel');

    let islem = 'ATLA';
    switch (mod) {
      case 'OO': if (gOto && cOto) islem = 'ONAYLA'; break;
      case 'TEK_OTO': if (gOto !== cOto) islem = 'ONAYLA'; break;
      case 'EN_AZ_BIR': if (gOto || cOto) islem = 'ONAYLA'; break;
      case 'MANUELSE_SIL': if (manuelVar && M.denetlenmisMi(tr)) islem = 'SIL'; break;
      case 'HEPSI': islem = 'ONAYLA'; break;
    }
    return islem;
  }

  /** Açık öğrencinin tüm seanslarını işler. */
  async function seanslariIsle(mod, ogrIndex, toplamOgr) {
    const toplamSeans = M.seansSayisi();
    const sonuc = { onaylanan: 0, silinen: 0, atlanan: 0 };
    if (toplamSeans <= 0) return sonuc;

    for (let i = 1; i <= toplamSeans; i++) {
      if (!M.turboOku().aktif) return sonuc;
      const tr = M.seansSatirlari()[i];
      if (!tr) continue;

      const islem = satirKarari(tr, mod);
      if (islem === 'ATLA') { sonuc.atlanan++; continue; }

      const etiket = `Öğr ${ogrIndex + 1}/${toplamOgr} • Seans ${i}/${toplamSeans}`;
      try {
        if (islem === 'SIL') {
          M.turboDurumYaz(`${etiket} siliniyor...`);
          if (await M.satiraKararUygula(tr, 'SIL')) sonuc.silinen++;
        } else {
          M.turboDurumYaz(`${etiket} onaylanıyor...`);
          if (await M.satiraKararUygula(tr, 'ONAY')) sonuc.onaylanan++;
        }
      } catch (e) {
        console.error('Turbo seans hatası:', e);
        await M.modalKapat();
      }
    }
    return sonuc;
  }

  /** Öğrencinin seans tablosundayken: seansları işle, listeye dön. */
  async function ayrintiAdimi(durum) {
    const mod = durum.onayModu || 'OO';
    const toplam = durum.toplamOgrenci || M.listeSatirlari().length || 0;
    M.turboDurumYaz(`Öğrenci ${durum.index + 1}/${toplam}: Seanslar işleniyor...`);

    const sonuc = await seanslariIsle(mod, durum.index, toplam);
    durum = M.turboOku();
    if (!durum.aktif) { M.turboDurumYaz('⏹ Durduruldu'); return; }

    durum.log.push({ ogrenci: durum.index + 1, ...sonuc });
    durum.index += 1;
    M.turboYaz(durum);

    const ozet = [
      sonuc.onaylanan && `${sonuc.onaylanan} Onay`,
      sonuc.silinen && `${sonuc.silinen} Silindi`,
      sonuc.atlanan && `${sonuc.atlanan} Atlandı`,
    ].filter(Boolean).join(' ');
    M.turboDurumYaz(`⚡ Listeye dönülüyor... (${ozet || 'Değişiklik yok'})`);
    await M.bekle(200);
    M.listeyeDon();
  }

  /** Öğrenci listesindeyken: sıradaki öğrenciyi aç ya da bitir. */
  async function listeAdimi(durum) {
    M.turboDurumYaz('⚡ Liste kontrol ediliyor...');
    let satirlar = M.listeSatirlari();

    if (satirlar.length === 0) {
      if (!durum.aramaDenendi) {
        durum.aramaDenendi = true;
        M.turboYaz(durum);
        M.turboDurumYaz('🔍 Liste aranıyor...');
        document.querySelector('#btnAra')?.click();
      }
      await M.bekle(1500);
      satirlar = M.listeSatirlari();
      if (satirlar.length === 0) { M.turboDurdur('⚠ Liste gelmedi, durduruldu'); return; }
    }

    durum = M.turboOku();
    durum.aramaDenendi = false;
    const toplam = satirlar.length;
    durum.toplamOgrenci = toplam;

    if (durum.index >= toplam) {
      durum.aktif = false;
      durum.bitisZamani = Date.now();
      M.turboYaz(durum);
      M.turboDurumYaz(`🎉 Bitti! ${toplam} öğrenci tamamlandı`);
      M.toast(`🎉 Turbo Onay Bitti! ${toplam} öğrenci tamamlandı.`);
      return;
    }

    M.turboYaz(durum);
    M.turboDurumYaz(`⚡ Öğrenci ${durum.index + 1} / ${toplam} açılıyor...`);
    await M.bekle(200);
    const tr = satirlar[durum.index];
    const link = tr.querySelector('td:nth-child(1) a') || tr.querySelector('td:nth-child(1) img');
    if (link) M.tikla(link);
  }

  let calisiyor = false;
  /** Her sayfa yüklenişinde / postback sonrasında çağrılır. */
  M.turboAdim = async () => {
    if (M.durdurulduMu()) return;
    if (calisiyor) return;
    let durum = M.turboOku();
    if (!durum.aktif) return;

    calisiyor = true;
    try {
      await M.gorunurBekle(`${M.SEANS_TABLO}, #btnAra, ${M.LISTE_TABLO}`, 10000);
      durum = M.turboOku();
      if (!durum.aktif) return;
      if (M.seansTablosundaMi()) await ayrintiAdimi(durum);
      else if (M.listedeMi()) await listeAdimi(durum);
    } catch (e) {
      console.error('Turbo Akış Hatası:', e);
    } finally {
      calisiyor = false;
    }
  };

  M.turboBaslat = (mod, baslangicSirasi) => {
    M.durdurmaBayraginiTemizle();
    M.turboYaz({
      ...varsayilan(),
      aktif: true,
      index: Math.max(1, baslangicSirasi) - 1,
      baslangicZamani: Date.now(),
      onayModu: mod,
    });
    M.turboDurumYaz('Başlatıldı, taranıyor...');
    M.toast('⚡ Turbo Onay Başlatıldı!');
    M.turboAdim();
  };

  M.turboDurdur = (mesaj) => {
    const d = M.turboOku();
    d.aktif = false;
    d.bitisZamani = Date.now();
    M.turboYaz(d);
    M.turboDurumYaz(mesaj || '⏹ Durduruldu');
    M.toast(mesaj || '⏹ Turbo Onay Durduruldu');
  };
})();
