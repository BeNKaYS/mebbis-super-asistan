/*
 * MEBBİS Süper Asistan — Arka plan (service worker)
 * Popup'a lisans durumunu bildirir.
 */
const LISANS_BITIS = 1798059599000; // 23.12.2026 23:59:59 (GMT+3)
const LISANS_BITIS_METIN = '23.12.2026';
const GELISTIRICI = 'Sercan ÖZDEMİR';
const GUN_MS = 86400000;

async function lisansDurumu() {
  const simdi = Date.now();
  let gecerli = true;
  let sebep = '';

  // Sistem saati geri alınmış mı? (son görülen zaman bugünden 1 günden fazla ilerideyse)
  try {
    const { last_seen_time: sonGorulen = 0 } = await chrome.storage.local.get(['last_seen_time']);
    if (sonGorulen > simdi + GUN_MS) {
      gecerli = false;
      sebep = 'Geçersiz sistem saati tespit edildi.';
    } else {
      await chrome.storage.local.set({ last_seen_time: simdi });
    }
  } catch (e) {
    console.error('Storage kontrol hatası:', e);
  }

  if (gecerli && simdi > LISANS_BITIS) {
    gecerli = false;
    sebep = `2 Aylık kullanım lisansı (${LISANS_BITIS_METIN}) sona erdi.`;
  }

  return {
    valid: gecerli,
    reason: sebep,
    daysRemaining: Math.ceil(Math.max(0, LISANS_BITIS - simdi) / GUN_MS),
    expiresDateStr: LISANS_BITIS_METIN,
    developer: GELISTIRICI,
    version: chrome.runtime.getManifest().version,
  };
}

chrome.runtime.onMessage.addListener((mesaj, _gonderen, cevapla) => {
  if (mesaj && mesaj.type === 'CHECK_LICENSE') {
    lisansDurumu().then(cevapla);
    return true; // async cevap
  }
});
