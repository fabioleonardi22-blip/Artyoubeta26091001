module.exports = async function handler(req, res) {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    return res.status(405).json({ ok: false, errore: "method_not_allowed" });
  }

  try {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

    if (!token || !accountId) {
      return res.status(500).json({ ok: false, errore: "instagram_not_configured" });
    }

    const fields = [
      "id",
      "caption",
      "media_type",
      "media_url",
      "thumbnail_url",
      "permalink",
      "timestamp"
    ].join(",");

    const url = new URL("https://graph.instagram.com/" + encodeURIComponent(accountId) + "/media");
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "9");
    url.searchParams.set("access_token", token);

    const response = await fetch(url.toString());
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch (_) {}

    if (!response.ok || !Array.isArray(data.data)) {
      return res.status(response.status || 502).json({
        ok: false,
        errore: "instagram_feed_error",
        dettaglio: data.error || text
      });
    }

    const posts = data.data.slice(0, 9).map((item) => ({
      id: item.id,
      caption: String(item.caption || "").trim(),
      media_type: item.media_type || "",
      image_url: item.media_type === "VIDEO"
        ? (item.thumbnail_url || item.media_url || "")
        : (item.media_url || item.thumbnail_url || ""),
      permalink: item.permalink || "https://www.instagram.com/artyouroma/",
      timestamp: item.timestamp || ""
    })).filter((item) => item.image_url);

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ ok: true, posts });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      errore: "instagram_feed_exception",
      dettaglio: String(err && err.message || err)
    });
  }
};