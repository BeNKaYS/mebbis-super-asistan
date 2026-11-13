/*
 * MEBBİS Süper Asistan — Başlatıcı
 * Klavye kısayolları, sayfa yüklenince / ASP.NET postback sonrası yeniden kurulum.
 *
 * Kısayollar
 *  Büyüteç (lightbox) açıkken : A onay · R ret · ←/→ seans · Space diğer foto · Esc/Z kapat
 *  Seans penceresi açıkken    : ←/→ seans · Z büyüteç · Space diğer foto
 *  Her yerde                  : Alt+A (veya Alt+O) onay · Alt+R ret · Alt+M tüm M-M ret · Alt+S sil
 *                               Alt+←/→ önceki/sonraki öğrenci (pencere açıksa seans) · Alt+Enter seanslar
 */
(function () {
  'use strict';
  const M = window.__MSA;
  if (!M || M.kilitli) return;

  const tus = (e, harf) => e.code === `Key${harf}` || e.key === harf.toLowerCase() || e.key === harf;
  const sonrakiSeans = (yon) => M.seansaGit((M.aktifSeansNo() || 1) + yon);
  const gezgin = (fn) => { M.akordeonHatirla('msa-icerik-gezgin'); fn(); };

  window.addEventListener('keydown', (e) => {
    const etiket = (e.target?.tagName || '').toLowerCase();
    if (etiket === 'input' || etiket === 'textarea' || etiket === 'select') return;

    // 1) Büyüteç açık
    if (M.lightboxAcikMi()) {
      if (e.key === 'Escape' || tus(e, 'Z')) { e.preventDefault(); M.lightboxKapat(); return; }
      if (e.code === 'Space') { e.preventDefault(); M.digerFotoyaGec(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); sonrakiSeans(1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); sonrakiSeans(-1); return; }
      if (tus(e, 'A')) { e.preventDefault(); if (!M.seriAcik()) M.lightboxKapat(); M.onayla(); return; }
      if (tus(e, 'R')) { e.preventDefault(); if (!M.seriAcik()) M.lightboxKapat(); M.retEt(); return; }
    }

    // 2) Seans penceresi açık (değiştirici tuş yok)
    const pencereAcik = M.modalAcikMi();
    if (pencereAcik && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.key === 'ArrowRight') { e.preventDefault(); sonrakiSeans(1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); sonrakiSeans(-1); return; }
      if (tus(e, 'Z')) { e.preventDefault(); M.lightboxAcikMi() ? M.lightboxKapat() : M.lightboxAc(); return; }
      if (e.code === 'Space' && document.querySelector('#rptOlaylar_ctl02_btnOlay, input[id*="btnOlay"], a[id*="btnOlay"]')) {
        e.preventDefault();
        M.digerFotoyaGec();
        return;
      }
    }

    // 3) Alt kısayolları
    if (!e.altKey) return;
    if (tus(e, 'A') || tus(e, 'O')) { e.preventDefault(); gezgin(M.onayla); }
    else if (tus(e, 'R')) { e.preventDefault(); gezgin(M.retEt); }
    else if (tus(e, 'M')) { e.preventDefault(); gezgin(M.tumMMRet); }
    else if (tus(e, 'S')) { e.preventDefault(); gezgin(M.tumOnaylariSil); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const yon = e.key === 'ArrowRight' ? 1 : -1;
      if (pencereAcik) sonrakiSeans(yon);
      else gezgin(() => M.ogrenciGecis(yon));
    } else if (e.key === 'Enter') { e.preventDefault(); gezgin(M.seanslaraGit); }
  });

  /** Sayfa durumuna göre ekranı hazırlar ve devam eden otomasyonları sürdürür. */
  function sayfayiHazirla() {
    M.stilleriEkle();
    M.panelOlustur();
    if (M.seansTablosundaMi()) {
      M.manuelSatirlariBoya();
      M.modalGorselleriniHazirla();
      M.gezginPaneliGuncelle(M.ogrenciBasligi().adSoyad);
    } else if (M.listedeMi()) {
      M.listeSayfasiHazirla();
    }
    if (M.turboOku().aktif) M.turboAdim();
    if (M.raporOku().aktif) M.raporAdim();
    if (M.egitmenOku().aktif) M.egitmenAdim();
  }

  if (document.body) sayfayiHazirla();
  else window.addEventListener('DOMContentLoaded', sayfayiHazirla);
  window.addEventListener('load', sayfayiHazirla);

  // UpdatePanel (async postback) bittikçe yeniden kur
  const postbackDinle = () => {
    try {
      const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();
      if (!prm || prm.__msaBagli) return !!prm;
      prm.__msaBagli = true;
      prm.add_endRequest(() => {
        M.stilleriEkle();
        M.panelOlustur();
        if (M.seansTablosundaMi()) { M.manuelSatirlariBoya(); M.modalGorselleriniHazirla(); }
        else if (M.listedeMi()) M.listeSayfasiHazirla();
        if (M.turboOku().aktif) M.turboAdim();
        if (M.raporOku().aktif) M.raporAdim();
        if (M.egitmenOku().aktif) M.egitmenAdim();
      });
      return true;
    } catch (e) {
      return false;
    }
  };
  // Sys betiği content script'ten sonra yüklenebilir → load'da tekrar dene
  if (!postbackDinle()) window.addEventListener('load', postbackDinle);

  // Nöbetçi: panel silindiyse geri getir, pencere açıksa süre kartını güncel tut
  setInterval(() => {
    if (!document.getElementById('msa-panel')) M.panelOlustur();
    if (M.seansTablosundaMi()) M.modalGorselleriniHazirla();
    if (M.listedeMi() && M.gezginOku().bekleyenGecis != null) M.listeSayfasiHazirla();
  }, 350);
})();
