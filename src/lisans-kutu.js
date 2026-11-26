/*
 * MEBBİS Süper Asistan — Lisans uyarı kutusu (ISOLATED world)
 * Lisans geçersizse sayfanın köşesinde bilgi kutusu gösterir. Asıl kontrol background.js'tedir.
 */
(function () {
  'use strict';
  chrome.runtime.sendMessage({ type: 'CHECK_LICENSE' }, (d) => {
    if (chrome.runtime.lastError || !d || d.valid || document.getElementById('msa-lic-box')) return;
    const kutu = document.createElement('div');
    kutu.id = 'msa-lic-box';
    kutu.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:99999999;background:#18181f;color:#fff;' +
      'border:2px solid #ff453a;border-radius:14px;padding:16px 20px;font:13px -apple-system,sans-serif;' +
      'box-shadow:0 12px 40px rgba(0,0,0,0.7);max-width:320px;line-height:1.5;text-align:center;';
    const satir = (metin, css) => {
      const e = document.createElement('div');
      e.style.cssText = css;
      e.textContent = metin;
      kutu.appendChild(e);
    };
    satir('⚠️', 'font-size:22px;margin-bottom:6px;');
    satir('LİSANS GEREKLİ', 'font-weight:800;color:#ff453a;font-size:14px;margin-bottom:4px;');
    satir(d.reason || 'Lisans anahtarı gerekli.', 'font-size:11px;color:#a1a1aa;margin-bottom:10px;');
    satir('Araç çubuğundaki MEBBİS Asistan simgesinden Makine Kodu\'nu kopyalayıp geliştiriciye gönderin.', 'font-size:11px;color:#a1a1aa;margin-bottom:8px;');
    satir(`Geliştirici: ${d.developer}`, 'border-top:1px solid #2d2d3a;padding-top:8px;font-size:11px;color:#5ac8fa;font-weight:700;');
    document.body.appendChild(kutu);
  });
})();
