/*
 * MEBBİS Süper Asistan — Arka plan (service worker)
 * Lisans: ilk kurulumdan 60 gün deneme → sonra makineye bağlı, imzalı anahtar.
 * İçerik betikleri yalnızca lisans geçerliyken sayfaya eklenir (dinamik kayıt).
 * Anahtarları üreten özel anahtar License-Vault'ta durur; burada sadece açık anahtar var.
 */
const GELISTIRICI = 'Sercan ÖZDEMİR';
const GUN_MS = 86400000;
const DENEME_GUN = 60;
const UYGULAMA = 'MEBBIS-Super-Asistan';
const GENEL_ANAHTAR_HEX = '86ae6671d8157250aa52141423d83b931f2ba263c74c47715718d2e69beed8dc';
const KAYIT_ID = 'msa-ana';
const ICERIK_BETIKLERI = [
  'html2pdf.bundle.min.js',
  'src/00-core.js', 'src/05-seans.js', 'src/10-turbo.js', 'src/20-gezgin.js', 'src/30-sure.js',
  'src/40-rapor.js', 'src/45-egitmen.js', 'src/50-panel.js', 'src/90-main.js',
];

const hexBayt = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const b64uBayt = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Makine kodu: kuruluma özgü rastgele kimlik + donanım özeti. Başka PC'de veya yeni kurulumda değişir. */
async function makineKodu() {
  let { msa_lic_uid: uid } = await chrome.storage.local.get('msa_lic_uid');
  if (!uid) {
    uid = crypto.randomUUID();
    await chrome.storage.local.set({ msa_lic_uid: uid });
  }
  let donanim = '';
  try {
    const [cpu, bellek] = await Promise.all([chrome.system.cpu.getInfo(), chrome.system.memory.getInfo()]);
    donanim = [cpu.modelName, cpu.archName, cpu.numOfProcessors, bellek.capacity].join('|');
  } catch (e) { /* izin yoksa yalnızca uid */ }
  const ozet = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${uid}|${donanim}|${navigator.platform}`));
  const hex = [...new Uint8Array(ozet)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20).toUpperCase();
  return hex.match(/.{4}/g).join('-');
}

/** Anahtarı doğrular; geçerliyse yükü, değilse {hata} döner. */
async function anahtarCoz(anahtar, makine) {
  try {
    const m = /^MSALIC_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec((anahtar || '').trim());
    if (!m) return { hata: 'Anahtar biçimi geçersiz.' };
    const yukBayt = b64uBayt(m[1]);
    const genel = await crypto.subtle.importKey('raw', hexBayt(GENEL_ANAHTAR_HEX), { name: 'Ed25519' }, false, ['verify']);
    if (!(await crypto.subtle.verify({ name: 'Ed25519' }, genel, b64uBayt(m[2]), yukBayt))) {
      return { hata: 'Anahtar imzası geçersiz.' };
    }
    const yuk = JSON.parse(new TextDecoder().decode(yukBayt));
    if (yuk.app !== UYGULAMA) return { hata: 'Anahtar bu uygulama için değil.' };
    if (yuk.mid !== makine) return { hata: 'Anahtar bu bilgisayar için üretilmemiş.' };
    return { yuk };
  } catch (e) {
    return { hata: 'Anahtar okunamadı.' };
  }
}

const bitisZamani = (exp) => new Date(`${exp}T23:59:59`).getTime();
const trTarih = (ms) => new Date(ms).toLocaleDateString('tr-TR');

async function ilkKurulumZamani(simdi) {
  const yerel = (await chrome.storage.local.get('msa_lic_ilk')).msa_lic_ilk;
  let esit;
  try { esit = (await chrome.storage.sync.get('msa_lic_ilk')).msa_lic_ilk; } catch (e) { /* sync kapalı */ }
  const ilk = Math.min(...[yerel, esit].filter((x) => Number.isFinite(x)), simdi);
  if (yerel !== ilk) await chrome.storage.local.set({ msa_lic_ilk: ilk });
  if (esit !== ilk) { try { await chrome.storage.sync.set({ msa_lic_ilk: ilk }); } catch (e) { /* yoksay */ } }
  return ilk;
}

async function lisansDurumu() {
  const simdi = Date.now();
  const makine = await makineKodu();
  const taban = { developer: GELISTIRICI, version: chrome.runtime.getManifest().version, machineCode: makine };

  // Sistem saati geri alınmış mı?
  const { last_seen_time: sonGorulen = 0 } = await chrome.storage.local.get('last_seen_time');
  if (sonGorulen > simdi + GUN_MS) {
    return { ...taban, valid: false, mode: 'kilitli', reason: 'Geçersiz sistem saati tespit edildi.', daysRemaining: 0, expiresDateStr: '—' };
  }
  await chrome.storage.local.set({ last_seen_time: Math.max(simdi, sonGorulen) });

  // 1) Lisans anahtarı
  const { msa_lic_anahtar: anahtar } = await chrome.storage.local.get('msa_lic_anahtar');
  let anahtarNotu = '';
  if (anahtar) {
    const c = await anahtarCoz(anahtar, makine);
    if (c.yuk) {
      const bitis = bitisZamani(c.yuk.exp);
      if (simdi <= bitis) {
        return {
          ...taban, valid: true, mode: 'lisans', owner: c.yuk.owner, reason: '',
          daysRemaining: Math.ceil((bitis - simdi) / GUN_MS), expiresDateStr: trTarih(bitis),
        };
      }
      anahtarNotu = `Lisans süresi (${trTarih(bitis)}) doldu.`;
    } else {
      anahtarNotu = c.hata;
    }
  }

  // 2) Deneme
  const ilk = await ilkKurulumZamani(simdi);
  const denemeBitis = ilk + DENEME_GUN * GUN_MS;
  if (simdi <= denemeBitis) {
    return {
      ...taban, valid: true, mode: 'deneme', reason: anahtarNotu,
      daysRemaining: Math.ceil((denemeBitis - simdi) / GUN_MS), expiresDateStr: trTarih(denemeBitis),
    };
  }
  return {
    ...taban, valid: false, mode: 'kilitli', daysRemaining: 0, expiresDateStr: trTarih(denemeBitis),
    reason: anahtarNotu || `${DENEME_GUN} günlük deneme süresi doldu. Lisans anahtarı gerekli.`,
  };
}

/** Lisans geçerliyse içerik betiklerini kaydeder, değilse kaldırır. */
async function senkronize(zorla = false) {
  const durum = await lisansDurumu();
  try {
    const var_ = (await chrome.scripting.getRegisteredContentScripts({ ids: [KAYIT_ID] })).length > 0;
    if (zorla && var_) await chrome.scripting.unregisterContentScripts({ ids: [KAYIT_ID] });
    if (durum.valid && (zorla || !var_)) {
      await chrome.scripting.registerContentScripts([{
        id: KAYIT_ID, matches: ['*://mebbis.meb.gov.tr/*'], js: ICERIK_BETIKLERI,
        world: 'MAIN', runAt: 'document_idle', persistAcrossSessions: true,
      }]);
    } else if (!durum.valid && var_) {
      await chrome.scripting.unregisterContentScripts({ ids: [KAYIT_ID] });
    }
  } catch (e) {
    console.error('İçerik betiği kaydı hatası:', e);
  }
  return durum;
}

chrome.runtime.onInstalled.addListener(() => { senkronize(true); });
chrome.runtime.onStartup.addListener(() => { senkronize(); });
chrome.alarms.create('msa-lisans', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'msa-lisans') senkronize(); });
senkronize();

chrome.runtime.onMessage.addListener((mesaj, _gonderen, cevapla) => {
  if (!mesaj) return;
  if (mesaj.type === 'CHECK_LICENSE') {
    senkronize().then(cevapla);
    return true;
  }
  if (mesaj.type === 'ACTIVATE_LICENSE') {
    (async () => {
      const makine = await makineKodu();
      const c = await anahtarCoz(mesaj.key, makine);
      if (!c.yuk) return cevapla({ ok: false, hata: c.hata });
      if (simdiGecti(c.yuk.exp)) return cevapla({ ok: false, hata: 'Bu anahtarın süresi dolmuş.' });
      await chrome.storage.local.set({ msa_lic_anahtar: mesaj.key.trim() });
      cevapla({ ok: true, durum: await senkronize(true) });
    })();
    return true;
  }
});

const simdiGecti = (exp) => Date.now() > bitisZamani(exp);
