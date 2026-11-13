/*
 * MEBBİS Süper Asistan — 3. Manuel Seans Raporlayıcı
 * Tüm öğrencileri sırayla açıp kritere uyan seansları toplar, sonunda
 * A4 dikey raporu gösterir (Yazdır / PDF Kaydet).
 *  - KONTROL: denetim öncesi manuel liste (TUM_M = M-M/M-O/O-M, MM = sadece çift manuel)
 *  - ONAY:    18. sütuna göre süzgeç (UYUMSUZ = onay bekleyen, UYUMLU = onaylanan)
 */
(function () {
  'use strict';
  const M = window.__MSA;
  if (!M || M.kilitli) return;

  const ANAHTAR = 'mebbisRaporState_v5';
  M.RAPOR_ANAHTARI = ANAHTAR;

  const varsayilan = () => ({
    aktif: false,
    taramaId: 0,
    index: 0,
    toplamOgrSayisi: 0,
    kurumAdi: '',
    yilAy: '',
    raporKategorisi: 'KONTROL',
    kontrolModu: 'TUM_M',
    onayModu: 'UYUMSUZ',
    manuelOgrenciSayisi: 0,
    toplamSeansSayisi: 0,
    islenenIndeksler: [],
    yakalananOgrenciler: [],
  });
  M.raporVarsayilan = varsayilan;

  M.raporOku = () => {
    try {
      const d = JSON.parse(localStorage.getItem(ANAHTAR));
      return d ? { ...varsayilan(), ...d } : varsayilan();
    } catch (e) {
      return varsayilan();
    }
  };
  const yaz = (d) => localStorage.setItem(ANAHTAR, JSON.stringify(d));

  M.raporTemizle = () => {
    try {
      localStorage.removeItem(ANAHTAR);
      sessionStorage.removeItem(ANAHTAR);
    } catch (e) { /* yoksay */ }
    document.getElementById('cift-manuel-rapor-penceresi')?.remove();
    document.getElementById('cm-print-iframe')?.remove();
  };

  M.raporSayacGuncelle = (d) => {
    const sayac = document.getElementById('msa-rapor-sayac');
    const bulunan = document.getElementById('msa-rapor-bulunan');
    const toplam = d.toplamOgrSayisi || 0;
    const sira = toplam > 0 ? Math.min(d.index + 1, toplam) : 0;
    if (sayac) sayac.textContent = `${sira} / ${toplam}`;
    if (bulunan) bulunan.textContent = `Bulunan: ${d.manuelOgrenciSayisi || 0} Kişi (${d.toplamSeansSayisi || 0} Seans)`;
    if (d.aktif && toplam > 0) document.title = `(${sira}/${toplam}) MEBBİS Tarama`;
  };

  /** Seans satırı rapor kriterine uyuyor mu? */
  function satirUygunMu(gManuel, cManuel, d, denetim) {
    const herhangi = gManuel || cManuel;
    if (!herhangi) return false;
    if ((d.raporKategorisi || 'KONTROL') === 'KONTROL') {
      return d.kontrolModu === 'MM' ? gManuel && cManuel : herhangi;
    }
    const uyumlu = M.denetimDurumu(denetim).uyumlu;
    return d.onayModu === 'UYUMLU' ? uyumlu : !uyumlu;
  }

  const eslesmeTuru = (g, c) => (g && c ? 'M-M' : g ? 'M-O' : c ? 'O-M' : 'O-O');

  /** Öğrencinin seans tablosundayken: uygun seansları topla, listeye dön. */
  async function ogrenciTara(d) {
    M.raporSayacGuncelle(d);
    await M.bekle(200);
    if (!Array.isArray(d.islenenIndeksler)) d.islenenIndeksler = [];
    if (d.islenenIndeksler.includes(d.index)) { M.listeyeDon(); return; }

    const gunler = new Map();
    let adSoyad = '';
    let seansAdet = 0;
    const satirlar = M.seansSatirlari();
    for (let i = 1; i < satirlar.length; i++) {
      const tr = satirlar[i];
      const g = M.girisMetni(tr).includes('Manuel');
      const c = M.cikisMetni(tr).includes('Manuel');
      const denetim = M.denetimMetni(tr) || '-';
      if (!satirUygunMu(g, c, d, denetim)) continue;

      if (!adSoyad) adSoyad = `${M.hucre(tr, 2)} ${M.hucre(tr, 3)}`.trim();
      const tarih = M.hucre(tr, 5);
      const gun = M.gunNo(tarih);
      if (!gunler.has(gun)) gunler.set(gun, { gun, tarih, seanslar: [] });
      gunler.get(gun).seanslar.push({
        saat: M.hucre(tr, 6),
        tur: eslesmeTuru(g, c),
        denetim,
        uyumluMu: M.denetimDurumu(denetim).uyumlu,
      });
      seansAdet++;
    }

    if (gunler.size > 0 && adSoyad) {
      const sirali = [...gunler.values()].sort((a, b) => a.gun - b.gun);
      const tumSeanslar = sirali.flatMap((x) => x.seanslar);
      d.yakalananOgrenciler.push({
        adSoyad,
        gunler: sirali.map((x) => ({ etiket: `${x.gun}-${x.seanslar.length}`, gun: x.gun, seansSayisi: x.seanslar.length, seanslar: x.seanslar })),
        siraliGunlerDetay: sirali,
        turlerOzet: [...new Set(tumSeanslar.map((s) => s.tur))].join(', '),
        denetim: [...new Set(tumSeanslar.map((s) => s.denetim))].join(' / ') || '-',
        uyumsuzVarMi: tumSeanslar.some((s) => !s.uyumluMu),
        hepsiUyumluMu: tumSeanslar.every((s) => s.uyumluMu),
      });
      d.manuelOgrenciSayisi = (d.manuelOgrenciSayisi || 0) + 1;
      d.toplamSeansSayisi = (d.toplamSeansSayisi || 0) + seansAdet;
    }

    d.islenenIndeksler.push(d.index);
    d.index += 1;
    yaz(d);
    M.raporSayacGuncelle(d);
    await M.bekle(150);
    M.listeyeDon();
  }

  /** Liste ekranındayken: manuel işareti olmayanları atla, sıradakini aç ya da raporu göster. */
  async function listeAdimi() {
    const satirlar = M.listeSatirlari();
    if (satirlar.length === 0) return;

    // Döngüyle atlama (eski sürümdeki özyineleme yerine)
    while (true) {
      const d = M.raporOku();
      if (!d.aktif) return;
      d.toplamOgrSayisi = satirlar.length;
      M.raporSayacGuncelle(d);

      if (d.index >= satirlar.length) {
        const son = { ...d, aktif: false };
        localStorage.removeItem(ANAHTAR);
        M.raporSayacGuncelle(son);
        M.raporGoster(son);
        return;
      }

      const tr = satirlar[d.index];
      const manuelIsaretli = M.hucre(tr, 14).includes('M:') || M.hucre(tr, 15).includes('M:');
      if (!manuelIsaretli) {
        d.index += 1;
        yaz(d);
        await M.bekle(25);
        continue;
      }

      yaz(d);
      await M.bekle(150);
      const link = tr.querySelector('td:nth-child(1) a') || tr.querySelector('td:nth-child(1) img') || tr.querySelector('td:nth-child(1)');
      if (link) M.tikla(link);
      return;
    }
  }

  let taraniyor = false;
  M.raporAdim = async () => {
    if (M.durdurulduMu()) return;
    if (taraniyor) return;
    let d = M.raporOku();
    if (!d.aktif) return;

    taraniyor = true;
    try {
      await M.gorunurBekle(`${M.SEANS_TABLO}, #btnAra, ${M.LISTE_TABLO}`, 10000);
      d = M.raporOku();
      if (!d.aktif) return;
      if (M.seansTablosundaMi()) await ogrenciTara(d);
      else if (M.listedeMi()) await listeAdimi();
    } catch (e) {
      console.error('Rapor tarama hatası:', e);
    } finally {
      taraniyor = false;
    }
  };

  /** @param {'KONTROL'|'ONAY'} kategori */
  M.raporBaslat = (kategori, kontrolModu, onayModu) => {
    M.akordeonHatirla('msa-icerik-rapor');
    if (!M.listedeMi()) { M.toast('⚠ Lütfen ana öğrenci listesi ekranına gelin.'); return; }
    M.raporTemizle();
    M.durdurmaBayraginiTemizle();
    const kurum = M.kurumBilgisi();
    const d = {
      ...varsayilan(),
      aktif: true,
      taramaId: Date.now(),
      toplamOgrSayisi: M.listeSatirlari().length,
      kurumAdi: kurum.kurumAdi,
      yilAy: kurum.yilAy,
      raporKategorisi: kategori,
      kontrolModu,
      onayModu,
    };
    yaz(d);
    M.raporSayacGuncelle(d);
    M.toast('📊 Rapor Taraması Başlatıldı!');
    M.raporAdim();
  };

  // ---------------------------------------------------------------------------
  // Rapor penceresi
  // ---------------------------------------------------------------------------
  const TD = 'border: 1px solid #c8d3df;';
  const TH = 'border: 1px solid #285e8e;';
  const dosyaAdi = (s) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  const zamanDamgasi = () =>
    `${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;

  function satirlarHtml(ogrenciler, gunSutun, mmModu) {
    if (ogrenciler.length === 0) {
      return `<tr><td colspan="${gunSutun + 6}" style="padding: 30px; text-align: center; color: #28a745; font-weight: bold; font-size: 15px;">🎉 Seçilen kritere uyan hiçbir seans bulunamadı.</td></tr>`;
    }
    return ogrenciler
      .map((o, i) => {
        let gunHucreleri = '';
        for (let k = 0; k < gunSutun; k++) {
          const etiket = o.gunler[k] ? o.gunler[k].etiket : '';
          gunHucreleri += `<td class="rapor-gun" style="padding: 4px 2px; text-align: center; ${TD} font-weight: 700; width: 38px; min-width: 34px; background: ${etiket ? '#f0f5fc' : '#fff'}; color: #234d75; font-size: 10px;">${etiket}</td>`;
        }

        let saatler = '';
        const det = o.siraliGunlerDetay || [];
        if (det.length === 1) {
          saatler = `<span style="font-weight:600; color:#1c1c1e; font-size: 10px;">${M.esc(det[0].seanslar.map((s) => s.saat).join(', '))}</span>`;
        } else if (det.length > 1) {
          saatler = det
            .map((g) => `<div style="margin: 1px 0; font-size: 9.5px; white-space: nowrap;">
                <span style="display:inline-block; min-width:24px; font-weight:700; color:#3572b0;">${g.gun}'i:</span>
                <span style="font-weight:600; color:#333;">${M.esc(g.seanslar.map((s) => s.saat).join(', '))}</span>
              </div>`)
            .join('');
        }

        const tur = mmModu
          ? `<td style="padding: 4px 2px; text-align: center; ${TD} color: #d70015; font-weight: 600; width: 40px; font-size: 10px;">Manuel</td>
             <td style="padding: 4px 2px; text-align: center; ${TD} color: #d70015; font-weight: 600; width: 40px; font-size: 10px;">Manuel</td>`
          : `<td colspan="2" style="padding: 4px 2px; text-align: center; ${TD} color: #d70015; font-weight: 700; font-size: 11px; background: #fff5f5; width: 75px;">${M.esc(o.turlerOzet)}</td>`;

        const uyumlu = M.denetimDurumu(o.denetim).uyumlu;
        const denetim = uyumlu
          ? '<span style="color:#1b5e20; background:#e8f5e9; font-weight:700; padding:2px 5px; border-radius:4px; display:inline-block; border:1px solid #c8e6c9; font-size: 10px; white-space: nowrap;">✅ Uyumlu</span>'
          : `<span style="color:#b71c1c; background:#ffebee; font-weight:700; padding:2px 5px; border-radius:4px; display:inline-block; border:1px solid #ffcdd2; font-size: 10px; white-space: nowrap;">⚠️ ${M.esc(o.denetim || 'Uyumsuz')}</span>`;

        return `
          <tr class="rapor-satir" style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafd'}; font-size: 11px; line-height: 1.35;">
            <td style="padding: 4px 2px; text-align: center; ${TD} font-weight: 600; color: #555; width: 28px;">${i + 1}</td>
            <td style="padding: 4px 6px; font-weight: 700; color: #1c1c1e; ${TD} width: 135px; word-break: break-word;">${M.esc(o.adSoyad)}</td>
            ${gunHucreleri}
            <td style="padding: 4px 6px; ${TD} text-align: left; vertical-align: middle; width: 110px;">${saatler}</td>
            ${tur}
            <td style="padding: 4px 4px; text-align: center; ${TD} width: 85px;">${denetim}</td>
          </tr>`;
      })
      .join('');
  }

  /**
   * PDF için raporun A4'e tam oturan kopyasını hazırlar ve html2pdf işçisini döndürür.
   * Eski sürümdeki hata: 680px ortalanmış kap + windowWidth 700 uyuşmazlığı ve sayfa kaydırılmışken
   * tablonun sol yarısı PDF dışına kayıyordu; çok günlü raporlarda tablo sayfaya sığmıyordu.
   */
  const PDF_GENISLIK = 748; // A4 (210mm) − 2×6mm kenar = 198mm @ 96dpi
  function pdfIsciOlustur(pencere, gunSutun) {
    const W = PDF_GENISLIK;
    const kap = document.createElement('div');
    kap.style.cssText =
      `width:${W}px;box-sizing:border-box;padding:0;margin:0;background:#fff;color:#1c1c1e;` +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';
    kap.innerHTML = `<div style="text-align:right; font-size:8.5px; color:#8e8e93; margin-bottom:4px;">Tarih: ${zamanDamgasi()}</div>
      ${pencere.querySelector('#yazdirilabilir-alan').innerHTML}`;

    const tablo = kap.querySelector('table');
    if (tablo) {
      // Sütun genişliklerini sayfaya göre hesapla: sabit sütunlar + kalan alan günlere paylaştırılır
      // Gün çok fazlaysa önce ad ve saat sütunları daralır; toplam asla sayfa genişliğini aşmaz
      const s = gunSutun > 12 ? { no: 22, ad: 104, saat: 116, tur: 60, den: 72 } : { no: 24, ad: 118, saat: 132, tur: 62, den: 76 };
      const gunW = Math.floor((W - 4 - s.no - s.ad - s.saat - s.tur - s.den) / gunSutun);
      const cg = document.createElement('colgroup');
      cg.innerHTML =
        `<col style="width:${s.no}px"><col style="width:${s.ad}px">` +
        `<col style="width:${gunW}px">`.repeat(gunSutun) +
        `<col style="width:${s.saat}px"><col style="width:${s.tur / 2}px"><col style="width:${s.tur / 2}px"><col style="width:${s.den}px">`;
      tablo.insertBefore(cg, tablo.firstChild);
      // Dış çerçeve yerine hücre çizgileri: sayfa sonu boşluğunda uzayan çizgi kalmaz
      Object.assign(tablo.style, { width: '100%', tableLayout: 'fixed', fontSize: '8.5px', border: 'none' });
      kap.querySelectorAll('th, td').forEach((h) => {
        h.style.width = '';
        h.style.minWidth = '';
        h.style.padding = '3px 2px';
      });
      kap.querySelectorAll('td div, td span').forEach((e) => { e.style.whiteSpace = 'normal'; });
      kap.querySelectorAll('td.rapor-gun').forEach((h) => {
        Object.assign(h.style, { whiteSpace: 'nowrap', fontSize: gunW < 22 ? '6.5px' : gunW < 30 ? '7.5px' : '8.5px', padding: '3px 0', letterSpacing: '-0.2px' });
      });
    }

    return M.a4PdfIsci(kap);
  }
  M.raporPdfIsci = pdfIsciOlustur; // test/teşhis için

  // ---------------------------------------------------------------------------
  // Ortak A4 çıktı yardımcıları (Manuel rapor ve Eğitmen raporu kullanır)
  // ---------------------------------------------------------------------------
  M.dosyaAdi = dosyaAdi;
  M.zamanDamgasi = zamanDamgasi;
  M.PDF_GENISLIK = PDF_GENISLIK;

  /** PDF_GENISLIK px genişliğindeki kabı A4 dikey PDF'e çeviren html2pdf işçisi. */
  M.a4PdfIsci = (kap) =>
    window
      .html2pdf()
      .set({
        margin: [6, 6, 6, 6],
        image: { type: 'jpeg', quality: 0.98 },
        // Genişlik kapla birebir; scroll sıfırlanır (sayfa kaydırılmışken kayma olmasın)
        html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, x: 0, y: 0, width: PDF_GENISLIK, windowWidth: PDF_GENISLIK },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // Satırlar ve imza/blok alanları sayfa sonunda bölünmez
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.rapor-imza', '.rapor-blok-baslik'] },
      })
      .from(kap);

  /** HTML içeriği gizli bir iframe'de A4 dikey olarak yazdırır. */
  M.a4Yazdir = (belgeAdi, icerikHtml) => {
    document.title = belgeAdi;
    document.getElementById('cm-print-iframe')?.remove();
    const ifr = document.createElement('iframe');
    ifr.id = 'cm-print-iframe';
    ifr.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(ifr);
    const doc = ifr.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${M.esc(belgeAdi)}</title>
      <style>
        @page { size: A4 portrait; margin: 6mm 6mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body { margin: 0; padding: 0; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1c1c1e; height: auto !important; overflow: visible !important; width: 100%; }
        table { width: 100% !important; border-collapse: collapse; border: 1px solid #3572b0; font-size: 9px; table-layout: fixed; }
        thead { display: table-header-group; }
        th { background-color: #3572b0 !important; color: #ffffff !important; padding: 4px 2px; border: 1px solid #285e8e; text-align: center; font-size: 9px; }
        td { border: 1px solid #c8d3df; padding: 3px 2px; vertical-align: middle; word-break: break-word; }
        tr, .rapor-imza, .rapor-blok-baslik { page-break-inside: avoid; page-break-after: auto; }
      </style></head><body>
      <div style="text-align:right; font-size:9px; color:#8e8e93; margin-bottom:4px;">Yazdırma Tarihi: ${zamanDamgasi()}</div>
      ${icerikHtml}
      </body></html>`);
    doc.close();
    setTimeout(() => {
      try {
        document.title = belgeAdi;
        ifr.contentWindow.focus();
        ifr.contentWindow.print();
      } catch (e) {
        window.print();
      }
    }, 300);
  };

  M.raporGoster = (d) => {
    document.getElementById('cift-manuel-rapor-penceresi')?.remove();

    const ogrenciler = d.yakalananOgrenciler || [];
    const kurumAdi = d.kurumAdi || 'Kurum Belirtilmedi';
    const yilAy = d.yilAy || 'Dönem Belirtilmedi';
    const belgeAdi = `${dosyaAdi(kurumAdi)} - ${dosyaAdi(yilAy)}`;
    document.title = belgeAdi;

    const kategori = d.raporKategorisi || 'KONTROL';
    const mmModu = kategori === 'KONTROL' && d.kontrolModu === 'MM';
    const baslik =
      kategori === 'KONTROL'
        ? mmModu
          ? 'DENETİM ÖNCESİ KONTROL: SADECE ÇİFT MANUEL (M-M) LİSTESİ'
          : 'DENETİM ÖNCESİ KONTROL: TÜM MANUEL (M-M, M-O, O-M) LİSTESİ'
        : d.onayModu === 'UYUMLU'
          ? 'ONAY DURUMU SÜZGECİ: ✅ SADECE ONAYLANANLAR (UYUMLU YAZAN)'
          : 'ONAY DURUMU SÜZGECİ: ⚠️ SADECE ONAY BEKLEYENLER (UYUMLU YAZMAYAN)';

    const bekleyen = ogrenciler.filter((o) => o.uyumsuzVarMi).length;
    const onaylanan = ogrenciler.filter((o) => o.hepsiUyumluMu).length;
    const gunSutun = Math.max(4, ...ogrenciler.map((o) => o.gunler.length));
    const turBasligi = mmModu
      ? `<th style="padding: 6px 2px; width: 40px; text-align: center; ${TH}">B.GİRİŞ</th>
         <th style="padding: 6px 2px; width: 40px; text-align: center; ${TH}">B.ÇIKIŞ</th>`
      : `<th colspan="2" style="padding: 6px 2px; width: 75px; text-align: center; ${TH}">EŞLEŞME TÜRÜ</th>`;
    const kurumH = M.esc(kurumAdi);
    const yilAyH = M.esc(yilAy);

    const pencere = document.createElement('div');
    pencere.id = 'cift-manuel-rapor-penceresi';
    pencere.style.cssText =
      'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.75); z-index: 99999999; ' +
      'display: flex; justify-content: center; align-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;';
    const btn = (id, renk, golge, metin) =>
      `<button id="${id}" style="background: ${renk}; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer;${golge ? ` box-shadow: 0 2px 6px ${golge};` : ''}">${metin}</button>`;

    pencere.innerHTML = `
      <div id="rapor-kapsayici" style="background: #fff; width: 96vw; max-width: 1180px; height: 92vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden;">
        <div id="rapor-ust-bar" style="padding: 12px 20px; background: #f5f5f7; border-bottom: 1px solid #d1d1d6; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 14px; font-weight: 900; color: #1c1c1e; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">🏫 ${kurumH}</div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <h2 style="margin: 0; font-size: 14px; color: #3572b0; font-weight: 800;">📋 ${baslik}</h2>
              <span style="font-size: 12px; font-weight: 900; color: #d70015; background: #fff5f5; border: 1px solid #ffcdd2; padding: 2px 10px; border-radius: 4px;">📅 Dönem: ${yilAyH}</span>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            ${btn('btnPdfKaydet', '#28a745', 'rgba(40,167,69,0.3)', '📥 PDF Kaydet')}
            ${btn('btnYazdir', '#3572b0', 'rgba(53,114,176,0.3)', '🖨️ Yazdır')}
            ${btn('btnKapatRapor', '#8e8e93', '', 'Kapat')}
          </div>
        </div>

        <div id="yazdirilabilir-alan" style="padding: 16px 20px; overflow-y: auto; flex: 1;">
          <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #3572b0; padding-bottom: 8px;">
            <div style="font-size: 15px; font-weight: 900; color: #1c1c1e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">${kurumH}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <span style="font-size: 12px; font-weight: 800; color: #3572b0;">📋 ${baslik}</span>
              <span style="font-size: 12px; font-weight: 900; color: #d70015; background: #fff5f5; border: 1px solid #ffcdd2; padding: 3px 12px; border-radius: 4px;">📅 DÖNEM: ${yilAyH}</span>
            </div>
          </div>

          <div style="background: #eef5fc; border: 1px solid #b8d7f5; border-left: 5px solid #3572b0; border-radius: 6px; padding: 10px 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #1c4b75; margin-bottom: 2px;">📊 Genel Durum Özeti:</div>
              <div style="font-size: 13px; color: #234d75;">
                Toplam <strong>${d.toplamOgrSayisi || 0}</strong> öğrenciden <strong style="color: #d70015; font-size: 14px;">${d.manuelOgrenciSayisi || 0}</strong> öğrencinin kritere uygun (${d.toplamSeansSayisi || 0} seans) kaydı bulunmaktadır.
              </div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #1c4b75;">
              <div>⚠️ Onay Bekleyen: <strong style="color: #d70015; font-size: 14px;">${bekleyen} Öğrenci</strong></div>
              <div>✅ Onaylanan: <strong style="color: #28a745; font-size: 14px;">${onaylanan} Öğrenci</strong></div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; text-align: left; border: 1px solid #3572b0; table-layout: fixed;">
            <thead>
              <tr style="background: #3572b0; color: #ffffff; font-size: 10.5px; font-weight: 700; text-transform: uppercase;">
                <th style="padding: 6px 2px; width: 28px; text-align: center; ${TH}">NO</th>
                <th style="padding: 6px 6px; width: 135px; text-align: left; ${TH}">ÖĞRENCİ ADI SOYADI</th>
                <th colspan="${gunSutun}" style="padding: 6px 4px; text-align: center; ${TH}">EĞİTİM TARİHİ - SEANS SAYISI</th>
                <th style="padding: 6px 6px; width: 110px; text-align: center; ${TH}">SEANS SAATİ</th>
                ${turBasligi}
                <th style="padding: 6px 4px; width: 85px; text-align: center; ${TH}">DENETİM (18. SÜTUN)</th>
              </tr>
            </thead>
            <tbody id="rapor-tablo-govde">${satirlarHtml(ogrenciler, gunSutun, mmModu)}</tbody>
          </table>

          <div class="rapor-imza" style="margin-top: 18px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 10px; font-size: 11px; page-break-inside: avoid;">
            <div style="font-size: 10px; color: #71717a;">Sistem Rapor Tarihi: ${zamanDamgasi()}</div>
            <div style="text-align: center; min-width: 190px;">
              <div style="font-weight: 700; color: #1c4b75; margin-bottom: 28px;">İlçe Komisyonu / Raporu Düzenleyen</div>
              <div style="font-weight: 800; font-size: 12px; color: #1c1c1e;">${M.GELISTIRICI}</div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(pencere);

    pencere.querySelector('#btnKapatRapor').onclick = () => { document.title = 'MEBBİS'; pencere.remove(); };

    const yazdir = () => M.a4Yazdir(belgeAdi, pencere.querySelector('#yazdirilabilir-alan').innerHTML);
    pencere.querySelector('#btnYazdir').onclick = yazdir;

    // html2pdf eklentiyle birlikte yüklenir (manifest); dış CDN'e gerek yok
    pencere.querySelector('#btnPdfKaydet').onclick = async () => {
      const b = pencere.querySelector('#btnPdfKaydet');
      const eski = b.textContent;
      document.title = belgeAdi;
      try {
        b.textContent = '⏳ Hazırlanıyor...';
        b.disabled = true;
        if (typeof window.html2pdf !== 'function') { yazdir(); return; }

        await pdfIsciOlustur(pencere, gunSutun).save(`${belgeAdi}.pdf`);
      } catch (e) {
        console.error('PDF kaydetme hatası:', e);
        yazdir();
      } finally {
        b.textContent = eski;
        b.disabled = false;
      }
    };
  };
})();
