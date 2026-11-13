/*
 * MEBBİS Süper Asistan — Seans işlem çekirdeği
 * Seans açma, denetim kaydetme (onay/ret), denetim silme ve modal kapatma.
 * Eski sürümde 6 ayrı yerde kopyalanmış olan akışların tek kaynağı.
 */
(function () {
  'use strict';
  const M = window.__MSA;
  if (!M || M.kilitli) return;

  const SEC = {
    ramFoto: '#imgRamFoto',
    kamera: '#imgKamera',
    denetimBilgisi: '#btnDenetimBilgisi',
    aciklama: '#txtDenetimAciklama',
    uyumlu: '#rblUyumDurumu_0',
    uyumsuz: '#rblUyumDurumu_1',
    kaydet: '#btnDenetimKaydet',
    sil: '#btnDenetimSil',
    denetimKapat: '#pnlDenetimBilgisi div.takip-modal-baslik-kapat, #btnDenetimKapat',
    takipKapat: '#btnTakipKapat, div.takip-modal-baslik-kapat',
  };
  M.SEC = SEC;

  /** İlk eşleşen ve görünür elemanı döndürür (virgüllü seçicide sıra önemli). */
  const ilkGorunur = (seciciler) => {
    for (const s of seciciler.split(',')) {
      const el = document.querySelector(s.trim());
      if (el) return M.gorunur(el) ? el : null;
    }
    return null;
  };

  /** Öğrenci takip / seans inceleme penceresi açık mı? */
  M.modalAcikMi = () => M.gorunur(document.querySelector(SEC.ramFoto)) || M.gorunur(document.querySelector(SEC.denetimBilgisi));

  /** Yalnızca denetim (açıklama) alt penceresini kapatır. */
  M.denetimPenceresiniKapat = async () => {
    const btn = ilkGorunur(SEC.denetimKapat);
    if (btn) { btn.click(); await M.bekle(150); }
  };

  /** Tüm seans pencerelerini kapatır, büyüteci ve süre kartını temizler, tabloyu yeniden boyar. */
  M.modalKapat = async () => {
    M.lightboxKapat?.();
    document.getElementById('msa-pnl-sure-karti')?.remove();
    for (let i = 0; i < 3; i++) {
      const d = ilkGorunur(SEC.denetimKapat);
      const t = ilkGorunur(SEC.takipKapat);
      if (d) { d.click(); await M.bekle(150); }
      if (t) { t.click(); await M.bekle(150); }
      await M.postbackBekle(2000);
      const halaAcik =
        M.gorunur(document.querySelector('#btnTakipKapat')) ||
        M.gorunur(document.querySelector('#pnlDenetimBilgisi')) ||
        M.gorunur(document.querySelector(SEC.denetimBilgisi));
      if (!halaAcik) break;
    }
    M.manuelSatirlariBoya?.();
  };

  /** Satırın inceleme linkine tıklayıp seans penceresinin açılmasını bekler. */
  M.seansiAc = async (tr, { silIcin = false } = {}) => {
    const link = tr.querySelector('td:nth-child(19) a') || tr.querySelector('td:nth-child(19) img');
    if (!link) return false;
    M.tikla(link);
    const bekle = `${SEC.ramFoto}, ${SEC.denetimBilgisi}${silIcin ? `, ${SEC.sil}` : ''}`;
    const acildi = await M.gorunurBekle(bekle, 8000);
    if (!acildi) return false;
    await M.bekle(300);
    return true;
  };

  /**
   * Açık seans penceresinde denetim bilgisini doldurup kaydeder.
   * @param {'ONAY'|'RET'} karar
   * @returns {Promise<'kaydedildi'|'aciklama-yok'|'kaydet-yok'>}
   */
  M.denetimKaydet = async (karar) => {
    const bilgi = document.querySelector(SEC.denetimBilgisi);
    if (M.gorunur(bilgi)) bilgi.click();

    const aciklama = await M.gorunurBekle(SEC.aciklama, 6000);
    if (!aciklama) return 'aciklama-yok';
    await M.bekle(200);

    const radyo = await M.gorunurBekle(karar === 'ONAY' ? SEC.uyumlu : SEC.uyumsuz, 4000);
    if (radyo && !radyo.checked) { radyo.click(); await M.bekle(150); }

    M.degerYaz(aciklama, karar === 'ONAY' ? M.onayMetni() : M.retMetni());
    await M.bekle(200);

    const kaydet = await M.gorunurBekle(SEC.kaydet, 5000);
    if (!kaydet) return 'kaydet-yok';
    kaydet.click();
    await M.bekle(1800);
    await M.postbackBekle(6000);
    return 'kaydedildi';
  };

  /** Açık seans penceresindeki mevcut denetimi siler. */
  M.denetimSil = async () => {
    const bilgi = document.querySelector(SEC.denetimBilgisi);
    if (M.gorunur(bilgi)) {
      bilgi.click();
      await M.gorunurBekle(`${SEC.sil}, ${SEC.uyumlu}`, 4000);
    }
    const sil = await M.gorunurBekle(SEC.sil, 4000);
    if (!sil) return false;
    sil.click();
    await M.bekle(1800);
    await M.postbackBekle(6000);
    return true;
  };

  /**
   * Bir satırı aç → karar uygula → pencereyi kapat.
   * @param {HTMLTableRowElement} tr
   * @param {'ONAY'|'RET'|'SIL'} karar
   */
  M.satiraKararUygula = async (tr, karar) => {
    const acildi = await M.seansiAc(tr, { silIcin: karar === 'SIL' });
    if (!acildi) return false;
    const ok = karar === 'SIL' ? await M.denetimSil() : (await M.denetimKaydet(karar)) === 'kaydedildi';
    await M.modalKapat();
    return ok;
  };

  /**
   * Toplu işlem döngüsü: bul() her turda kalan satırları yeniden okur (tablo postback ile yenilenir).
   * İlerleme olmazsa (kayıt başarısız) sonsuz döngüye girmeden durur.
   * @returns {Promise<number>} işlenen satır sayısı
   */
  M.topluIsle = async ({ bul, karar, sinir, baslangic = 0, etiketle, durdurMesaji, ara = 350 }) => {
    let n = baslangic;
    while (true) {
      if (M.durdurulduMu()) { M.toast(durdurMesaji || '🛑 İşlem kullanıcı tarafından durduruldu.'); break; }
      const kalan = bul();
      if (kalan.length === 0) break;
      const s = kalan[0];
      n++;
      etiketle?.(s, n);
      const ok = await M.satiraKararUygula(s.tr, karar);
      if (!ok) break;
      await M.bekle(ara);
      if (n >= sinir) break;
    }
    return n;
  };
})();
