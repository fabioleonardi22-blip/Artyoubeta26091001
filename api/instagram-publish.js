const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const { requireUser, authErrorStatus } = require("../lib/authorization");

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);
  if (String(req.method || "GET").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, errore: "method_not_allowed" });
  }
  if (!sameOrigin(req)) {
    return res.status(403).json({ ok:false, errore:"origin_non_consentita" });
  }

  const general = rateLimit(req, { key:"instagram-publish", limit:10, windowMs:10 * 60 * 1000 });
  applyRateLimitHeaders(res, general);
  if (!general.ok) return rejectRateLimited(res, general);

  try {
    try { await requireUser(req, ["admin"]); }
    catch (authErr) {
      const code=String(authErr&&authErr.message||"auth_error");
      return res.status(authErrorStatus(code)).json({ok:false,errore:code});
    }
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
    if (!token || !accountId) {
      return res.status(500).json({ ok: false, errore: "instagram_not_configured" });
    }

    let body = req.body || {};
    if (typeof body === "string") {
      if (Buffer.byteLength(body, "utf8") > 64 * 1024) {
        return res.status(413).json({ ok:false, errore:"payload_too_large" });
      }
      try { body = JSON.parse(body || "{}"); }
      catch (_) { return res.status(400).json({ ok:false, errore:"json_non_valido" }); }
    }

    delete body.pin;
    const caption = String(body.caption || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();

    if (!caption || caption.length > 2200) {
      return res.status(400).json({ ok: false, errore: "caption_non_valida" });
    }

    let parsedImage;
    try { parsedImage = new URL(imageUrl); } catch (_) {}
    if (!parsedImage || parsedImage.protocol !== "https:") {
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
        errore: "instagram_container_error"
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
        errore: "instagram_publish_error"
      });
    }

    return res.status(200).json({
      ok: true,
      media_id: publishData.id,
      creation_id: createData.id
    });
  } catch (_) {
    return res.status(500).json({
      ok: false,
      errore: "instagram_publish_exception"
    });
  }
};
