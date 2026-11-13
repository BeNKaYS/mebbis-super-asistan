/*
 * MEBBİS Süper Asistan — Süre kartı, RAM/Kamera karşılaştırma (lightbox) ve zoom
 * - Öğrenci kamera giriş/çıkış saatinden gerçekleşen süreyi hesaplar,
 *   günlük seans sayısına göre gereken asgari süreyle karşılaştırır.
 * - Eğitmenin kurum giriş/çıkışının seansı kapsayıp kapsamadığını kontrol eder.
 * - Seans penceresi başlığına kompakt bir süre kartı + gezinme butonları ekler.
 */
(function () {
  'use strict';
  const M = window.__MSA;
  if (!M || M.kilitli) return;

  /** Yönetmelik: seans başına 40 dk + seanslar arası 10 dk. */
  const SEANS_DK = 40;
  const ARA_DK = 10;
  M.gerekenSure = (seansSayisi) => {
    const n = Math.max(1, parseInt(seansSayisi, 10) || 1);
    return n * SEANS_DK + (n - 1) * ARA_DK;
  };

  let ramFotoYedek = '';

  // ---------------------------------------------------------------------------
  // Stiller
  // ---------------------------------------------------------------------------
  M.stilleriEkle = () => {
    if (document.getElementById('msa-gorsel-stiller')) return;
    const st = document.createElement('style');
    st.id = 'msa-gorsel-stiller';
    st.textContent = `
      .msa-sure-badge{display:inline-flex!important;align-items:center!important;gap:3px!important;font-size:11px!important;font-weight:700!important;padding:2px 7px!important;border-radius:6px!important;margin-left:6px!important;vertical-align:middle!important;line-height:1.2!important;box-shadow:0 1px 3px rgba(0,0,0,.08)!important;cursor:help!important}
      .msa-sure-tam{background:#e8f5e9!important;color:#1b5e20!important;border:1px solid #81c784!important}
      .msa-sure-eksik{background:#ffebee!important;color:#b71c1c!important;border:1px solid #ef5350!important;animation:msaPulse 2s infinite ease-in-out!important}
      .msa-sure-plan{background:#f3e5f5!important;color:#4a148c!important;border:1px solid #ce93d8!important}
      @keyframes msaPulse{0%{box-shadow:0 0 0 0 rgba(239,83,80,.4)}70%{box-shadow:0 0 0 6px rgba(239,83,80,0)}100%{box-shadow:0 0 0 0 rgba(239,83,80,0)}}
      .msa-zoomable-img{cursor:crosshair!important;transform-origin:center center;user-select:none!important}
      .msa-btn-dev-onizle{background:linear-gradient(135deg,#007aff,#5856d6)!important;color:#fff!important;border:none!important;border-radius:6px!important;padding:5px 10px!important;font-size:11px!important;font-weight:700!important;cursor:pointer!important;display:inline-flex!important;align-items:center!important;gap:5px!important;box-shadow:0 2px 6px rgba(0,122,255,.3)!important;margin-bottom:6px!important;transition:transform .1s ease!important}
      .msa-btn-dev-onizle:hover{transform:scale(1.03)!important}
      .msa-btn-nav{background:#232533!important;color:#e2e8f0!important;border:1px solid #3f4458!important;border-radius:4px!important;padding:1px 6px!important;font-size:10px!important;font-weight:800!important;height:19px!important;line-height:1!important;cursor:pointer!important;transition:all .15s ease!important;user-select:none!important}
      .msa-btn-nav:hover:not(:disabled){background:#3b82f6!important;border-color:#60a5fa!important;color:#fff!important}
      .msa-btn-nav:disabled{opacity:.35!important;cursor:not-allowed!important}
      .msa-badge-seans{background:#181924!important;color:#38ef7d!important;border:1px solid #1f5636!important;border-radius:4px!important;padding:1px 6px!important;font-size:10px!important;font-weight:800!important;line-height:1.1!important;letter-spacing:.5px!important;user-select:none!important}
      .msa-btn-seri{border-radius:4px!important;padding:1px 6px!important;font-size:9.5px!important;font-weight:800!important;height:19px!important;line-height:1!important;cursor:pointer!important;transition:all .15s ease!important;user-select:none!important}
      .msa-btn-seri:hover{filter:brightness(1.2)!important}
      #msa-lightbox-overlay{position:fixed!important;inset:0!important;background:rgba(10,10,15,.88)!important;backdrop-filter:blur(10px)!important;z-index:99999999!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif!important;user-select:none!important;animation:msaFadeIn .2s ease-out!important}
      @keyframes msaFadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
      #msa-panel{transition:opacity .25s cubic-bezier(.4,0,.2,1),transform .2s ease,box-shadow .25s ease!important}
      #msa-panel.msa-transparan{opacity:var(--msa-seffaflik,.25)!important}
      #msa-panel.msa-transparan:hover,#msa-panel.msa-transparan:focus-within{opacity:1!important;box-shadow:0 16px 50px rgba(0,0,0,.85)!important}
    `;
    (document.head || document.documentElement).appendChild(st);
  };

  M.rozetleriTemizle = () => document.querySelectorAll('.msa-sure-badge').forEach((b) => b.remove());

  // ---------------------------------------------------------------------------
  // Süre hesabı
  // ---------------------------------------------------------------------------
  /** rptOlaylar_ctlNN_btnOlay içindeki saat metni (ctl01 öğr. giriş, 02 öğr. çıkış, 03 eğt. giriş, 04 eğt. çıkış). */
  function olaySaati(nn) {
    const id = `rptOlaylar_ctl${nn}_btnOlay`;
    const el =
      M.xpath(`//*[@id="${id}"]/span[2]`) ||
      document.querySelector(`#${id} > span:nth-child(2)`) ||
      document.querySelector(`#${id} span:nth-of-type(2)`) ||
      document.querySelector(`#${id}`);
    return el ? M.saatDk(el.innerText || '') : null;
  }
  M.olaySaati = olaySaati; // Eğitmen raporu da kullanır

  /** Aynı tarihte (ve aynı öğrencide) kaç seans var — gereken süre buna göre. */
  function gunlukSeansSayisi(tarih, adSoyad) {
    if (!tarih) return 1;
    const norm = (s) => (s || '').replace(/[\/\-]/g, '.').trim();
    const hedef = norm(tarih);
    let n = 0;
    const satirlar = M.seansSatirlari();
    for (let i = 1; i < satirlar.length; i++) {
      const tr = satirlar[i];
      if (norm(M.satirTarihi(tr)) !== hedef) continue;
      if (adSoyad) {
        const ad = M.tcTemizle(`${M.hucre(tr, 2)} ${M.hucre(tr, 3)}`);
        if (ad && ad !== adSoyad) continue;
      }
      n++;
    }
    return n > 0 ? n : 1;
  }

  /** Açık seans satırını bulur: seçili → çerçeveli → tarihe göre. */
  function aktifSatir() {
    const satirlar = M.seansSatirlari();
    if (M.secili.no && satirlar[M.secili.no]) return satirlar[M.secili.no];
    for (let i = 1; i < satirlar.length; i++) {
      const o = satirlar[i].style.outline;
      if (o && o !== 'none') return satirlar[i];
    }
    const tarih = M.aktifTarih();
    if (tarih) for (let i = 1; i < satirlar.length; i++) if (M.satirTarihi(satirlar[i]) === tarih) return satirlar[i];
    return null;
  }

  M.sureHesapla = () => {
    let ogrGiris = olaySaati('01');
    let ogrCikis = olaySaati('02');
    const satir = aktifSatir();
    const dersSaatMetin = satir ? M.hucre(satir, 6) : '';

    // Olay butonlarında saat yoksa tablo sütunlarından (14/15) dene
    let gerceklesenDk = null;
    let gSaatStr = '', cSaatStr = '';
    if (ogrGiris && ogrCikis) {
      gerceklesenDk = M.sureFarki(ogrGiris.dk, ogrCikis.dk);
      gSaatStr = ogrGiris.str; cSaatStr = ogrCikis.str;
    } else if (satir) {
      const g = M.saatDk(M.girisMetni(satir));
      const c = M.saatDk(M.cikisMetni(satir));
      if (g && c) {
        gerceklesenDk = M.sureFarki(g.dk, c.dk);
        gSaatStr = g.str; cSaatStr = c.str;
      }
    }

    // Planlanan ders süresi "09:00 - 09:40"
    let planlananDk = SEANS_DK;
    const plan = dersSaatMetin.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
    const planBas = plan ? parseInt(plan[1], 10) * 60 + parseInt(plan[2], 10) : null;
    const planBit = plan ? parseInt(plan[3], 10) * 60 + parseInt(plan[4], 10) : null;
    if (plan) {
      const f = M.sureFarki(planBas, planBit);
      if (f > 0) planlananDk = f;
    }

    const modalTarih = (satir ? M.satirTarihi(satir) : null) || M.aktifTarih() || '';
    const { adSoyad: ogrenciAdSoyad } = M.ogrenciBasligi();
    const seansSayisi = gunlukSeansSayisi(modalTarih, ogrenciAdSoyad);
    const gerekenDk = M.gerekenSure(seansSayisi);
    const tamMi = gerceklesenDk !== null ? gerceklesenDk >= gerekenDk : null;
    const eksikDk = gerceklesenDk !== null && gerceklesenDk < gerekenDk ? gerekenDk - gerceklesenDk : 0;

    const sureMetin = `${gerceklesenDk !== null ? gerceklesenDk : planlananDk} dk`;
    const renk = tamMi ? ['#0d3b1e', '#30d158', '#1b5e20'] : tamMi === false ? ['#3d1215', '#ff453a', '#7a1c22'] : ['#1c2438', '#5ac8fa', '#254b77'];
    let uyariHtml = '';
    if (tamMi === true) {
      uyariHtml = '<span style="color:#30d158;font-size:10px;font-weight:800;background:rgba(48,209,88,0.15);padding:1px 5px;border-radius:3px;border:1px solid #1b5e20;">✅ Uygun</span>';
    } else if (tamMi === false) {
      uyariHtml = `<span style="color:#fff;background:#ff3b30;font-size:10px;font-weight:800;padding:1px 5px;border-radius:3px;border:1px solid #b71c1c;animation:msaPulse 1.8s infinite ease-in-out;">⚠️ ${eksikDk} dk Eksik!</span>`;
    }

    // Eğitmen giriş/çıkış kapsama kontrolü
    const eGiris = olaySaati('03');
    const eCikis = olaySaati('04');
    const eGirisStr = eGiris ? eGiris.str : '';
    const eCikisStr = eCikis ? eCikis.str : '';
    const seansBas = ogrGiris ? ogrGiris.dk : planBas;
    const seansBit = ogrCikis ? ogrCikis.dk : planBit;

    let egitmenKapsiyorMu = null, egitmenKapsamaMesaji = '', egitmenBadgeHtml = '';
    if (eGiris && eCikis && seansBas !== null && seansBit !== null) {
      const girisOk = eGiris.dk <= seansBas;
      const cikisOk = eCikis.dk >= seansBit;
      egitmenKapsiyorMu = girisOk && cikisOk;
      if (egitmenKapsiyorMu) {
        egitmenKapsamaMesaji = `Eğitmen seans saatlerini eksiksiz kapsıyor (${eGirisStr} - ${eCikisStr})`;
        egitmenBadgeHtml = `<span style="color:#30d158;background:rgba(48,209,88,0.15);padding:1px 5px;border-radius:3px;border:1px solid #1b5e20;font-size:10px;font-weight:700;" title="✅ ${egitmenKapsamaMesaji}">👨‍🏫 Eğt: ${eGirisStr}-${eCikisStr} ✅</span>`;
      } else {
        const sorunlar = [];
        if (!girisOk) sorunlar.push(`Giriş ${eGiris.dk - seansBas} dk geç`);
        if (!cikisOk) sorunlar.push(`Çıkış ${seansBit - eCikis.dk} dk erken`);
        egitmenKapsamaMesaji = `Eğitmen seansı KAPSAMIYOR! (${sorunlar.join(', ')})`;
        egitmenBadgeHtml = `<span style="color:#fff;background:#ff3b30;padding:1px 5px;border-radius:3px;border:1px solid #b71c1c;font-size:10px;font-weight:800;animation:msaPulse 1.8s infinite ease-in-out;" title="⚠️ ${egitmenKapsamaMesaji} (Eğt: ${eGirisStr}-${eCikisStr})">⚠️ Eğt: ${sorunlar.join(' | ')}</span>`;
      }
    } else if (eGirisStr || eCikisStr) {
      const g = eGirisStr || '--:--', c = eCikisStr || '--:--';
      egitmenBadgeHtml = `<span style="color:#5ac8fa;background:#1c2438;padding:1px 5px;border-radius:3px;border:1px solid #254b77;font-size:10px;" title="Eğitmen Saatleri: ${g} - ${c}">👨‍🏫 Eğt: ${g}-${c}</span>`;
    }

    return {
      planlananDk, gerceklesenDk, gSaatStr, cSaatStr, dersSaatMetin, modalTarih, ogrenciAdSoyad,
      seansSayisi, gerekenDk, eksikDk, tamMi, sureMetin,
      badgeBg: renk[0], badgeRenk: renk[1], badgeBorder: renk[2], uyariHtml,
      eGirisStr, eCikisStr, egitmenKapsiyorMu, egitmenKapsamaMesaji, egitmenBadgeHtml,
    };
  };

  const navButonu = (id, ok, baslik, kapali) =>
    `<button id="${id}" class="msa-btn-nav" title="${baslik}" ${kapali ? 'disabled style="opacity:0.35;cursor:not-allowed;"' : 'style="cursor:pointer;"'}>${ok}</button>`;

  // ---------------------------------------------------------------------------
  // Seans penceresi başlığındaki süre kartı
  // ---------------------------------------------------------------------------
  M.sureKartiCiz = () => {
    const pencere =
      document.querySelector('#pnlOgrenciTakip') ||
      document.querySelector('#pnlDenetimBilgisi') ||
      document.querySelector('#imgRamFoto')?.closest('.modal, div[id*="Modal"], div[id*="pnl"], table');
    if (!pencere || !M.gorunur(pencere)) {
      document.getElementById('msa-pnl-sure-karti')?.remove();
      return;
    }

    // Kartı başlık satırına yerleştir
    const baslik = M.xpath('//*[@id="pnlOgrenciTakip"]/div/div[1]/div[2]') || document.querySelector('#pnlOgrenciTakip > div > div:nth-child(1) > div:nth-child(2)');
    let kart = document.getElementById('msa-pnl-sure-karti');
    if (!kart) { kart = document.createElement('div'); kart.id = 'msa-pnl-sure-karti'; }

    if (baslik) {
      Object.assign(baslik.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
      if (kart.parentElement !== baslik) baslik.appendChild(kart);
    } else {
      const alt = pencere.querySelector('div.takip-modal-baslik, div[class*="baslik"], tr:first-child');
      const ram = document.querySelector('#imgRamFoto');
      if (alt?.parentElement && kart.parentElement !== alt.parentElement) {
        alt.parentElement.insertBefore(kart, alt.nextSibling);
      } else if (ram && kart.parentElement !== pencere) {
        const kap = ram.closest('table, div[id*="Foto"], div[class*="foto"]') || ram.parentElement;
        if (kap?.parentElement) kap.parentElement.insertBefore(kart, kap);
        else pencere.insertBefore(kart, pencere.firstChild);
      }
    }

    const s = M.sureHesapla();
    const sorunVar = s.tamMi === false || s.egitmenKapsiyorMu === false;
    const cerceve = sorunVar ? '#ff453a' : s.tamMi ? '#248a3d' : '#3a3a4c';
    kart.style.cssText =
      `background:#14141b !important; border:1px solid ${cerceve} !important; border-radius:5px !important; ` +
      'padding:1px 8px !important; margin:0 4px !important; display:inline-flex !important; align-items:center !important; ' +
      'gap:5px !important; box-shadow:0 2px 6px rgba(0,0,0,0.3) !important; height:24px !important; max-height:24px !important; ' +
      'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif !important; user-select:none !important; ' +
      'vertical-align:middle !important; box-sizing:border-box !important; white-space:nowrap !important;';

    // Ayrıntılı ipucu
    const ipucu = [];
    if (s.tamMi !== null) ipucu.push(s.tamMi ? '✅ MEB Öğrenci Süresi: Yönetmeliğe Uygun' : `⚠️ DİKKAT: Öğrenci Süresi Eksik (${s.eksikDk} dk eksik)!`);
    ipucu.push(`• Öğrenci: ${s.ogrenciAdSoyad || 'Öğrenci'} (${s.modalTarih || 'Tarih Yok'})`);
    ipucu.push(`• Günlük Seans: ${s.seansSayisi} seans (Gereken asgari süre: ${s.gerekenDk} dk)`);
    ipucu.push(`• Öğrenci Kamera: ${s.gerceklesenDk !== null ? s.gerceklesenDk : s.planlananDk} dk (${s.gSaatStr || '--:--'} - ${s.cSaatStr || '--:--'})`);
    if (s.eGirisStr || s.eCikisStr) {
      ipucu.push('----------------------------------------', '👨‍🏫 EĞİTMEN KURUM GİRİŞ / ÇIKIŞI:', `• Eğitmen Saatleri: ${s.eGirisStr || '--:--'} - ${s.eCikisStr || '--:--'}`);
      if (s.egitmenKapsiyorMu === true) ipucu.push('• Durum: ✅ Eğitmen, öğrencinin seans saatlerini EKSİKSİZ KAPSIYOR.');
      else if (s.egitmenKapsiyorMu === false) ipucu.push('• Durum: ⚠️ DİKKAT: EĞİTMEN SEANS SAATLERİNİ KAPSAMIYOR!', `  ${s.egitmenKapsamaMesaji}`);
    }
    kart.title = ipucu.join('\n');

    const toplam = M.seansSayisi();
    const mevcut = M.aktifSeansNo() || 1;
    const seri = M.seriAcik();
    const gezinme = toplam > 0 ? `
      <div style="display:inline-flex;align-items:center;gap:3px;margin-left:4px;padding-left:4px;border-left:1px solid #3a3a4c;">
        ${navButonu('msa-btn-seans-onceki', '◀', 'Önceki Seans (Kısayol: Sol Ok ←)', mevcut <= 1)}
        <span id="msa-badge-seans-sayac" class="msa-badge-seans" title="Mevcut Seans: ${mevcut} / ${toplam} (Kısayol: Sol / Sağ Ok)">${mevcut}/${toplam}</span>
        ${navButonu('msa-btn-seans-sonraki', '▶', 'Sonraki Seans (Kısayol: Sağ Ok →)', mevcut >= toplam)}
        <button id="msa-btn-seri-ilerle" class="msa-btn-seri"
          style="background:${seri ? '#133926' : '#2b2c3a'} !important;color:${seri ? '#4ade80' : '#9ca3af'} !important;border:1px solid ${seri ? '#166534' : '#4b5563'} !important;"
          title="Açık olduğunda onay (A) veya ret (R) verildiğinde modal kapanmadan otomatik sıradaki seansa geçer. Tıklayarak aç/kapa.">
          ${seri ? '⚡ Seri: AÇIK' : '⏸️ Seri: KAPALI'}
        </button>
      </div>` : '';

    const html = `
      <span style="font-size:12px;line-height:1;">${sorunVar ? '⚠️' : '⏱️'}</span>
      <span style="font-size:10.5px;font-weight:800;color:#f3f4f6;">Öğr:</span>
      <span style="background:${s.badgeBg};color:${s.badgeRenk};border:1px solid ${s.badgeBorder};padding:1px 5px;border-radius:4px;font-size:11px;font-weight:900;line-height:1.1;">${s.sureMetin}</span>
      <span style="font-size:10px;color:#9ca3af;font-weight:600;">(${s.gSaatStr || '--:--'} - ${s.cSaatStr || '--:--'})</span>
      <span style="font-size:10px;color:#e2e8f0;background:#242731;padding:1px 4px;border-radius:3px;border:1px solid #3e4451;font-weight:600;">${s.seansSayisi}S (${s.gerekenDk}dk)</span>
      ${s.uyariHtml}
      ${s.egitmenBadgeHtml}
      ${gezinme}
      <button id="msa-btn-dev-karsilastir" class="msa-btn-dev-onizle" style="margin:0 0 0 2px !important;padding:2px 6px !important;font-size:10px !important;height:18px !important;line-height:1 !important;border-radius:4px !important;" title="RAM fotoğrafı ile kamera kaydını devasa yan yana açar (Kısayol: Z)">
        <span>🔍 Büyüt</span>
        <span style="font-size:8px;background:rgba(255,255,255,0.25);padding:1px 3px;border-radius:2px;margin-left:2px;">Z</span>
      </button>`;

    // Nöbetçi 350 ms'de bir çağırır: içerik aynıysa yeniden çizme (titreme/hover kaybı olmasın)
    if (kart._sonHtml === html) return;
    kart._sonHtml = html;
    kart.innerHTML = html;

    const tikla = (id, fn) => {
      const b = kart.querySelector(id);
      if (b && !b.disabled) b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
    };
    tikla('#msa-btn-dev-karsilastir', M.lightboxAc);
    tikla('#msa-btn-seans-onceki', () => M.seansaGit(mevcut - 1));
    tikla('#msa-btn-seans-sonraki', () => M.seansaGit(mevcut + 1));
    tikla('#msa-btn-seri-ilerle', () => {
      const yeni = !M.seriAcik();
      M.seriAyarla(yeni);
      M.sureKartiCiz();
      M.toast(yeni ? '⚡ Seri İnceleme modu açıldı: Onay/Ret sonrası otomatik sonrakine geçer.' : '⏸️ Seri İnceleme modu kapatıldı.');
    });
  };

  /** Seans penceresi açıldığında: RAM fotoğrafını önbelleğe al, kameraya zoom bağla, kartı çiz. */
  M.modalGorselleriniHazirla = () => {
    const ram = document.querySelector('#imgRamFoto');
    const kam = document.querySelector('#imgKamera');
    if (M.gorunur(ram) && ram.src && ram.src.startsWith('http')) ramFotoYedek = ram.src;
    if (M.gorunur(kam)) M.zoomBagla(kam);
    M.sureKartiCiz();
  };

  // ---------------------------------------------------------------------------
  // Zoom (fareyle büyüteç)
  // ---------------------------------------------------------------------------
  M.zoomBagla = (img) => {
    if (!img || img.dataset.msaZoomBagli === '1') return;
    img.dataset.msaZoomBagli = '1';
    img.classList.add('msa-zoomable-img');
    img.removeAttribute('title');

    let olcek = 2.6;
    let aktif = false;
    if (img.parentElement && !img.parentElement.id?.includes('msa-lb')) img.parentElement.style.overflow = 'visible';

    const orijin = (e) => {
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      return `${x}% ${y}%`;
    };
    const uygula = (e) => {
      const o = orijin(e);
      if (!o) return;
      img.style.transformOrigin = o;
      img.style.transform = `scale(${olcek})`;
    };

    img.addEventListener('mouseenter', () => {
      aktif = true;
      img.removeAttribute('title');
      Object.assign(img.style, {
        position: 'relative', zIndex: '9999999', boxShadow: '0 16px 45px rgba(0,0,0,0.7)',
        borderRadius: '8px', outline: '2px solid #007aff', cursor: 'crosshair', transition: 'transform 0.05s ease-out',
      });
    });
    img.addEventListener('mousemove', (e) => { if (aktif) uygula(e); });
    img.addEventListener(
      'wheel',
      (e) => {
        if (!aktif) return;
        e.preventDefault();
        olcek = e.deltaY < 0 ? Math.min(6, olcek + 0.35) : Math.max(1.4, olcek - 0.35);
        uygula(e);
      },
      { passive: false }
    );
    img.addEventListener('mouseleave', () => {
      aktif = false;
      Object.assign(img.style, {
        transition: 'transform 0.2s ease-out', transformOrigin: 'center center', transform: 'scale(1)',
        zIndex: '', boxShadow: '', outline: '', cursor: 'zoom-in',
      });
      olcek = 2.6;
    });
  };

  // ---------------------------------------------------------------------------
  // Lightbox: RAM fotoğrafı ↔ kamera kaydı yan yana
  // ---------------------------------------------------------------------------
  const LB = 'msa-lightbox-overlay';
  M.lightboxAcikMi = () => {
    const el = document.getElementById(LB);
    return !!el && el.style.display !== 'none';
  };
  M.lightboxKapat = () => document.getElementById(LB)?.remove();

  const fotolar = () => {
    const ram = document.querySelector('#imgRamFoto');
    const kam = document.querySelector('#imgKamera');
    return { ram: ram?.src || ramFotoYedek || '', kam: kam?.src || '' };
  };
  const sureEtiketi = (s) => `⏱️ Eğitim Süresi: ${s.sureMetin} (${s.gSaatStr || '--:--'} - ${s.cSaatStr || '--:--'})`;

  /** Seans değiştiğinde açık lightbox'ı yeniden doldurur. */
  M.lightboxGuncelle = () => {
    const lb = document.getElementById(LB);
    if (!lb) return;
    const f = fotolar();
    if (f.ram) lb.querySelector('#msa-lb-ram-img').src = f.ram;
    if (f.kam) lb.querySelector('#msa-lb-kam-img').src = f.kam;

    const toplam = M.seansSayisi();
    const mevcut = M.aktifSeansNo() || 1;
    const s = M.sureHesapla();
    lb.querySelector('#msa-lb-baslik').textContent = M.ogrenciBasligi().adSoyad || 'Öğrenci Seans Karşılaştırma';
    lb.querySelector('#msa-lb-tarih').textContent = M.aktifTarih() || 'Seçili Seans';
    const sure = lb.querySelector('#msa-lb-sure');
    Object.assign(sure.style, { background: s.badgeBg, color: s.badgeRenk, borderColor: s.badgeBorder });
    sure.textContent = sureEtiketi(s);
    const uyari = lb.querySelector('#msa-lb-uyari');
    if (uyari) uyari.innerHTML = s.uyariHtml;

    const sayac = lb.querySelector('#msa-lb-badge-seans');
    if (sayac) sayac.textContent = `${mevcut}/${toplam}`;
    const ayarla = (btn, kapali) => {
      if (!btn) return;
      btn.disabled = kapali;
      btn.style.opacity = kapali ? '0.35' : '1';
      btn.style.cursor = kapali ? 'not-allowed' : 'pointer';
    };
    ayarla(lb.querySelector('#msa-lb-btn-onceki'), mevcut <= 1);
    ayarla(lb.querySelector('#msa-lb-btn-sonraki'), mevcut >= toplam);
  };

  const kisayol = (tus, renk, aciklama) =>
    `<span style="background:#2c2c38;padding:2px 6px;border-radius:4px;color:#fff;font-weight:700;">${tus}</span> <span style="color:${renk};">${aciklama}</span>`;

  const fotoKarti = (imgId, etiket, etiketStil, sagUst) => `
    <div style="background:#20202a;border:1px solid #2f2f3d;border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
        <span style="font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px;${etiketStil}">${etiket}</span>
        ${sagUst}
      </div>
      <div style="width:100%;height:360px;background:#0d0d12;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid #3a3a4c;">
        <img id="${imgId}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;transition:transform 0.2s;cursor:zoom-in;">
      </div>
    </div>`;

  M.lightboxAc = () => {
    M.lightboxKapat();
    const f = fotolar();
    if (!f.ram && !f.kam) { M.toast('⚠ Gösterilecek fotoğraf bulunamadı.'); return; }

    const toplam = M.seansSayisi();
    const mevcut = M.aktifSeansNo() || 1;
    const s = M.sureHesapla();

    const lb = document.createElement('div');
    lb.id = LB;
    lb.innerHTML = `
      <div style="background:#18181f;border:1px solid #323242;border-radius:16px;padding:18px 22px;max-width:920px;width:95%;box-shadow:0 24px 60px rgba(0,0,0,0.85);display:flex;flex-direction:column;gap:14px;position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2d2d3a;padding-bottom:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:22px;">🔍</span>
            <div>
              <div id="msa-lb-baslik" style="font-size:14px;font-weight:800;color:#fff;"></div>
              <div style="font-size:11px;color:#a1a1aa;margin-top:3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span>Tarih: <strong id="msa-lb-tarih" style="color:#5ac8fa;"></strong></span>
                <span>&bull;</span>
                <span id="msa-lb-sure" style="border:1px solid;padding:1px 7px;border-radius:5px;font-weight:900;"></span>
                <span id="msa-lb-uyari"></span>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${toplam > 0 ? `
              <div style="display:flex;align-items:center;gap:4px;background:#20202a;padding:3px 7px;border-radius:6px;border:1px solid #3a3a4c;">
                ${navButonu('msa-lb-btn-onceki', '◀', 'Önceki Seans (Sol Ok: ←)', mevcut <= 1)}
                <span id="msa-lb-badge-seans" class="msa-badge-seans" style="font-size:11px;">${mevcut}/${toplam}</span>
                ${navButonu('msa-lb-btn-sonraki', '▶', 'Sonraki Seans (Sağ Ok: →)', mevcut >= toplam)}
              </div>` : ''}
            <button id="msa-lightbox-btn-kapat" style="background:#2c2c38;color:#a1a1aa;border:1px solid #444458;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">✕ Kapat (Esc / Z)</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
          ${fotoKarti('msa-lb-ram-img', '🏛️ RAM REFERANS FOTOĞRAFI', 'color:#5ac8fa;background:#003366;', '<span style="font-size:10px;color:#8e8e93;">Resmi Kayıt</span>')}
          ${fotoKarti('msa-lb-kam-img', '📷 CANLI KAMERA KAYDI', 'color:#30d158;background:#0d3b1e;',
            '<button id="msa-lb-btn-olay-gec" style="background:#2c2c38;color:#5ac8fa;border:1px solid #444458;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;" title="Giriş / Çıkış fotoğrafını değiştirir (Boşluk / Space)">🔄 Diğer Foto (Space)</button>')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;background:#20202a;border:1px solid #2f2f3d;border-radius:10px;padding:10px 14px;">
          <div style="font-size:11px;color:#a1a1aa;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <span>Kısayollar:</span>
            ${kisayol('A', '#30d158', 'Onayla')}
            ${kisayol('R', '#ff9500', 'Ret Et')}
            ${kisayol('← / →', '#a78bfa', 'Önceki/Sonraki')}
            ${kisayol('Space', '#5ac8fa', 'Çıkış Foto')}
            ${kisayol('Esc / Z', '#a1a1aa', 'Kapat')}
          </div>
          <div style="display:flex;gap:8px;">
            <button id="msa-lb-btn-onayla" style="background:linear-gradient(135deg,#30d158,#248a3d);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(48,209,88,0.3);">
              <span>⚡ Uyumlu Onayla</span> <span style="font-size:10px;opacity:0.85;">(A)</span>
            </button>
            <button id="msa-lb-btn-ret" style="background:linear-gradient(135deg,#ff9500,#d97706);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(255,149,0,0.3);">
              <span>❌ Uyumsuz Ret Et</span> <span style="font-size:10px;opacity:0.85;">(R)</span>
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(lb);

    // Metinler textContent ile yazılır (öğrenci adı vb. HTML olarak yorumlanmaz)
    lb.querySelector('#msa-lb-baslik').textContent = s.ogrenciAdSoyad || 'Öğrenci Seans Karşılaştırma';
    lb.querySelector('#msa-lb-tarih').textContent = M.aktifTarih() || 'Seçili Seans';
    const sure = lb.querySelector('#msa-lb-sure');
    Object.assign(sure.style, { background: s.badgeBg, color: s.badgeRenk, borderColor: s.badgeBorder });
    sure.textContent = sureEtiketi(s);
    lb.querySelector('#msa-lb-uyari').innerHTML = s.uyariHtml;
    if (f.ram) lb.querySelector('#msa-lb-ram-img').src = f.ram;
    if (f.kam) lb.querySelector('#msa-lb-kam-img').src = f.kam;

    lb.querySelector('#msa-lightbox-btn-kapat').onclick = M.lightboxKapat;
    lb.onclick = (e) => { if (e.target === lb) M.lightboxKapat(); };
    // Gezinme butonları her zaman bağlanır; disabled durumu lightboxGuncelle ile değişir
    const onceki = lb.querySelector('#msa-lb-btn-onceki');
    if (onceki) onceki.onclick = () => M.seansaGit((M.aktifSeansNo() || 1) - 1);
    const sonraki = lb.querySelector('#msa-lb-btn-sonraki');
    if (sonraki) sonraki.onclick = () => M.seansaGit((M.aktifSeansNo() || 1) + 1);

    lb.querySelector('#msa-lb-btn-onayla').onclick = () => { if (!M.seriAcik()) M.lightboxKapat(); M.onayla(); };
    lb.querySelector('#msa-lb-btn-ret').onclick = () => { if (!M.seriAcik()) M.lightboxKapat(); M.retEt(); };
    lb.querySelector('#msa-lb-btn-olay-gec').onclick = M.digerFotoyaGec;

    M.zoomBagla(lb.querySelector('#msa-lb-kam-img'));
  };

  /** Kamera görüntüsünde giriş ↔ çıkış fotoğrafı arasında geçiş. */
  M.digerFotoyaGec = async () => {
    const olay =
      document.querySelector('#rptOlaylar_ctl02_btnOlay') ||
      document.querySelector('input[id*="btnOlay"]') ||
      document.querySelector('a[id*="btnOlay"]');
    if (!olay) { M.toast('ℹ️ Başka kamera fotoğrafı bulunamadı.'); return; }
    M.tikla(olay);
    M.toast('🔄 Çıkış/Giriş fotoğrafına geçiliyor...');
    if (!M.lightboxAcikMi()) return;
    await M.bekle(600);
    const kam = document.querySelector('#imgKamera');
    const lbKam = document.querySelector('#msa-lb-kam-img');
    if (kam?.src && lbKam) lbKam.src = kam.src;
  };
})();
