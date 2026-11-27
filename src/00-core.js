/*
 * MEBBİS Süper Asistan — Çekirdek
 * Ortak ad alanı, lisans kontrolü, ayarlar ve DOM yardımcıları.
 * Tüm modüller window.__MSA üzerinden birbirine erişir (MAIN world).
 * Geliştirici: Sercan ÖZDEMİR
 */
(function () {
  'use strict';

  const M = (window.__MSA = window.__MSA || {});
  M.SURUM = '6.4.1';
  M.GELISTIRICI = 'Sercan ÖZDEMİR';

  // ---------------------------------------------------------------------------
  // MEBBİS onay/uyarı pencerelerini otomatik geç (Kaydet / Sil sonrası çıkan confirm/alert)
  // ---------------------------------------------------------------------------
  const herZamanEvet = function () { return true; };
  try {
    window.confirm = herZamanEvet;
    window.alert = herZamanEvet;
    Object.defineProperty(window, 'confirm', { value: herZamanEvet, writable: true, configurable: true });
    Object.defineProperty(window, 'alert', { value: herZamanEvet, writable: true, configurable: true });
  } catch (e) { /* bazı sayfalarda tanımlanamayabilir */ }

  // ---------------------------------------------------------------------------
  // Genel yardımcılar
  // ---------------------------------------------------------------------------
  M.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  M.bekle = (ms) => new Promise((r) => setTimeout(r, ms));
  M.gorunur = (el) => !!el && el.offsetParent !== null;
  M.$ = (sel, kok = document) => kok.querySelector(sel);
  M.$$ = (sel, kok = document) => [...kok.querySelectorAll(sel)];

  /** Seçici görünür olana kadar bekler; görünür elemanı veya null döner. */
  M.gorunurBekle = async (sel, sure = 10000) => {
    const son = Date.now() + sure;
    while (Date.now() < son) {
      const el = document.querySelector(sel);
      if (M.gorunur(el)) return el;
      await M.bekle(60);
    }
    return null;
  };

  /** ASP.NET UpdatePanel async postback bitene kadar bekler. */
  M.postbackBekle = async (sure = 6000) => {
    const son = Date.now() + sure;
    while (Date.now() < son) {
      try {
        const prm = window.Sys?.WebForms?.PageRequestManager?.getInstance();
        if (!prm || !prm.get_isInAsyncPostBack()) break;
      } catch (e) { break; }
      await M.bekle(60);
    }
  };

  M.xpath = (yol, kok = document) => {
    try {
      return document.evaluate(yol, kok, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (e) { return null; }
  };

  /**
   * MEBBİS linklerini güvenli tıklar.
   * javascript:__doPostBack(...) linklerinde postback tek sefer doğrudan çağrılır
   * (eski sürümdeki çift/üçlü tetikleme kaldırıldı).
   */
  M.tikla = (el) => {
    if (!el) return;
    const a = el.tagName && el.tagName.toLowerCase() === 'a' ? el : el.closest('a');
    const href = ((a || el).getAttribute('href') || '').trim();

    if (/^javascript:/i.test(href)) {
      const kod = href.replace(/^javascript:/i, '');
      const pb = kod.match(/__doPostBack\s*\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/);
      if (pb && typeof window.__doPostBack === 'function') {
        window.__doPostBack(pb[1], pb[2]);
        return;
      }
      try {
        const s = document.createElement('script');
        s.textContent = kod;
        (document.head || document.documentElement).appendChild(s);
        s.remove();
        return;
      } catch (e) { /* CSP engellerse normal tıklamaya düş */ }
    }

    const hedef = (a && a.querySelector('img')) || el;
    try {
      const o = { bubbles: true, cancelable: true, view: window };
      hedef.dispatchEvent(new MouseEvent('mousedown', o));
      hedef.dispatchEvent(new MouseEvent('mouseup', o));
      if (typeof hedef.click === 'function') hedef.click();
      else hedef.dispatchEvent(new MouseEvent('click', o));
    } catch (e) { /* yoksay */ }
  };

  /** Metin kutusuna değer yazıp input/change tetikler. */
  M.degerYaz = (el, deger) => {
    el.value = deger;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // ---------------------------------------------------------------------------
  // Toast bildirimi
  // ---------------------------------------------------------------------------
  let toastEl = null;
  M.toast = (mesaj, sure = 3000) => {
    if (!document.body) return;
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement('div');
      toastEl.id = 'msa-toast';
      toastEl.style.cssText =
        'position:fixed;bottom:110px;right:24px;z-index:99999999;background:rgba(20,20,25,0.95);color:#fff;' +
        'padding:10px 18px;border-radius:12px;font:600 13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;' +
        'box-shadow:0 10px 30px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.2);transition:all .25s ease;' +
        'opacity:0;pointer-events:none;transform:translateY(8px);max-width:350px;backdrop-filter:blur(10px);';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = mesaj;
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateY(0)';
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
      if (!toastEl) return;
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(8px)';
    }, sure);
  };

  // ---------------------------------------------------------------------------
  // Acil durdurma bayrağı
  // ---------------------------------------------------------------------------
  /** Durdurma istendiyse bayrağı tüketir ve true döner. */
  M.durdurulduMu = () => {
    if (window.__msaDurdur) { window.__msaDurdur = false; return true; }
    return false;
  };
  /** Kullanıcı yeni işlem başlattığında eski/bayat durdurma bayrağını temizler. */
  M.durdurmaBayraginiTemizle = () => { window.__msaDurdur = false; };

  // ---------------------------------------------------------------------------
  // Ayarlar (sayfa localStorage'ı; popup da buraya yazar)
  // ---------------------------------------------------------------------------
  M.VARSAYILAN_ONAY =
    'Millî Eğitim Bakanlığı Özel Eğitim Kurumları Yönetmeliği gereği yapılan inceleme sonucu, ilçe komisyonu adına onay verilmiştir.';
  M.VARSAYILAN_RET =
    '652 sayılı KHK ve Millî Eğitim Bakanlığı Özel Eğitim Kurumları Yönetmeliği gereği yapılan inceleme sonucu, ilgili kayıttaki uyumsuzluk nedeniyle ilçe komisyonu adına ret edilmiştir.';

  M.onayMetni = () => (localStorage.getItem('msa_onay_metni') || '').trim() || M.VARSAYILAN_ONAY;
  M.retMetni = () => (localStorage.getItem('msa_ret_metni') || '').trim() || M.VARSAYILAN_RET;

  M.seffaflik = () => {
    const v = parseFloat(localStorage.getItem('msa_seffaflik'));
    return !isNaN(v) && v >= 0.05 && v <= 1 ? v : 0.25;
  };
  M.seffaflikAktif = () => localStorage.getItem('msa_seffaflik_aktif') !== 'false';
  M.seffaflikUygula = () => {
    const panel = document.getElementById('msa-panel');
    if (!panel) return;
    panel.style.setProperty('--msa-seffaflik', M.seffaflik());
    panel.classList.toggle('msa-transparan', M.seffaflikAktif());
  };
  window.addEventListener('msa_ayarlar_guncellendi', () => M.seffaflikUygula());

  M.AKORDEON_ANAHTARI = 'msa_aktif_akordeon';
  M.akordeonHatirla = (id) => localStorage.setItem(M.AKORDEON_ANAHTARI, id);

  // ---------------------------------------------------------------------------
  // MEBBİS sayfa / tablo yardımcıları
  // ---------------------------------------------------------------------------
  M.SEANS_TABLO = '#dgEgitimAyrinti';
  M.LISTE_TABLO = '#dgListele';

  /** Satırın n. hücresinin metni (kırpılmış). */
  M.hucre = (tr, n) => ((tr && tr.querySelector(`td:nth-child(${n})`)) || {}).innerText?.trim() || '';

  M.seansTablosundaMi = () => M.gorunur(document.querySelector(M.SEANS_TABLO));
  M.listedeMi = () => !M.seansTablosundaMi() && !!document.querySelector(M.LISTE_TABLO);

  /** Seans tablosundaki tüm tr'ler (0 = başlık). */
  M.seansSatirlari = () => document.querySelectorAll(`${M.SEANS_TABLO} tr`);
  M.seansSayisi = () => Math.max(0, M.seansSatirlari().length - 1);

  /** Öğrenci listesindeki tıklanabilir satırlar. */
  M.listeSatirlari = () => M.$$(`${M.LISTE_TABLO} > tbody > tr`).filter((tr) => tr.querySelector('td:nth-child(1) a'));

  /** Seans satırı sütunları: 14 giriş, 15 çıkış, 18 denetim, 19 inceleme linki, 5 tarih, 6 saat. */
  M.girisMetni = (tr) => M.hucre(tr, 14);
  M.cikisMetni = (tr) => M.hucre(tr, 15);
  M.denetimMetni = (tr) => M.hucre(tr, 18);
  M.satirTarihi = (tr) => (tr ? M.hucre(tr, 5) : '');
  M.manuelMi = (tr) => M.girisMetni(tr).includes('Manuel') || M.cikisMetni(tr).includes('Manuel');
  M.ciftManuelMi = (tr) => M.girisMetni(tr).includes('Manuel') && M.cikisMetni(tr).includes('Manuel');

  /** "K(*)" (KGS) işareti: hem ana listede (K(*):7(%88)) hem seans tablosunda 14/15. sütunda çıkar. */
  M.KGS_RE = /K(?:GS)?\s*\(\s*\*\s*\)/i;
  M.kgsMi = (tr) => M.KGS_RE.test(M.hucre(tr, 14)) || M.KGS_RE.test(M.hucre(tr, 15));
  /** Giriş/çıkış hücresini tek harfe indirger: K(*) → K, Manuel → M, diğer → O */
  M.taraf = (metin) => (M.KGS_RE.test(metin) ? 'K' : metin.includes('Manuel') ? 'M' : 'O');

  /** Denetim (18. sütun) metnini yorumlar. */
  M.denetimDurumu = (metin) => {
    const m = (metin || '').trim().toLowerCase();
    const uyumsuz = m.includes('uyumsuz');
    return { uyumlu: m.includes('uyumlu') && !uyumsuz, uyumsuz };
  };
  M.denetlenmisMi = (tr) => {
    const d = M.denetimMetni(tr);
    return d.length > 0 && d !== '-';
  };
  M.seansLinki = (tr) =>
    tr.querySelector('td:nth-child(19) a') || tr.querySelector('td:nth-child(19) input') || tr.querySelector('td:nth-child(19) img');

  /** "12/03/2026" → 12 */
  M.gunNo = (tarih) => {
    const p = String(tarih).split('/');
    return p.length >= 1 ? parseInt(p[0], 10) : tarih;
  };

  /** Ad soyadın başındaki 11 haneli TC'yi atar. */
  M.tcTemizle = (s) => (s ? s.replace(/^\d{11}\s*-?\s*/, '').trim() : '');

  M.kurumBilgisi = () => {
    const secili = (sel) => {
      const s = document.querySelector(sel);
      return s?.options[s.selectedIndex]?.text || '';
    };
    const yil = secili('select[name*="Yil"], #ddlYil');
    const ay = secili('select[name*="Ay"], #ddlAy');
    return {
      kurumAdi: secili('select[name*="Kurum"], #ddlKurum') || 'Özel Eğitim Kurumu',
      yilAy: `${ay} ${yil}`.trim(),
    };
  };

  M.listeyeDon = () => {
    const geri = document.querySelector('#btnGeri') || document.querySelector('#btnListeyeDon');
    if (geri) geri.click();
    else window.history.back();
  };

  /** "HH:MM" veya "H.MM" → { dk, str }; bulunamazsa null. */
  M.saatDk = (metin) => {
    const m = (metin || '').match(/(\d{1,2})[:.](\d{2})/);
    return m ? { dk: parseInt(m[1], 10) * 60 + parseInt(m[2], 10), str: `${m[1].padStart(2, '0')}:${m[2]}` } : null;
  };
  M.sureFarki = (bas, bit) => {
    let f = bit - bas;
    if (f < 0) f += 1440;
    return f;
  };

  // ---------------------------------------------------------------------------
  // Lisans kapısı: süre dolduysa diğer modüller hiç çalışmaz
  // ---------------------------------------------------------------------------
  // Lisans kontrolü background.js'te; betikler yalnızca lisans geçerliyken eklenir.
  M.kilitli = false;
})();
