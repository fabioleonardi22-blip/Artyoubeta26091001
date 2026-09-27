export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, errore: 'method_not_allowed' });
  }

  const { action, code, pin } = req.body || {};
  const expectedPin = process.env.ARTYOU_SCANNER_PIN;
  const appsScriptUrl = process.env.ARTYOU_APPS_SCRIPT_URL;
  const scannerSecret = process.env.ARTYOU_SCANNER_SECRET;

  if (!expectedPin || !appsScriptUrl || !scannerSecret) {
    return res.status(500).json({ ok: false, errore: 'scanner_not_configured' });
  }

  if (String(pin || '') !== String(expectedPin)) {
    return res.status(401).json({ ok: false, errore: 'pin_non_valido' });
  }

  if (!['lookup', 'checkin'].includes(String(action || ''))) {
    return res.status(400).json({ ok: false, errore: 'azione_non_valida' });
  }

  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!/^ART-\d{8}-[A-Z0-9]+$/.test(normalizedCode)) {
    return res.status(400).json({ ok: false, errore: 'codice_non_valido' });
  }

  try {
    const upstream = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: action === 'lookup' ? 'scanner_lookup' : 'scanner_checkin',
        codice: normalizedCode,
        scannerSecret
      }),
      redirect: 'follow'
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return res.status(502).json({ ok: false, errore: 'risposta_apps_script_non_valida' }); }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ ok: false, errore: 'apps_script_non_raggiungibile' });
  }
}