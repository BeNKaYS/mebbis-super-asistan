/*
 * MEBBİS Süper Asistan — Yüzen panel
 * Sürüklenebilir, küçültülebilir, akordeonlu panel + ayarlar kutusu.
 */
(function () {
  'use strict';
  const M = window.__MSA;
  if (!M || M.kilitli) return;

  const KUCULT_ANAHTARI = 'msa_kucult_durum';
  const KONUM_ANAHTARI = 'msa_panel_pos';
  const AKORDEONLAR = [
    { icerik: 'msa-icerik-turbo', ikon: 'msa-ikon-turbo', baslik: 'msa-baslik-turbo' },
    { icerik: 'msa-icerik-gezgin', ikon: 'msa-ikon-gezgin', baslik: 'msa-baslik-gezgin' },
    { icerik: 'msa-icerik-rapor', ikon: 'msa-ikon-rapor', baslik: 'msa-baslik-rapor' },
    { icerik: 'msa-icerik-egitmen', ikon: 'msa-ikon-egitmen', baslik: 'msa-baslik-egitmen' },
  ];

  const BUYUK_BTN =
    'width:100%;color:#fff;border:none;border-radius:8px;padding:8px 4px;font-size:11px;font-weight:700;cursor:pointer;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;';
  const islemButonu = (id, baslik, arkaPlan, golge, metin, altMetin) => `
    <button id="${id}" title="${baslik}" style="${BUYUK_BTN}background:${arkaPlan};box-shadow:0 2px 8px ${golge};">
      <span id="${id}-txt" style="font-size:11.5px;">${metin}</span>
      <span style="font-size:9.5px;font-weight:600;opacity:0.9;">${altMetin}</span>
    </button>`;

  const akordeonBasligi = (id, ikonId, renk, emoji, metin, acik) => `
    <div id="${id}" style="padding:8px 10px;background:#272733;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-weight:700;font-size:12px;color:${renk};">
      <div style="display:flex;align-items:center;gap:6px;"><span>${emoji}</span><span>${metin}</span></div>
      <span id="${ikonId}" style="font-size:10px;color:#8e8e93;">${acik ? '▼' : '▶'}</span>
    </div>`;

  const KART = 'background:#20202a;border:1px solid #2f2f3d;border-radius:10px;overflow:hidden;';
  const SELECT = 'width:100%;font-size:11px;padding:5px;border-radius:5px;background:#18181f;cursor:pointer;margin-bottom:5px;';
  const TEXTAREA =
    'width:100%;background:#181820;color:#fff;border:1px solid #3c3c4f;border-radius:5px;padding:4px 6px;font-size:10.5px;' +
    'resize:vertical;font-family:inherit;line-height:1.3;box-sizing:border-box;';

  function panelHtml() {
    const modlar = Object.entries(M.TURBO_MODLARI)
      .map(([k, v]) => `<option value="${k}">${k === 'MANUELSE_SIL' ? '🗑️' : '🔘'} ${v}</option>`)
      .join('');
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #2d2d3a;padding-bottom:7px;cursor:grab;">
        <div style="display:flex;align-items:center;gap:7px;font-weight:800;font-size:12px;color:#007aff;letter-spacing:0.4px;">
          <span>⚡ MEBBİS ASİSTAN</span>
          <span style="font-size:10px;background:#003366;color:#5ac8fa;padding:2px 6px;border-radius:8px;font-weight:700;">v${M.SURUM}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span id="msa-ayar-btn" title="Görünüm, Şeffaflık ve Özel Açıklama Metinleri" style="cursor:pointer;color:#8e8e93;font-size:13px;padding:0 3px;">⚙️</span>
          <span id="msa-kucult" title="Küçült / Büyüt" style="cursor:pointer;color:#8e8e93;font-size:14px;padding:0 5px;font-weight:bold;">—</span>
        </div>
      </div>

      <div id="msa-ayar-kutu" style="display:none;background:#20202a;border:1px solid #3c3c4f;border-radius:10px;padding:10px;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2d2d3a;padding-bottom:5px;">
          <span style="font-size:11px;font-weight:800;color:#5ac8fa;">⚙️ GÖRÜNÜM & AÇIKLAMA AYARLARI</span>
          <span id="msa-ayar-kapat" style="cursor:pointer;font-size:12px;color:#8e8e93;padding:0 4px;">✕</span>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#d1d1d6;margin-bottom:3px;">
            <span>Boşta Şeffaflık (Fare Dışındayken):</span>
            <span id="msa-panel-slider-val" style="color:#5ac8fa;font-weight:800;">%25</span>
          </div>
          <input type="range" id="msa-panel-slider" min="5" max="100" step="5" value="25" style="width:100%;accent-color:#007aff;cursor:pointer;">
          <div style="font-size:9.5px;color:#8e8e93;margin-top:2px;">💡 Fare üzerine gelince otomatik %100 netleşir.</div>
        </div>
        <div>
          <label style="font-size:10.5px;font-weight:700;color:#30d158;display:block;margin-bottom:2px;">✔ Onay Metni (Uyumlu):</label>
          <textarea id="msa-panel-txt-onay" rows="2" style="${TEXTAREA}"></textarea>
        </div>
        <div>
          <label style="font-size:10.5px;font-weight:700;color:#ff453a;display:block;margin-bottom:2px;">✖ Ret Metni (Uyumsuz):</label>
          <textarea id="msa-panel-txt-ret" rows="2" style="${TEXTAREA}"></textarea>
        </div>
        <div style="display:flex;gap:5px;">
          <button id="msa-panel-btn-kaydet" style="flex:1;background:linear-gradient(135deg,#007aff,#0056b3);color:#fff;border:none;border-radius:5px;padding:6px;font-size:11px;font-weight:700;cursor:pointer;">💾 Ayarları Kaydet</button>
          <button id="msa-panel-btn-sifirla" title="Resmi yönetmelik metinlerine dön" style="background:#2a2a36;color:#d1d1d6;border:1px solid #444458;border-radius:5px;padding:6px 8px;font-size:11px;cursor:pointer;">🔄 Sıfırla</button>
        </div>
        <div id="msa-panel-ayar-durum" style="font-size:10px;text-align:center;color:#30d158;min-height:12px;"></div>
      </div>

      <div id="msa-govde" style="display:flex;flex-direction:column;gap:8px;">

        <div class="msa-akordeon-kart" style="${KART}">
          ${akordeonBasligi('msa-baslik-turbo', 'msa-ikon-turbo', '#5ac8fa', '⚡', '1. Turbo Otomasyon', true)}
          <div id="msa-icerik-turbo" style="padding:10px;display:flex;flex-direction:column;gap:8px;">
            <div>
              <label style="font-size:11px;font-weight:700;color:#8e8e93;display:block;margin-bottom:3px;">ÇALIŞMA MODU:</label>
              <select id="msa-turbo-mod" style="width:100%;font-size:12px;padding:5px;border:1px solid #444458;border-radius:6px;background:#18181f;color:#fff;cursor:pointer;">${modlar}</select>
            </div>
            <div id="msa-turbo-durum" style="font-size:11px;color:#a1a1aa;background:#18181f;padding:6px 8px;border-radius:6px;border:1px solid #2d2d3a;">Hazır. Modu seçip Başlat'a basın.</div>
            <div style="display:flex;gap:6px;">
              <button id="msa-turbo-baslat" style="flex:1;background:linear-gradient(135deg,#007aff,#0056b3);color:#fff;border:none;border-radius:6px;padding:7px;font-weight:700;font-size:12px;cursor:pointer;">▶ Turbo Başlat</button>
              <button id="msa-turbo-durdur" style="background:#2c2c38;color:#ff453a;border:1px solid #444458;border-radius:6px;padding:7px 10px;font-weight:600;font-size:12px;cursor:pointer;">⏹ Durdur</button>
            </div>
          </div>
        </div>

        <div class="msa-akordeon-kart" style="${KART}">
          ${akordeonBasligi('msa-baslik-gezgin', 'msa-ikon-gezgin', '#ff9f0a', '🧭', '2. Manuel Gezgin & Hızlı Onay')}
          <div id="msa-icerik-gezgin" style="padding:10px;display:none;flex-direction:column;gap:8px;">
            <div style="background:#18181f;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;border:1px solid #2d2d3a;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span id="msa-sayac" style="background:#ff9f0a;color:#1c1c1e;font-size:13px;font-weight:900;padding:2px 7px;border-radius:6px;">0 / 0</span>
                <span id="msa-tur" style="color:#ff9f0a;font-weight:700;font-size:11px;background:#3a2800;padding:2px 6px;border-radius:6px;border:1px solid #664600;">-</span>
              </div>
              <div id="msa-ad" style="font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Yükleniyor...</div>
              <div id="msa-seans-durum" style="font-size:11px;font-weight:700;color:#30d158;display:none;background:rgba(48,209,88,0.12);padding:3px 6px;border-radius:4px;border:1px solid rgba(48,209,88,0.25);"></div>
              <div id="msa-gezgin-alt" style="font-size:10px;color:#71717a;">Alt+A: Onayla | Alt+R: Ret | Alt+M: Tüm M-M | Alt+S: Sil</div>
            </div>

            <button id="msa-btn-seans" style="width:100%;background:linear-gradient(135deg,#007aff,#0056b3);color:#fff;border:none;border-radius:8px;padding:8px;font-size:12px;font-weight:700;cursor:pointer;">
              <span id="msa-btn-seans-txt">📂 Seanslarına Dön / Aç</span>
            </button>

            <div id="msa-gezgin-onay-kutu" style="display:none;grid-template-columns:1fr 1fr;gap:6px;">
              ${islemButonu('msa-btn-onayla', 'Seansı ve Aynı Gündeki Diğer Seansları Onayla (Alt + A)', 'linear-gradient(135deg,#30d158,#248a3d)', 'rgba(48,209,88,0.3)', '⚡ Seansı Onayla', '(Aynı Gün Dahil)')}
              ${islemButonu('msa-btn-ret-gun', 'Açık/Seçili Seansı ve Aynı Gündeki Diğer Seansları Ret Et (Alt + R)', 'linear-gradient(135deg,#ff9500,#d97706)', 'rgba(255,149,0,0.3)', '❌ Seansı Ret Et', '(Aynı Gün Dahil)')}
              ${islemButonu('msa-btn-sil', 'Bu Öğrencinin Tüm Manuel Seans Onaylarını Sil (Alt + S)', 'linear-gradient(135deg,#ff453a,#c92a2a)', 'rgba(255,69,58,0.25)', '🗑️ Onayları Sil', '(Tüm Manuel)')}
              ${islemButonu('msa-btn-ret-tum-mm', 'Öğrencinin Tüm M-M Seanslarını Otomatik Ret Et (Alt + M)', 'linear-gradient(135deg,#af52de,#7b2cbf)', 'rgba(175,82,222,0.3)', '🚫 Tüm M-M Ret', '(Öğrencinin Tümü)')}
            </div>

            <div style="display:flex;gap:6px;">
              <button id="msa-btn-geri" style="flex:1;background:#2c2c38;color:#fff;border:1px solid #444458;border-radius:8px;padding:7px;font-weight:700;cursor:pointer;">◀ Geri</button>
              <button id="msa-btn-ileri" style="flex:1.2;background:linear-gradient(135deg,#ff9f0a,#ff6b00);color:#fff;border:none;border-radius:8px;padding:7px;font-weight:700;cursor:pointer;">İleri ▶</button>
            </div>

            <div id="msa-gezgin-liste-kutu" style="display:none;">
              <button id="msa-btn-liste" style="width:100%;background:transparent;color:#8e8e93;border:1px dashed #444458;border-radius:6px;padding:4px 0;font-size:10px;cursor:pointer;">↩ Ana Öğrenci Listesine Dön</button>
            </div>
          </div>
        </div>

        <div class="msa-akordeon-kart" style="${KART}">
          ${akordeonBasligi('msa-baslik-rapor', 'msa-ikon-rapor', '#30d158', '📊', '3. Manuel Seans Raporlayıcı')}
          <div id="msa-icerik-rapor" style="padding:10px;display:none;flex-direction:column;gap:8px;">
            <div style="background:#18181f; border:1px solid #2d2d3a; border-radius:8px; padding:6px 9px; display:flex; align-items:center; justify-content:space-between;">
              <div>
                <span style="font-size:10px; font-weight:800; color:#8e8e93; display:block;">TARAMA SAYACI</span>
                <div id="msa-rapor-sayac" style="font-size:16px; font-weight:900; color:#fff;">0 / 0</div>
              </div>
              <div id="msa-rapor-bulunan" style="font-size:10px; font-weight:700; color:#ff453a; text-align:right;">Bulunan: 0 Kişi (0 Seans)</div>
            </div>

            <div style="background:#272733; border:1px solid #3a3a4c; border-radius:8px; padding:7px;">
              <label style="font-size:10px;font-weight:800;color:#5ac8fa;display:block;margin-bottom:3px;">1. TÜR: DENETİM ÖNCESİ KONTROL</label>
              <select id="msa-rapor-kontrol-mod" style="${SELECT}border:1px solid #444458;color:#fff;">
                <option value="TUM_M">1. M-M, M-O, O-M Listeleyen (Tümü)</option>
                <option value="MM">2. Sadece M-M Listeleyen (Çift Manuel)</option>
              </select>
              <button id="msa-rapor-baslat-kontrol" style="width:100%;background:#3572b0;color:#fff;border:none;border-radius:5px;padding:6px;font-weight:700;font-size:11px;cursor:pointer;">🔍 Kontrol Raporu Çıkar</button>
            </div>

            <div style="background:#2d2024; border:1px solid #552830; border-radius:8px; padding:7px;">
              <label style="font-size:10px;font-weight:800;color:#ff453a;display:block;margin-bottom:3px;">2. TÜR: ONAY DURUMU SÜZGECİ (18. SÜTUN)</label>
              <select id="msa-rapor-onay-mod" style="${SELECT}border:1px solid #ff453a;color:#ff453a;font-weight:700;">
                <option value="UYUMSUZ">⚠️ Sadece Onay Bekleyenler (Uyumsuz)</option>
                <option value="UYUMLU">✅ Sadece Onaylananlar (Uyumlu)</option>
              </select>
              <button id="msa-rapor-baslat-onay" style="width:100%;background:#d70015;color:#fff;border:none;border-radius:5px;padding:6px;font-weight:700;font-size:11px;cursor:pointer;">🔍 Onay Durumu Raporu Çıkar</button>
            </div>

            <button id="msa-rapor-sifirla" style="width:100%;background:#2c2c38;color:#a1a1aa;border:1px solid #444458;border-radius:6px;padding:5px;cursor:pointer;font-weight:600;font-size:10px;">🧹 Rapor Önbelleğini Sıfırla</button>
          </div>
        </div>

        <div class="msa-akordeon-kart" style="${KART}">
          ${akordeonBasligi('msa-baslik-egitmen', 'msa-ikon-egitmen', '#bf5af2', '👨‍🏫', '4. Eğitmen Raporu')}
          <div id="msa-icerik-egitmen" style="padding:10px;display:none;flex-direction:column;gap:8px;">
            <div style="background:#18181f; border:1px solid #2d2d3a; border-radius:8px; padding:6px 9px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <div>
                <span style="font-size:10px; font-weight:800; color:#8e8e93; display:block;">TARAMA SAYACI</span>
                <div id="msa-egitmen-sayac" style="font-size:16px; font-weight:900; color:#fff;">0 / 0</div>
              </div>
              <div id="msa-egitmen-durum" style="font-size:10px; font-weight:700; color:#bf5af2; text-align:right;">Hazır</div>
            </div>
            <div style="background:#272733; border:1px solid #3a3a4c; border-radius:8px; padding:7px;">
              <label style="font-size:10px;font-weight:800;color:#bf5af2;display:block;margin-bottom:3px;">TARAMA MODU</label>
              <select id="msa-egitmen-mod" style="${SELECT}border:1px solid #444458;color:#fff;">
                <option value="HIZLI">⚡ Hızlı: Eğitmen, öğrenci, seans, ders süresi</option>
                <option value="DETAYLI">🔍 Detaylı: + Eğitmen giriş-çıkış uyumu (yavaş)</option>
              </select>
              <button id="msa-egitmen-baslat" style="width:100%;background:linear-gradient(135deg,#bf5af2,#8e44ad);color:#fff;border:none;border-radius:5px;padding:6px;font-weight:700;font-size:11px;cursor:pointer;">👨‍🏫 Eğitmen Raporu Çıkar</button>
            </div>
            <div style="display:flex;gap:6px;">
              <button id="msa-egitmen-goster" style="flex:1;background:#2c2c38;color:#d1d1d6;border:1px solid #444458;border-radius:6px;padding:5px;cursor:pointer;font-weight:600;font-size:10px;">📄 Son Raporu Aç</button>
              <button id="msa-egitmen-durdur" style="flex:1;background:#2c2c38;color:#ff453a;border:1px solid #444458;border-radius:6px;padding:5px;cursor:pointer;font-weight:600;font-size:10px;">⏹ Durdur</button>
            </div>
          </div>
        </div>

        <div style="text-align:center;font-size:10px;color:#71717a;border-top:1px solid #2d2d3a;padding-top:4px;margin-top:2px;">
          Geliştirici: <strong style="color:#5ac8fa;">${M.GELISTIRICI}</strong>
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // Ayarlar kutusu
  // ---------------------------------------------------------------------------
  function ayarlariBagla(panel) {
    const $ = (id) => panel.querySelector(`#${id}`);
    const kutu = $('msa-ayar-kutu');
    const slider = $('msa-panel-slider');
    const sliderDeger = $('msa-panel-slider-val');
    const txtOnay = $('msa-panel-txt-onay');
    const txtRet = $('msa-panel-txt-ret');
    const durum = $('msa-panel-ayar-durum');

    const doldur = () => {
      const yuzde = Math.round(M.seffaflik() * 100);
      slider.value = yuzde;
      sliderDeger.textContent = `%${yuzde}`;
      txtOnay.value = M.onayMetni();
      txtRet.value = M.retMetni();
    };
    const durumYaz = (metin) => {
      durum.textContent = metin;
      setTimeout(() => { durum.textContent = ''; }, 2500);
    };

    $('msa-ayar-btn').onclick = (e) => {
      e.stopPropagation();
      const acik = kutu.style.display === 'flex';
      kutu.style.display = acik ? 'none' : 'flex';
      if (!acik) doldur();
    };
    $('msa-ayar-kapat').onclick = (e) => { e.stopPropagation(); kutu.style.display = 'none'; };

    slider.oninput = (e) => {
      const v = parseInt(e.target.value, 10);
      sliderDeger.textContent = `%${v}`;
      localStorage.setItem('msa_seffaflik', (v / 100).toFixed(2));
      M.seffaflikUygula();
    };

    $('msa-panel-btn-kaydet').onclick = (e) => {
      e.stopPropagation();
      localStorage.setItem('msa_onay_metni', txtOnay.value.trim() || M.VARSAYILAN_ONAY);
      localStorage.setItem('msa_ret_metni', txtRet.value.trim() || M.VARSAYILAN_RET);
      durumYaz('✅ Ayarlar kaydedildi!');
      M.toast('💾 Görünüm ve metin ayarları kaydedildi!');
    };

    $('msa-panel-btn-sifirla').onclick = (e) => {
      e.stopPropagation();
      localStorage.removeItem('msa_onay_metni');
      localStorage.removeItem('msa_ret_metni');
      localStorage.setItem('msa_seffaflik', '0.25');
      M.seffaflikUygula();
      doldur();
      durumYaz('🔄 Resmi metinlere dönüldü!');
      M.toast('🔄 Resmi yönetmelik ayarları yüklendi.');
    };
  }

  // ---------------------------------------------------------------------------
  // Akordeon ve küçültme
  // ---------------------------------------------------------------------------
  function akordeonlariBagla(panel) {
    const goster = (aktifId) => {
      AKORDEONLAR.forEach((a) => {
        const icerik = panel.querySelector(`#${a.icerik}`);
        const ikon = panel.querySelector(`#${a.ikon}`);
        const acik = a.icerik === aktifId;
        icerik.style.display = acik ? 'flex' : 'none';
        ikon.textContent = acik ? '▼' : '▶';
      });
    };

    let baslangic = localStorage.getItem(M.AKORDEON_ANAHTARI) || 'msa-icerik-gezgin';
    if (M.turboOku().aktif) baslangic = 'msa-icerik-turbo';
    else if (M.raporOku().aktif) baslangic = 'msa-icerik-rapor';
    else if (M.egitmenOku().aktif) baslangic = 'msa-icerik-egitmen';
    goster(baslangic);

    AKORDEONLAR.forEach((a) => {
      panel.querySelector(`#${a.baslik}`).onclick = () => {
        const acikti = panel.querySelector(`#${a.icerik}`).style.display === 'flex';
        const yeni = acikti ? 'none' : a.icerik;
        goster(yeni);
        M.akordeonHatirla(yeni);
      };
    });

    let kucuk = localStorage.getItem(KUCULT_ANAHTARI) === '1';
    const kucultUygula = () => {
      panel.querySelector('#msa-govde').style.display = kucuk ? 'none' : 'flex';
      panel.querySelector('#msa-kucult').textContent = kucuk ? '＋' : '—';
      panel.style.minWidth = kucuk ? '160px' : '310px';
    };
    kucultUygula();
    panel.querySelector('#msa-kucult').onclick = () => {
      kucuk = !kucuk;
      localStorage.setItem(KUCULT_ANAHTARI, kucuk ? '1' : '0');
      kucultUygula();
    };
  }

  // ---------------------------------------------------------------------------
  // Modül butonları
  // ---------------------------------------------------------------------------
  function butonlariBagla(panel) {
    const tik = (id, akordeon, fn) => {
      panel.querySelector(`#${id}`).onclick = (e) => {
        e.preventDefault();
        if (akordeon) M.akordeonHatirla(akordeon);
        fn();
      };
    };

    // Turbo
    const modSec = panel.querySelector('#msa-turbo-mod');
    modSec.value = M.turboOku().onayModu || 'OO';
    modSec.onchange = () => {
      const d = M.turboOku();
      d.onayModu = modSec.value;
      M.turboYaz(d);
      M.turboDurumYaz(`Mod: ${modSec.options[modSec.selectedIndex].text}`);
    };
    tik('msa-turbo-baslat', 'msa-icerik-turbo', () => {
      // Not: window.alert kasıtlı olarak ezildiği için uyarılar toast ile gösterilir
      if (!M.listedeMi()) { M.toast('⚠ Lütfen önce ana öğrenci listesi ekranına gelin.'); return; }
      const d = M.turboOku();
      const oneri = d.index > 0 ? d.index + 1 : 1;
      const cevap = prompt(`[${modSec.options[modSec.selectedIndex].text}]\nKaçıncı öğrenciden başlansın? (1 = en baştan)`, String(oneri));
      if (cevap === null) return;
      M.turboBaslat(modSec.value, parseInt(cevap, 10) || 1);
    });
    tik('msa-turbo-durdur', null, () => M.turboDurdur('⏹ Durduruldu'));

    // Gezgin
    const G = 'msa-icerik-gezgin';
    tik('msa-btn-seans', G, M.seanslaraGit);
    tik('msa-btn-onayla', G, M.onayla);
    tik('msa-btn-ret-gun', G, M.retEt);
    tik('msa-btn-sil', G, M.tumOnaylariSil);
    tik('msa-btn-ret-tum-mm', G, M.tumMMRet);
    tik('msa-btn-geri', G, () => M.ogrenciGecis(-1));
    tik('msa-btn-ileri', G, () => M.ogrenciGecis(1));
    tik('msa-btn-liste', G, M.listeyeDon);

    // Rapor
    const kontrolMod = panel.querySelector('#msa-rapor-kontrol-mod');
    const onayMod = panel.querySelector('#msa-rapor-onay-mod');
    tik('msa-rapor-baslat-kontrol', null, () => M.raporBaslat('KONTROL', kontrolMod.value, onayMod.value));
    tik('msa-rapor-baslat-onay', null, () => M.raporBaslat('ONAY', kontrolMod.value, onayMod.value));
    tik('msa-rapor-sifirla', null, () => {
      M.raporTemizle();
      document.title = 'MEBBİS';
      M.raporSayacGuncelle(M.raporVarsayilan());
      M.toast('🧹 Rapor önbelleği temizlendi.');
    });

    // Eğitmen raporu
    const egtMod = panel.querySelector('#msa-egitmen-mod');
    egtMod.value = M.egitmenOku().mod || 'HIZLI';
    tik('msa-egitmen-baslat', null, () => M.egitmenBaslat(egtMod.value));
    tik('msa-egitmen-goster', 'msa-icerik-egitmen', () => M.egitmenRaporGoster());
    tik('msa-egitmen-durdur', 'msa-icerik-egitmen', () => M.egitmenDurdur());
  }

  // ---------------------------------------------------------------------------
  // Sürükle-bırak (konum hatırlanır)
  // ---------------------------------------------------------------------------
  function surukle(panel, tutamak) {
    tutamak.style.cursor = 'grab';
    const sinirla = (x, y) => ({
      x: Math.max(10, Math.min(x, Math.max(10, window.innerWidth - panel.offsetWidth - 10))),
      y: Math.max(10, Math.min(y, Math.max(10, window.innerHeight - panel.offsetHeight - 10))),
    });
    const konumla = (x, y) => {
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    };

    try {
      const k = JSON.parse(localStorage.getItem(KONUM_ANAHTARI));
      if (k && typeof k.x === 'number' && typeof k.y === 'number') {
        konumla(
          Math.min(Math.max(10, k.x), Math.max(10, window.innerWidth - 100)),
          Math.min(Math.max(10, k.y), Math.max(10, window.innerHeight - 80))
        );
      }
    } catch (e) { /* kayıt yok */ }

    let surukleniyor = false, baslaX = 0, baslaY = 0, solX = 0, ustY = 0;
    tutamak.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, select, input, a, #msa-kucult, #msa-ayar-btn')) return;
      surukleniyor = true;
      tutamak.style.cursor = 'grabbing';
      baslaX = e.clientX; baslaY = e.clientY;
      const r = panel.getBoundingClientRect();
      solX = r.left; ustY = r.top;
      konumla(solX, ustY);
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!surukleniyor) return;
      const p = sinirla(solX + (e.clientX - baslaX), ustY + (e.clientY - baslaY));
      konumla(p.x, p.y);
    });
    window.addEventListener('mouseup', () => {
      if (!surukleniyor) return;
      surukleniyor = false;
      tutamak.style.cursor = 'grab';
      document.body.style.userSelect = '';
      try {
        const r = panel.getBoundingClientRect();
        localStorage.setItem(KONUM_ANAHTARI, JSON.stringify({ x: r.left, y: r.top }));
      } catch (e) { /* yoksay */ }
    });
  }

  // ---------------------------------------------------------------------------
  M.panelOlustur = () => {
    if (document.getElementById('msa-panel') || !document.body) return;
    const panel = document.createElement('div');
    panel.id = 'msa-panel';
    panel.style.cssText =
      'position:fixed;bottom:20px;right:20px;z-index:9999999;background:#18181f;color:#f3f4f6;border-radius:14px;padding:12px 14px;' +
      'box-shadow:0 12px 40px rgba(0,0,0,0.55);border:1px solid #323242;font:13px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;' +
      'display:flex;flex-direction:column;gap:8px;min-width:310px;max-width:340px;user-select:none;backdrop-filter:blur(14px);';
    panel.innerHTML = panelHtml();
    document.body.appendChild(panel);
    M.panel = panel;

    M.seffaflikUygula();
    ayarlariBagla(panel);
    akordeonlariBagla(panel);
    butonlariBagla(panel);
    surukle(panel, panel.firstElementChild);
    M.raporSayacGuncelle(M.raporOku());
    M.egitmenSayacGuncelle(M.egitmenOku(), M.egitmenOku().aktif ? 'Taranıyor...' : undefined);
  };
})();
