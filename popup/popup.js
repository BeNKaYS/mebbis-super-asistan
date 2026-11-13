/*
 * MEBBİS Süper Asistan — Popup
 * Lisans durumu, şeffaflık, onay/ret metinleri, acil durdurma ve güncelleme.
 */
document.addEventListener('DOMContentLoaded', () => {
  const VARSAYILAN_ONAY =
    'Millî Eğitim Bakanlığı Özel Eğitim Kurumları Yönetmeliği gereği yapılan inceleme sonucu, ilçe komisyonu adına onay verilmiştir.';
  const VARSAYILAN_RET =
    '652 sayılı KHK ve Millî Eğitim Bakanlığı Özel Eğitim Kurumları Yönetmeliği gereği yapılan inceleme sonucu, ilgili kayıttaki uyumsuzluk nedeniyle ilçe komisyonu adına ret edilmiştir.';

  // content script'lerin kullandığı sayfa anahtarları (src/*.js ile aynı olmalı)
  const SAYFA_ANAHTARLARI = {
    turbo: 'seansOtomasyonV3_Turbo', // localStorage
    rapor: 'mebbisRaporState_v5', // localStorage + sessionStorage
    gezgin: 'mg3_durum_v31', // sessionStorage
    egitmen: 'mebbisEgitmenRapor_v1', // localStorage
  };

  const $ = (id) => document.getElementById(id);
  const SURUM = chrome.runtime.getManifest().version;
  $('surum-etiket').textContent = `v${SURUM}`;

  // ---------------------------------------------------------------------------
  // Aktif sekme yardımcıları
  // ---------------------------------------------------------------------------
  async function aktifSekme() {
    const [sekme] = await chrome.tabs.query({ active: true, currentWindow: true });
    return sekme && sekme.id && /^https?:\/\/mebbis\.meb\.gov\.tr\//.test(sekme.url || '') ? sekme : null;
  }

  async function sayfadaCalistir(func, args = []) {
    const sekme = await aktifSekme();
    if (!sekme) return { sekmeYok: true };
    const [sonuc] = await chrome.scripting.executeScript({ target: { tabId: sekme.id }, world: 'MAIN', func, args });
    return { deger: sonuc?.result };
  }

  /** Popup ayarlarını sayfanın localStorage'ına yazar; panel anında güncellenir. */
  async function sekmeyeAyarGonder(ayarlar) {
    try {
      await sayfadaCalistir((a) => {
        if (a.seffaflik !== undefined) localStorage.setItem('msa_seffaflik', a.seffaflik);
        if (a.onayMetni !== undefined) localStorage.setItem('msa_onay_metni', a.onayMetni);
        if (a.retMetni !== undefined) localStorage.setItem('msa_ret_metni', a.retMetni);
        window.dispatchEvent(new CustomEvent('msa_ayarlar_guncellendi', { detail: a }));
      }, [ayarlar]);
    } catch (e) {
      /* MEBBİS sekmesi değilse normal */
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Lisans
  // ---------------------------------------------------------------------------
  chrome.runtime.sendMessage({ type: 'CHECK_LICENSE' }, (res) => {
    if (!res) return;
    $('developer-name').textContent = res.developer || 'Sercan ÖZDEMİR';
    $('expires-date').textContent = res.expiresDateStr || '23.12.2026';
    const gun = $('days-remaining');
    const pill = $('status-pill');
    if (res.valid) {
      gun.textContent = `${res.daysRemaining} Gün Kaldı`;
      gun.className = 'value highlight';
      pill.textContent = 'Aktif';
      pill.className = 'pill pill-active';
    } else {
      gun.textContent = 'Süre Doldu';
      gun.style.color = '#ff453a';
      gun.title = res.reason || '';
      pill.textContent = 'Kilitli';
      pill.className = 'pill pill-expired';
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Ayarlar (şeffaflık + metinler)
  //    Panelden yapılan değişiklikler sayfada kalır; popup açılınca oradan çekilip eşitlenir.
  // ---------------------------------------------------------------------------
  const slider = $('transparency-slider');
  const sliderDeger = $('transparency-val');
  const txtOnay = $('txt-onay-metni');
  const txtRet = $('txt-ret-metni');
  const durumMesaji = $('templates-status');

  async function ayarlariYukle() {
    const kayitli = await chrome.storage.local.get(['msa_seffaflik_yuzde', 'msa_onay_metni', 'msa_ret_metni']);
    let yuzde = kayitli.msa_seffaflik_yuzde ?? 25;
    let onay = kayitli.msa_onay_metni || VARSAYILAN_ONAY;
    let ret = kayitli.msa_ret_metni || VARSAYILAN_RET;

    try {
      const { deger } = await sayfadaCalistir(() => ({
        seffaflik: localStorage.getItem('msa_seffaflik'),
        onay: localStorage.getItem('msa_onay_metni'),
        ret: localStorage.getItem('msa_ret_metni'),
      }));
      if (deger) {
        const s = parseFloat(deger.seffaflik);
        if (!isNaN(s)) yuzde = Math.round(s * 100);
        if (deger.onay) onay = deger.onay;
        if (deger.ret) ret = deger.ret;
        await chrome.storage.local.set({ msa_seffaflik_yuzde: yuzde, msa_onay_metni: onay, msa_ret_metni: ret });
      }
    } catch (e) {
      /* sekme okunamadı */
    }

    slider.value = yuzde;
    sliderDeger.textContent = `%${yuzde}`;
    txtOnay.value = onay;
    txtRet.value = ret;
  }
  ayarlariYukle();

  slider.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    sliderDeger.textContent = `%${v}`;
    chrome.storage.local.set({ msa_seffaflik_yuzde: v });
    sekmeyeAyarGonder({ seffaflik: (v / 100).toFixed(2) });
  });

  function durumYaz(metin, renk) {
    durumMesaji.textContent = metin;
    durumMesaji.style.color = renk;
    setTimeout(() => { durumMesaji.textContent = ''; }, 3000);
  }

  async function metinleriKaydet(onay, ret, mesaj, renk) {
    txtOnay.value = onay;
    txtRet.value = ret;
    await chrome.storage.local.set({ msa_onay_metni: onay, msa_ret_metni: ret });
    await sekmeyeAyarGonder({ onayMetni: onay, retMetni: ret });
    durumYaz(mesaj, renk);
  }

  $('btn-save-templates').addEventListener('click', () =>
    metinleriKaydet(txtOnay.value.trim() || VARSAYILAN_ONAY, txtRet.value.trim() || VARSAYILAN_RET, '✅ Metinler başarıyla kaydedildi!', '#30d158')
  );
  $('btn-reset-templates').addEventListener('click', () =>
    metinleriKaydet(VARSAYILAN_ONAY, VARSAYILAN_RET, '🔄 Resmi yönetmelik metinleri yüklendi!', '#5ac8fa')
  );

  // ---------------------------------------------------------------------------
  // 3. MEBBİS'i aç
  // ---------------------------------------------------------------------------
  $('btn-open-mebbis').addEventListener('click', () => chrome.tabs.create({ url: 'https://mebbis.meb.gov.tr/' }));

  // ---------------------------------------------------------------------------
  // 4. Acil durdurma (doğru durum anahtarlarını temizler)
  // ---------------------------------------------------------------------------
  const btnDurdur = $('btn-durdur');
  btnDurdur.addEventListener('click', async () => {
    btnDurdur.textContent = '⏳ Durduruluyor...';
    btnDurdur.disabled = true;
    try {
      const { sekmeYok } = await sayfadaCalistir((k) => {
        try {
          localStorage.removeItem(k.turbo);
          localStorage.removeItem(k.rapor);
          sessionStorage.removeItem(k.rapor);
          sessionStorage.removeItem(k.gezgin);
          localStorage.removeItem(k.egitmen);
          window.__msaDurdur = true;

          const kapat = document.querySelector('#btnTakipKapat, #btnDenetimKapat, div.takip-modal-baslik-kapat');
          if (kapat) kapat.click();

          const t = document.createElement('div');
          t.style.cssText =
            'position:fixed;top:30px;left:50%;transform:translateX(-50%);z-index:999999999;background:#18181f;color:#fff;' +
            'border:2px solid #ff453a;padding:12px 24px;border-radius:12px;font:bold 14px -apple-system,sans-serif;' +
            'box-shadow:0 10px 40px rgba(0,0,0,0.6);text-align:center;';
          t.textContent = '🛑 Tüm Otomasyon ve Bekleyen İşlemler Durduruldu!';
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 3500);

          const turbo = document.querySelector('#msa-turbo-durum');
          if (turbo) turbo.textContent = 'Durduruldu. Hazır.';
        } catch (e) {
          console.error('Durdurma hatası:', e);
        }
      }, [SAYFA_ANAHTARLARI]);

      if (sekmeYok) throw new Error('MEBBİS sekmesi değil');
      btnDurdur.textContent = '✅ Tüm İşlemler Durduruldu!';
      btnDurdur.style.background = 'linear-gradient(135deg, #30d158, #248a3d)';
    } catch (err) {
      btnDurdur.textContent = '⚠️ MEBBİS Sekmesinde Değilsiniz';
    } finally {
      btnDurdur.disabled = false;
      setTimeout(() => {
        btnDurdur.textContent = '🛑 Tüm İşlemleri Durdur / Sıfırla';
        btnDurdur.style.background = 'linear-gradient(135deg, #ff453a, #c92a2a)';
      }, 3000);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Güncelleme
  //    Akış: kontrol → bildir → onay → yedek → indir → (kullanıcı dosyaları değiştirir) → yenile.
  //    Chrome eklentisi kendi dosyalarını yazamaz; indirilen paketteki kod çalıştırılmaz.
  //    Güncellenen: manifest.json, background.js, version.json, html2pdf.bundle.min.js, src/, popup/, icons/
  //    Korunan   : ayarlar (chrome.storage + MEBBİS sayfasındaki msa_* anahtarları)
  // ---------------------------------------------------------------------------
  const UPD = {
    mevcut: $('upd-mevcut'),
    repo: $('upd-repo'),
    klasorKutu: $('upd-klasor-kutu'),
    klasor: $('upd-klasor'),
    kontrol: $('btn-upd-kontrol'),
    guncelle: $('btn-upd-guncelle'),
    yenile: $('btn-upd-yenile'),
    sonuc: $('upd-sonuc'),
  };
  const sekmedeAcik = new URLSearchParams(location.search).has('tam');
  let bulunan = null; // { kaynak, surum, tarih, not, indir | klasor }

  const seciliKaynak = () => document.querySelector('input[name="upd-kaynak"]:checked').value;

  const sonucYaz = (metin, renk = '#a1a1aa') => {
    const saat = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    UPD.sonuc.textContent = `Son kontrol: ${saat} · ${metin}`;
    UPD.sonuc.style.color = renk;
    chrome.storage.local.set({ msa_upd_sonuc: UPD.sonuc.textContent });
  };

  /** "6.10" > "6.9" doğru karşılaştırılır. */
  const surumKarsilastir = (a, b) => {
    const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
    const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const f = (pa[i] || 0) - (pb[i] || 0);
      if (f) return f;
    }
    return 0;
  };

  const repoAyikla = (girdi) => {
    const m = String(girdi || '').trim().replace(/\.git$/, '').match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+)\/?$/);
    return m ? { sahip: m[1], repo: m[2] } : null;
  };

  async function jsonGetir(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { durum: r.status });
    return r.json();
  }

  async function githubKontrol() {
    const r = repoAyikla(UPD.repo.value);
    if (!r) throw new Error('Geçerli bir "kullanici/repo" girin.');
    const taban = `${r.sahip}/${r.repo}`;
    try {
      const rel = await jsonGetir(`https://api.github.com/repos/${taban}/releases/latest`);
      const zip = (rel.assets || []).find((a) => /\.zip$/i.test(a.name));
      return {
        kaynak: 'github',
        surum: String(rel.tag_name || '').replace(/^v/i, ''),
        tarih: (rel.published_at || '').slice(0, 10),
        not: (rel.body || rel.name || '').split('\n')[0].trim(),
        indir: zip ? zip.browser_download_url : rel.zipball_url,
      };
    } catch (e) {
      if (e.durum !== 404) throw e;
      // Release yoksa varsayılan dalın version.json'u
      const v = await jsonGetir(`https://raw.githubusercontent.com/${taban}/HEAD/version.json`);
      return { kaynak: 'github', surum: v.surum, tarih: v.tarih, not: v.not, indir: `https://github.com/${taban}/archive/HEAD.zip` };
    }
  }

  async function yerelKontrol() {
    const dosyalar = [...(UPD.klasor.files || [])];
    if (!dosyalar.length) throw new Error('Önce eklentinin yeni sürüm klasörünü seçin.');
    const yol = (f) => f.webkitRelativePath.split('/').slice(1).join('/');
    const bul = (ad) => dosyalar.find((f) => yol(f) === ad);
    if (!bul('manifest.json') || !bul('src/00-core.js') || !bul('version.json')) {
      throw new Error('Bu klasör MEBBİS Süper Asistan kaynağı değil (manifest.json, version.json, src/00-core.js bulunamadı).');
    }
    const v = JSON.parse(await bul('version.json').text());
    return { kaynak: 'yerel', surum: v.surum, tarih: v.tarih, not: v.not, klasor: dosyalar[0].webkitRelativePath.split('/')[0] };
  }

  function kaynakGoster() {
    const yerel = seciliKaynak() === 'yerel';
    UPD.repo.style.display = yerel ? 'none' : '';
    UPD.klasorKutu.style.display = yerel && sekmedeAcik ? '' : 'none';
    UPD.kontrol.textContent = yerel && !sekmedeAcik ? '📂 Klasör Seç (sekmede açılır)' : '🔎 Kontrol Et';
    UPD.guncelle.disabled = true;
    bulunan = null;
    chrome.storage.local.set({ msa_upd_kaynak: seciliKaynak() });
  }

  // Son kullanılan kaynak hazır gelsin
  chrome.storage.local.get(['msa_upd_kaynak', 'msa_upd_repo', 'msa_upd_sonuc'], (k) => {
    if (k.msa_upd_repo) UPD.repo.value = k.msa_upd_repo;
    if (k.msa_upd_kaynak) {
      const r = document.querySelector(`input[name="upd-kaynak"][value="${k.msa_upd_kaynak}"]`);
      if (r) r.checked = true;
    }
    if (k.msa_upd_sonuc) UPD.sonuc.textContent = k.msa_upd_sonuc;
    kaynakGoster();
  });
  fetch(chrome.runtime.getURL('version.json'))
    .then((r) => r.json())
    .then((v) => { UPD.mevcut.textContent = `${v.surum} · ${v.tarih}`; })
    .catch(() => { UPD.mevcut.textContent = SURUM; });

  document.querySelectorAll('input[name="upd-kaynak"]').forEach((r) => r.addEventListener('change', kaynakGoster));
  UPD.repo.addEventListener('change', () => chrome.storage.local.set({ msa_upd_repo: UPD.repo.value.trim() }));

  UPD.kontrol.addEventListener('click', async () => {
    const yerel = seciliKaynak() === 'yerel';
    // Dosya seçici açılınca popup kapanabilir; yerel klasör seçimi tam sekmede yapılır
    if (yerel && !sekmedeAcik) {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?tam=1') });
      return;
    }
    UPD.kontrol.disabled = true;
    UPD.guncelle.disabled = true;
    UPD.sonuc.textContent = '⏳ Kontrol ediliyor...';
    try {
      bulunan = yerel ? await yerelKontrol() : await githubKontrol();
      if (!bulunan.surum) throw new Error('Kaynakta sürüm bilgisi yok.');
      if (surumKarsilastir(bulunan.surum, SURUM) > 0) {
        sonucYaz(`Yeni sürüm: ${bulunan.surum}${bulunan.tarih ? ' · ' + bulunan.tarih : ''}${bulunan.not ? '\n' + bulunan.not : ''}`, '#30d158');
        UPD.guncelle.disabled = false;
      } else {
        sonucYaz(`Güncel (kaynak: ${bulunan.surum}, kurulu: ${SURUM})`);
        bulunan = null;
      }
    } catch (e) {
      sonucYaz(`Hata: ${e.message}`, '#ff453a');
      bulunan = null;
    } finally {
      UPD.kontrol.disabled = false;
    }
  });

  /** Ayarların tarih damgalı yedeğini indirir. */
  async function ayarYedegiIndir() {
    const veri = await chrome.storage.local.get(null);
    const damga = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const blob = new Blob([JSON.stringify({ surum: SURUM, tarih: damga, ayarlar: veri }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `msa-ayar-yedegi-v${SURUM}-${damga}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return a.download;
  }

  UPD.guncelle.addEventListener('click', async () => {
    if (!bulunan) return;
    const github = bulunan.kaynak === 'github';
    const onay = confirm(
      `Sürüm ${SURUM} → ${bulunan.surum}\n\n` +
        '1) Ayarlarınızın yedeği indirilecek.\n' +
        '2) Mevcut eklenti klasörünü kopyalayarak kod yedeği alın.\n' +
        (github ? '3) Yeni sürüm paketi (zip) indirilecek.\n' : `3) Yeni dosyalar "${bulunan.klasor}" klasöründe.\n`) +
        '4) Dosyaları eklenti klasörüne kopyalayıp "eklentiyi yenile"ye basın.\n\nDevam edilsin mi?'
    );
    if (!onay) return;

    UPD.guncelle.disabled = true;
    try {
      const yedek = await ayarYedegiIndir();
      if (github) {
        if (!/^https:\/\//i.test(bulunan.indir || '')) throw new Error('İndirme adresi HTTPS değil, reddedildi.');
        chrome.tabs.create({ url: bulunan.indir, active: false });
      }
      sonucYaz(
        `Ayar yedeği: ${yedek}\n` +
          (github ? "Paket indiriliyor. Zip'i açıp " : `"${bulunan.klasor}" içindeki `) +
          'manifest.json, background.js, version.json, html2pdf.bundle.min.js ve src/, popup/, icons/ öğelerini eklenti klasörüne kopyalayın.\n' +
          'Sorun olursa kopyaladığınız eski klasörü geri koyup yenileyin.',
        '#5ac8fa'
      );
      UPD.yenile.style.display = '';
    } catch (e) {
      sonucYaz(`Hata: ${e.message}`, '#ff453a');
      UPD.guncelle.disabled = false;
    }
  });

  UPD.yenile.addEventListener('click', () => chrome.runtime.reload());
});
