/*
 * MEBBİS Süper Asistan — 4. Eğitmen Raporu
 * Tüm öğrencileri sırayla açar, her seansın eğitmenini (9. sütun), tarihini (5) ve
 * ders saatini (6) toplar; sonunda eğitmen bazında rapor gösterir.
 *  - HIZLI   : eğitmen → öğrenciler, seans sayısı, toplam ders süresi
 *  - DETAYLI : + eğitmenin kurum giriş/çıkışı (seans penceresi ctl03/ctl04) ile
 *              her dersin kapsanıp kapsanmadığı, geç giriş / erken çıkış dakikaları,
 *              eğitmenin kurumda kaldığı toplam süre.
 * Eğitmenin giriş/çıkışı günlüktür: aynı eğitmen + aynı gün için pencere yalnızca bir kez açılır.
 */
(function () {
  'use strict';
  const M = window.__MSA;
  if (!M || M.kilitli) return;

  const ANAHTAR = 'mebbisEgitmenRapor_v1';
  M.EGITMEN_ANAHTARI = ANAHTAR;
  const DERS_DK = 40;
  const EGITMEN_YOK = '(Eğitmen belirtilmemiş)';

  const varsayilan = () => ({
    aktif: false,
    mod: 'HIZLI',
    index: 0,
    toplamOgrSayisi: 0,
    kurumAdi: '',
    yilAy: '',
    seanslar: [], // { e: eğitmen, o: öğrenci, t: tarih, s: ders saati }
    egtSaat: {}, // "eğitmen|tarih" → { g: "08:30", c: "17:00" } | null (okunamadı)
    kayitOgrIdx: null,
    seansIdx: 1,
    islenen: [],
  });

  M.egitmenOku = () => {
    try {
      const d = JSON.parse(localStorage.getItem(ANAHTAR));
      return d ? { ...varsayilan(), ...d } : varsayilan();
    } catch (e) {
      return varsayilan();
    }
  };
  const yaz = (d) => localStorage.setItem(ANAHTAR, JSON.stringify(d));
  const anahtar = (egitmen, tarih) => `${egitmen}|${tarih}`;

  M.egitmenSayacGuncelle = (d, durum) => {
    const sayac = document.getElementById('msa-egitmen-sayac');
    const bilgi = document.getElementById('msa-egitmen-durum');
    const toplam = d.toplamOgrSayisi || 0;
    const sira = toplam > 0 ? Math.min(d.index + 1, toplam) : 0;
    if (sayac) sayac.textContent = `${sira} / ${toplam}`;
    if (bilgi) bilgi.textContent = durum || `${d.seanslar.length} seans toplandı`;
    if (d.aktif && toplam > 0) document.title = `(${sira}/${toplam}) Eğitmen Taraması`;
  };

  M.egitmenTemizle = () => {
    try { localStorage.removeItem(ANAHTAR); } catch (e) { /* yoksay */ }
    document.getElementById('egitmen-rapor-penceresi')?.remove();
  };

  // ---------------------------------------------------------------------------
  // Tarama
  // ---------------------------------------------------------------------------
  /** Öğrencinin seans tablosundayken: seansları kaydet, (detaylı) eğitmen saatlerini oku, listeye dön. */
  async function ogrenciTara(d) {
    if (d.islenen.includes(d.index)) { M.listeyeDon(); return; }

    // 1) Bu öğrencinin seanslarını bir kez kaydet
    if (d.kayitOgrIdx !== d.index) {
      const satirlar = M.seansSatirlari();
      for (let i = 1; i < satirlar.length; i++) {
        const tr = satirlar[i];
        const tarih = M.hucre(tr, 5);
        if (!tarih) continue;
        d.seanslar.push({
          e: M.hucre(tr, 9) || EGITMEN_YOK,
          o: M.tcTemizle(`${M.hucre(tr, 2)} ${M.hucre(tr, 3)}`.trim()) || 'Öğrenci',
          t: tarih,
          s: M.hucre(tr, 6),
        });
      }
      d.kayitOgrIdx = d.index;
      d.seansIdx = 1;
      yaz(d);
    }

    // 2) Detaylı: her (eğitmen, gün) için bir pencere aç, giriş/çıkışı oku
    if (d.mod === 'DETAYLI') {
      for (let i = d.seansIdx; i < M.seansSatirlari().length; i++) {
        if (M.durdurulduMu()) { M.egitmenDurdur('🛑 Eğitmen taraması durduruldu.'); return; }
        if (!M.egitmenOku().aktif) return;
        const tr = M.seansSatirlari()[i];
        if (tr && M.hucre(tr, 5)) {
          const k = anahtar(M.hucre(tr, 9) || EGITMEN_YOK, M.hucre(tr, 5));
          if (!(k in d.egtSaat)) {
            M.egitmenSayacGuncelle(d, `Seans ${i}/${M.seansSayisi()} • eğitmen saati okunuyor...`);
            const acildi = await M.seansiAc(tr);
            let g = null, c = null;
            if (acildi) {
              await M.bekle(200);
              g = M.olaySaati('03');
              c = M.olaySaati('04');
            }
            d.egtSaat[k] = acildi ? { g: g ? g.str : null, c: c ? c.str : null } : null;
            await M.modalKapat();
          }
        }
        d.seansIdx = i + 1;
        yaz(d);
      }
    }

    d.islenen.push(d.index);
    d.index += 1;
    d.kayitOgrIdx = null;
    d.seansIdx = 1;
    yaz(d);
    M.egitmenSayacGuncelle(d);
    await M.bekle(150);
    M.listeyeDon();
  }

  /** Liste ekranındayken: sıradaki öğrenciyi aç ya da raporu göster. */
  async function listeAdimi() {
    const satirlar = M.listeSatirlari();
    if (satirlar.length === 0) return;
    const d = M.egitmenOku();
    if (!d.aktif) return;
    d.toplamOgrSayisi = satirlar.length;

    if (d.index >= satirlar.length) {
      d.aktif = false;
      yaz(d); // son rapor saklanır, panelden yeniden açılabilir
      M.egitmenSayacGuncelle(d, `Bitti • ${d.seanslar.length} seans`);
      document.title = 'MEBBİS';
      M.toast('🎉 Eğitmen taraması bitti, rapor açılıyor.');
      M.egitmenRaporGoster(d);
      return;
    }

    yaz(d);
    M.egitmenSayacGuncelle(d, `Öğrenci ${d.index + 1}/${satirlar.length} açılıyor...`);
    await M.bekle(150);
    const tr = satirlar[d.index];
    const link = tr.querySelector('td:nth-child(1) a') || tr.querySelector('td:nth-child(1) img') || tr.querySelector('td:nth-child(1)');
    if (link) M.tikla(link);
  }

  let taraniyor = false;
  M.egitmenAdim = async () => {
    if (taraniyor) return;
    let d = M.egitmenOku();
    if (!d.aktif) return;
    if (M.durdurulduMu()) { M.egitmenDurdur('🛑 Eğitmen taraması durduruldu.'); return; }

    taraniyor = true;
    try {
      await M.gorunurBekle(`${M.SEANS_TABLO}, #btnAra, ${M.LISTE_TABLO}`, 10000);
      d = M.egitmenOku();
      if (!d.aktif) return;
      if (M.seansTablosundaMi()) await ogrenciTara(d);
      else if (M.listedeMi()) await listeAdimi();
    } catch (e) {
      console.error('Eğitmen tarama hatası:', e);
    } finally {
      taraniyor = false;
    }
  };

  /** @param {'HIZLI'|'DETAYLI'} mod */
  M.egitmenBaslat = (mod) => {
    M.akordeonHatirla('msa-icerik-egitmen');
    if (!M.listedeMi()) { M.toast('⚠ Lütfen ana öğrenci listesi ekranına gelin.'); return; }
    if (M.turboOku().aktif || M.raporOku().aktif) { M.toast('⚠ Önce çalışan Turbo / Rapor taramasını durdurun.'); return; }
    const kurum = M.kurumBilgisi();
    const d = {
      ...varsayilan(),
      aktif: true,
      mod,
      toplamOgrSayisi: M.listeSatirlari().length,
      kurumAdi: kurum.kurumAdi,
      yilAy: kurum.yilAy,
    };
    document.getElementById('egitmen-rapor-penceresi')?.remove();
    M.durdurmaBayraginiTemizle();
    yaz(d);
    M.egitmenSayacGuncelle(d, 'Başlatıldı...');
    M.toast(mod === 'DETAYLI' ? '👨‍🏫 Detaylı eğitmen taraması başladı (seans pencereleri açılacak).' : '👨‍🏫 Eğitmen taraması başladı.');
    M.egitmenAdim();
  };

  M.egitmenDurdur = (mesaj) => {
    const d = M.egitmenOku();
    d.aktif = false;
    yaz(d);
    M.egitmenSayacGuncelle(d, mesaj || '⏹ Durduruldu');
    document.title = 'MEBBİS';
    M.toast(mesaj || '⏹ Eğitmen taraması durduruldu.');
  };

  // ---------------------------------------------------------------------------
  // Hesap
  // ---------------------------------------------------------------------------
  const dkMetin = (dk) => {
    const s = Math.floor(dk / 60), m = dk % 60;
    return s ? `${s} sa${m ? ` ${m} dk` : ''}` : `${m} dk`;
  };

  /** "09:00 - 09:40" → { bas, bit, dk }; bitiş yoksa 40 dk sayılır. */
  function dersAraligi(metin) {
    const m = (metin || '').match(/(\d{1,2})[:.](\d{2})(?:\s*[-–]\s*(\d{1,2})[:.](\d{2}))?/);
    if (!m) return { bas: null, bit: null, dk: DERS_DK };
    const bas = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const bit = m[3] ? parseInt(m[3], 10) * 60 + parseInt(m[4], 10) : bas + DERS_DK;
    const dk = M.sureFarki(bas, bit) || DERS_DK;
    return { bas, bit, dk };
  }

  function hesapla(d) {
    const detayli = d.mod === 'DETAYLI';
    const egitmenler = new Map();

    for (const r of d.seanslar) {
      if (!egitmenler.has(r.e)) {
        egitmenler.set(r.e, {
          ad: r.e, ogr: new Map(), seans: 0, dersDk: 0, gunler: new Map(),
          uyumlu: 0, uyumsuz: 0, kayitsiz: 0, okunamadi: 0, gecDk: 0, erkenDk: 0, sorunlar: [],
        });
      }
      const E = egitmenler.get(r.e);
      const ders = dersAraligi(r.s);
      E.seans++;
      E.dersDk += ders.dk;
      E.ogr.set(r.o, (E.ogr.get(r.o) || 0) + 1);
      if (!detayli) continue;

      const saat = d.egtSaat[anahtar(r.e, r.t)];
      const sorun = (metin, egt) => E.sorunlar.push({ t: r.t, o: r.o, s: r.s, egt, sorun: metin });
      if (saat === undefined || saat === null || ders.bas === null) {
        E.okunamadi++;
        sorun('Okunamadı', '-');
        continue;
      }
      if (!saat.g || !saat.c) {
        E.kayitsiz++;
        sorun(!saat.g && !saat.c ? 'Giriş ve çıkış kaydı yok' : !saat.g ? 'Giriş kaydı yok' : 'Çıkış kaydı yok', `${saat.g || '--:--'} - ${saat.c || '--:--'}`);
        continue;
      }
      const g = M.saatDk(saat.g).dk;
      const c = M.saatDk(saat.c).dk;
      E.gunler.set(r.t, M.sureFarki(g, c));
      const gec = Math.max(0, g - ders.bas);
      const erken = Math.max(0, ders.bit - c);
      if (!gec && !erken) {
        E.uyumlu++;
      } else {
        E.uyumsuz++;
        E.gecDk += gec;
        E.erkenDk += erken;
        sorun([gec && `${gec} dk geç giriş`, erken && `${erken} dk erken çıkış`].filter(Boolean).join(', '), `${saat.g} - ${saat.c}`);
      }
    }

    const liste = [...egitmenler.values()].sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
    liste.forEach((E) => {
      E.kurumDk = [...E.gunler.values()].reduce((t, x) => t + x, 0);
      E.gunSayisi = new Set(d.seanslar.filter((r) => r.e === E.ad).map((r) => r.t)).size;
      E.ogrListe = [...E.ogr.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'));
      E.sorunlar.sort((a, b) => M.gunNo(a.t) - M.gunNo(b.t) || String(a.s).localeCompare(String(b.s)));
    });
    return liste;
  }

  // ---------------------------------------------------------------------------
  // Rapor penceresi
  // ---------------------------------------------------------------------------
  const TH = 'padding:5px 3px;border:1px solid #285e8e;text-align:center;';
  const TD = 'padding:4px 3px;border:1px solid #c8d3df;text-align:center;';

  function raporHtml(d, liste, belgeBaslik) {
    const detayli = d.mod === 'DETAYLI';
    const esc = M.esc;
    const top = liste.reduce(
      (t, E) => ({
        seans: t.seans + E.seans, dk: t.dk + E.dersDk, uyumlu: t.uyumlu + E.uyumlu,
        uyumsuz: t.uyumsuz + E.uyumsuz, kayitsiz: t.kayitsiz + E.kayitsiz + E.okunamadi,
      }),
      { seans: 0, dk: 0, uyumlu: 0, uyumsuz: 0, kayitsiz: 0 }
    );
    const kart = (etiket, deger, renk) =>
      `<div style="flex:1;background:#f5f8fc;border:1px solid #d6e2f0;border-radius:6px;padding:6px 8px;text-align:center;">
        <div style="font-size:9px;color:#5a6b80;font-weight:700;">${etiket}</div>
        <div style="font-size:15px;font-weight:900;color:${renk};">${deger}</div></div>`;

    const ozetBaslik = detayli
      ? `<th style="${TH}width:24px;">NO</th><th style="${TH}text-align:left;">EĞİTMEN</th><th style="${TH}width:44px;">ÖĞR.</th>
         <th style="${TH}width:46px;">SEANS</th><th style="${TH}width:72px;">DERS SÜRESİ</th><th style="${TH}width:72px;">KURUMDA</th>
         <th style="${TH}width:52px;">UYUMLU</th><th style="${TH}width:56px;">UYUMSUZ</th><th style="${TH}width:80px;">GEÇ / ERKEN</th><th style="${TH}width:56px;">KAYITSIZ</th>`
      : `<th style="${TH}width:24px;">NO</th><th style="${TH}text-align:left;">EĞİTMEN</th><th style="${TH}width:70px;">ÖĞRENCİ</th>
         <th style="${TH}width:60px;">GÜN</th><th style="${TH}width:70px;">SEANS</th><th style="${TH}width:100px;">DERS SÜRESİ</th>`;

    const ozetSatirlar = liste
      .map((E, i) => {
        const zebra = i % 2 ? '#f8fafd' : '#fff';
        const ortak = `<td style="${TD}">${i + 1}</td><td style="${TD}text-align:left;font-weight:700;">${esc(E.ad)}</td>`;
        if (!detayli) {
          return `<tr style="background:${zebra};">${ortak}<td style="${TD}">${E.ogr.size}</td><td style="${TD}">${E.gunSayisi}</td>
            <td style="${TD}font-weight:700;">${E.seans}</td><td style="${TD}font-weight:700;color:#3572b0;">${dkMetin(E.dersDk)}</td></tr>`;
        }
        const kayitsiz = E.kayitsiz + E.okunamadi;
        return `<tr style="background:${zebra};">${ortak}<td style="${TD}">${E.ogr.size}</td><td style="${TD}font-weight:700;">${E.seans}</td>
          <td style="${TD}font-weight:700;color:#3572b0;">${dkMetin(E.dersDk)}</td><td style="${TD}">${E.kurumDk ? dkMetin(E.kurumDk) : '-'}</td>
          <td style="${TD}color:#1b5e20;font-weight:700;">${E.uyumlu}</td>
          <td style="${TD}${E.uyumsuz ? 'color:#b71c1c;font-weight:800;background:#ffebee;' : ''}">${E.uyumsuz}</td>
          <td style="${TD}font-size:9px;">${E.gecDk || E.erkenDk ? `${E.gecDk} / ${E.erkenDk} dk` : '-'}</td>
          <td style="${TD}${kayitsiz ? 'color:#8a5a00;font-weight:700;background:#fff7e0;' : ''}">${kayitsiz}</td></tr>`;
      })
      .join('');

    const detaylar = liste
      .map((E) => {
        const ogrMetin = E.ogrListe.map(([ad, n]) => `${esc(ad)} <b>(${n})</b>`).join(' · ');
        const sorunTablo =
          detayli && E.sorunlar.length
            ? `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.5px;margin-top:4px;">
                <thead><tr style="background:#3572b0;color:#fff;">
                  <th style="${TH}width:70px;">TARİH</th><th style="${TH}text-align:left;">ÖĞRENCİ</th><th style="${TH}width:90px;">DERS SAATİ</th>
                  <th style="${TH}width:100px;">EĞT. GİRİŞ-ÇIKIŞ</th><th style="${TH}width:170px;">SORUN</th></tr></thead>
                <tbody>${E.sorunlar
                  .map(
                    (s, i) => `<tr style="background:${i % 2 ? '#fff8f8' : '#fff'};">
                      <td style="${TD}">${esc(s.t)}</td><td style="${TD}text-align:left;">${esc(s.o)}</td><td style="${TD}">${esc(s.s)}</td>
                      <td style="${TD}">${esc(s.egt)}</td><td style="${TD}color:#b71c1c;font-weight:700;">${esc(s.sorun)}</td></tr>`
                  )
                  .join('')}</tbody></table>`
            : detayli
              ? '<div style="font-size:10px;color:#1b5e20;font-weight:700;margin-top:3px;">✅ Tüm dersler eğitmenin giriş-çıkış saatleri içinde.</div>'
              : '';
        return `<div style="margin-top:12px;">
            <div class="rapor-blok-baslik" style="background:#eef5fc;border-left:4px solid #3572b0;padding:5px 8px;border-radius:4px;">
              <div style="font-size:12px;font-weight:900;color:#1c4b75;">👨‍🏫 ${esc(E.ad)}
                <span style="font-weight:600;color:#5a6b80;font-size:10.5px;"> — ${E.seans} seans · ${dkMetin(E.dersDk)} ders · ${E.ogr.size} öğrenci · ${E.gunSayisi} gün</span></div>
              <div style="font-size:10px;color:#333;margin-top:3px;line-height:1.45;">${ogrMetin}</div>
            </div>${sorunTablo}</div>`;
      })
      .join('');

    return `
      <div style="text-align:center;border-bottom:2px solid #3572b0;padding-bottom:6px;margin-bottom:10px;">
        <div style="font-size:15px;font-weight:900;text-transform:uppercase;">${esc(d.kurumAdi || 'Kurum Belirtilmedi')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span style="font-size:12px;font-weight:800;color:#3572b0;">📋 ${belgeBaslik}</span>
          <span style="font-size:12px;font-weight:900;color:#d70015;background:#fff5f5;border:1px solid #ffcdd2;padding:2px 10px;border-radius:4px;">📅 DÖNEM: ${esc(d.yilAy || '-')}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        ${kart('EĞİTMEN', liste.length, '#1c4b75')}
        ${kart('TOPLAM SEANS', top.seans, '#1c4b75')}
        ${kart('TOPLAM DERS', dkMetin(top.dk), '#3572b0')}
        ${detayli ? kart('UYUMLU', top.uyumlu, '#1b5e20') + kart('UYUMSUZ', top.uyumsuz, '#b71c1c') + kart('KAYITSIZ / OKUNAMAYAN', top.kayitsiz, '#8a5a00') : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5px;">
        <thead><tr style="background:#3572b0;color:#fff;font-size:9.5px;">${ozetBaslik}</tr></thead>
        <tbody>${ozetSatirlar || `<tr><td colspan="10" style="${TD}padding:20px;">Kayıt bulunamadı.</td></tr>`}</tbody>
      </table>
      ${detayli ? `<div style="font-size:9px;color:#5a6b80;margin-top:4px;">Uyum ölçütü: eğitmenin kurum girişi ders başlangıcından önce, çıkışı ders bitişinden sonra olmalı. Ders süresi 6. sütundaki saat aralığından (yoksa ${DERS_DK} dk) hesaplanır. "Kurumda": eğitmenin gün gün giriş-çıkış süreleri toplamı.</div>` : ''}
      <div style="font-size:12px;font-weight:900;color:#1c4b75;margin-top:14px;border-bottom:1px solid #b8d7f5;padding-bottom:3px;">EĞİTMEN DETAYLARI</div>
      ${detaylar}
      <div class="rapor-imza" style="margin-top:18px;display:flex;justify-content:space-between;align-items:flex-end;padding:0 10px;font-size:11px;">
        <div style="font-size:10px;color:#71717a;">Sistem Rapor Tarihi: ${M.zamanDamgasi()}</div>
        <div style="text-align:center;min-width:190px;">
          <div style="font-weight:700;color:#1c4b75;margin-bottom:28px;">İlçe Komisyonu / Raporu Düzenleyen</div>
          <div style="font-weight:800;font-size:12px;">${M.GELISTIRICI}</div>
        </div>
      </div>`;
  }

  M.egitmenRaporGoster = (d = M.egitmenOku()) => {
    if (!d.seanslar.length) { M.toast('ℹ Gösterilecek eğitmen raporu yok. Önce tarama başlatın.'); return; }
    document.getElementById('egitmen-rapor-penceresi')?.remove();

    const liste = hesapla(d);
    const baslik = d.mod === 'DETAYLI' ? 'EĞİTMEN RAPORU: DERSLER, SÜRELER VE GİRİŞ-ÇIKIŞ UYUMU' : 'EĞİTMEN RAPORU: DERSLER VE SÜRELER';
    const belgeAdi = `${M.dosyaAdi(d.kurumAdi || 'Kurum')} - ${M.dosyaAdi(d.yilAy || '')} - Eğitmen Raporu`;
    document.title = belgeAdi;

    const pencere = document.createElement('div');
    pencere.id = 'egitmen-rapor-penceresi';
    pencere.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999999;display:flex;justify-content:center;align-items:center;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';
    const btn = (id, renk, metin) =>
      `<button id="${id}" style="background:${renk};color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;">${metin}</button>`;
    pencere.innerHTML = `
      <div style="background:#fff;width:96vw;max-width:${M.PDF_GENISLIK + 60}px;height:92vh;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:12px 20px;background:#f5f5f7;border-bottom:1px solid #d1d1d6;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-size:14px;font-weight:900;color:#1c1c1e;">👨‍🏫 Eğitmen Raporu <span style="font-size:11px;color:#8e8e93;font-weight:600;">(${d.mod === 'DETAYLI' ? 'Detaylı' : 'Hızlı'} • ${d.seanslar.length} seans)</span></div>
          <div style="display:flex;gap:8px;">${btn('btnEgtPdf', '#28a745', '📥 PDF Kaydet')}${btn('btnEgtYazdir', '#3572b0', '🖨️ Yazdır')}${btn('btnEgtKapat', '#8e8e93', 'Kapat')}</div>
        </div>
        <div style="overflow-y:auto;flex:1;padding:16px 30px;">
          <div id="egitmen-yazdirilabilir" style="width:${M.PDF_GENISLIK}px;max-width:100%;margin:0 auto;color:#1c1c1e;">${raporHtml(d, liste, baslik)}</div>
        </div>
      </div>`;
    document.body.appendChild(pencere);

    const icerik = () => pencere.querySelector('#egitmen-yazdirilabilir').innerHTML;
    const yazdir = () => M.a4Yazdir(belgeAdi, icerik());
    pencere.querySelector('#btnEgtKapat').onclick = () => { document.title = 'MEBBİS'; pencere.remove(); };
    pencere.querySelector('#btnEgtYazdir').onclick = yazdir;
    pencere.querySelector('#btnEgtPdf').onclick = async () => {
      const b = pencere.querySelector('#btnEgtPdf');
      const eski = b.textContent;
      try {
        b.textContent = '⏳ Hazırlanıyor...';
        b.disabled = true;
        if (typeof window.html2pdf !== 'function') { yazdir(); return; }
        const kap = document.createElement('div');
        kap.style.cssText = `width:${M.PDF_GENISLIK}px;box-sizing:border-box;margin:0;padding:0;background:#fff;color:#1c1c1e;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;`;
        kap.innerHTML = `<div style="text-align:right;font-size:8.5px;color:#8e8e93;margin-bottom:4px;">Tarih: ${M.zamanDamgasi()}</div>${icerik()}`;
        await M.a4PdfIsci(kap).save(`${belgeAdi}.pdf`);
      } catch (e) {
        console.error('Eğitmen raporu PDF hatası:', e);
        yazdir();
      } finally {
        b.textContent = eski;
        b.disabled = false;
      }
    };
  };

  M.egitmenHesapla = hesapla; // test/teşhis için
})();
