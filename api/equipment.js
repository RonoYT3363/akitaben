const crypto = require("crypto");

const REPO = process.env.GITHUB_REPOSITORY || "RonoYT3363/akitaben";
const API_BASE = "https://api.github.com";

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function github(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + process.env.GITHUB_TOKEN,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "GitHub API error");
  return data;
}

module.exports = async (req, res) => {
  const adminKey = process.env.EQUIPMENT_ADMIN_KEY;
  const githubToken = process.env.GITHUB_TOKEN;

  // Safe GET diagnostic for this exact function; never expose secret values.
  if (req.method === "GET") {
    return send(res, 200, {
      ok: true,
      environment: process.env.VERCEL_ENV || "unknown",
      branch: process.env.VERCEL_GIT_COMMIT_REF || "unknown",
      hasGithubToken: Boolean(githubToken),
      hasEquipmentAdminKey: Boolean(adminKey)
    });
  }
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  if (!adminKey || !githubToken) return send(res, 503, { error: "Vercel環境変数 GITHUB_TOKEN と EQUIPMENT_ADMIN_KEY の設定が必要です。" });

  const supplied = String(req.headers["x-equipment-admin-key"] || "");
  const a = Buffer.from(supplied), b = Buffer.from(adminKey);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return send(res, 401, { error: "管理キーが正しくありません。" });

  try {
    const { name, rarity, category, fileName, mimeType, imageBase64 } = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.length > 60) return send(res, 400, { error: "装備品名を確認してください。" });
    if (!["N", "R", "SR", "SSR"].includes(rarity)) return send(res, 400, { error: "レア度が不正です。" });
    if (!["持ち物", "頭装備", "アクセサリー", "背中装備", "特殊装備", "服装"].includes(category)) return send(res, 400, { error: "カテゴリが不正です。" });
    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType) || typeof imageBase64 !== "string") return send(res, 400, { error: "画像形式が不正です。" });
    const buffer = Buffer.from(imageBase64, "base64");
    if (!buffer.length || buffer.length > 2 * 1024 * 1024) return send(res, 413, { error: "画像は2MB以下にしてください。" });
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const slug = name.trim().normalize("NFKC").toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, "-").replace(/^-|-$/g, "") || "equipment";
    const id = slug + "-" + crypto.createHash("sha256").update(name.trim()).digest("hex").slice(0, 8);
    const imagePath = "assets/equipment/" + id + "." + ext;
    const imageUrl = "https://raw.githubusercontent.com/" + REPO + "/dm-test/" + imagePath;
    const headers = { "Authorization": "Bearer " + githubToken };
    const imageApiPath = "/repos/" + REPO + "/contents/" + imagePath.split("/").map(encodeURIComponent).join("/");
    let existingImage = null;
    try { existingImage = await github(imageApiPath); } catch (e) { if (!String(e.message).includes("Not Found")) throw e; }
    const imagePayload = { message: "Add equipment image: " + name.trim(), content: buffer.toString("base64"), branch: "dm-test" };
    if (existingImage && existingImage.sha) imagePayload.sha = existingImage.sha;
    await github(imageApiPath, { method: "PUT", body: JSON.stringify(imagePayload) });

    const dataPath = "/repos/" + REPO + "/contents/data/equipment.json";
    let dataFile = null;
    try { dataFile = await github(dataPath); } catch (e) { if (!String(e.message).includes("Not Found")) throw e; }
    let items = [];
    if (dataFile && dataFile.content) items = JSON.parse(Buffer.from(dataFile.content.replace(/\n/g, ""), "base64").toString("utf8"));
    if (!Array.isArray(items)) throw new Error("equipment.json must contain an array");
    const entry = { id, name: name.trim(), rarity, category, image: imageUrl };
    const index = items.findIndex(item => item.id === id);
    if (index >= 0) items[index] = entry; else items.push(entry);
    const dataPayload = { message: "Update equipment catalog: " + name.trim(), content: Buffer.from(JSON.stringify(items, null, 2) + "\n").toString("base64"), branch: "dm-test" };
    if (dataFile && dataFile.sha) dataPayload.sha = dataFile.sha;
    await github(dataPath, { method: "PUT", body: JSON.stringify(dataPayload) });
    return send(res, 200, { ok: true, id, imagePath, image: imageUrl });
  } catch (error) {
    console.error("Equipment GitHub upload failed:", error);
    return send(res, 500, { error: "保存に失敗しました: " + error.message });
  }
};
