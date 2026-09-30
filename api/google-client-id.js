module.exports = async function handler(req, res) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  res.setHeader("Cache-Control", "no-store");
  if (!clientId) return res.status(503).json({ok:false, errore:"google_client_id_missing"});
  return res.status(200).json({ok:true, clientId});
};
