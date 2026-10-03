const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgqQguCWRt7yCTroh2qi4az1rCTZ7kgw0IxNRNDb9LZLOGPUD5Jy3K56NTi6FxAfKx/exec";

async function validateAdminPin(pin) {
  if (!pin) return false;
  const url = APPS_SCRIPT_URL + "?action=list&pin=" + encodeURIComponent(pin) + "&_=" + Date.now();
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) return false;
  let data = null;
  try { data = await r.json(); } catch (_) { return false; }
  return !!(data && data.ok);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (String(req.method || "GET").toUpperCase() !== "POST") {
    return res.status(405).json({ ok: false, errore: "method_not_allowed" });
  }

  try {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
    if (!token || !accountId) {
      return res.status(500).json({ ok: false, errore: "instagram_not_configured" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const pin = String(body.pin || "").trim();
    const caption = String(body.caption || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();

    if (!(await validateAdminPin(pin))) {
      return res.status(401).json({ ok: false, errore: "pin_non_valido" });
    }
    if (!caption) return res.status(400).json({ ok: false, errore: "caption_mancante" });
    if (!/^https:\/\//i.test(imageUrl)) {
      return res.status(400).json({ ok: false, errore: "image_url_non_pubblico" });
    }

    const createParams = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: token
    });

    const createResp = await fetch(
      "https://graph.instagram.com/" + encodeURIComponent(accountId) + "/media",
      { method: "POST", body: createParams }
    );
    const createText = await createResp.text();
    let createData = {};
    try { createData = JSON.parse(createText); } catch (_) {}

    if (!createResp.ok || !createData.id) {
      return res.status(createResp.status || 502).json({
        ok: false,
        errore: "instagram_container_error",
        dettaglio: createData.error || createText
      });
    }

    const publishParams = new URLSearchParams({
      creation_id: createData.id,
      access_token: token
    });

    const publishResp = await fetch(
      "https://graph.instagram.com/" + encodeURIComponent(accountId) + "/media_publish",
      { method: "POST", body: publishParams }
    );
    const publishText = await publishResp.text();
    let publishData = {};
    try { publishData = JSON.parse(publishText); } catch (_) {}

    if (!publishResp.ok || !publishData.id) {
      return res.status(publishResp.status || 502).json({
        ok: false,
        errore: "instagram_publish_error",
        dettaglio: publishData.error || publishText,
        creation_id: createData.id
      });
    }

    return res.status(200).json({
      ok: true,
      media_id: publishData.id,
      creation_id: createData.id
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      errore: "instagram_publish_exception",
      dettaglio: String(err && err.message || err)
    });
  }
};