const crypto = require("crypto");

const REPO = process.env.GITHUB_REPOSITORY || "RonoYT3363/akitaben";
const BRANCH = "dm-test";
const FILE_PATH = "data/quiz.json";
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
  const githubToken = process.env.GITHUB_TOKEN;
  if (req.method === "GET") {
    if (!githubToken) return send(res, 503, { error: "クイズデータを読み込めません。サーバー設定を確認してください。" });
    try {
      const file = await github("/repos/" + REPO + "/contents/" + FILE_PATH + "?ref=" + BRANCH);
      const raw = Buffer.from(file.content.replace(/\\n/g, ""), "base64").toString("utf8");
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) throw new Error("quiz.json must contain an array");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("CDN-Cache-Control", "no-store");
      return res.status(200).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(items));
    } catch (error) {
      console.error("Quiz read failed:", error);
      return send(res, 500, { error: "クイズデータの読み込みに失敗しました。" });
    }
  }
  if (req.method !== "POST") return send(res, 405, { error: "GET or POST only" });
  const adminKey = process.env.EQUIPMENT_ADMIN_KEY;
  if (!adminKey || !githubToken) return send(res, 503, { error: "Vercel環境変数 GITHUB_TOKEN と EQUIPMENT_ADMIN_KEY の設定が必要です。" });
  const supplied = String(req.headers["x-equipment-admin-key"] || "");
  const a = Buffer.from(supplied), b = Buffer.from(adminKey);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return send(res, 401, { error: "管理キーが正しくありません。" });
  try {
    const { action = "save", id, difficulty, question, choices, answerIndex, explanation = "", active = true } = req.body || {};
    const dataPath = "/repos/" + REPO + "/contents/" + FILE_PATH;
    const file = await github(dataPath + "?ref=" + BRANCH);
    const raw = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
    let items = JSON.parse(raw);
    if (!Array.isArray(items)) throw new Error("quiz.json must contain an array");
    if (action === "delete") {
      if (typeof id !== "string" || !id) return send(res, 400, { error: "削除対象が指定されていません。" });
      items = items.filter(item => item.id !== id);
    } else if (action === "save") {
      if (!["easy", "hard"].includes(difficulty)) return send(res, 400, { error: "難易度が不正です。" });
      if (typeof question !== "string" || !question.trim() || question.length > 500) return send(res, 400, { error: "問題文を確認してください。" });
      if (!Array.isArray(choices) || choices.length !== 4 || choices.some(v => typeof v !== "string" || !v.trim() || v.length > 160)) return send(res, 400, { error: "4つの選択肢を入力してください。" });
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return send(res, 400, { error: "正解の指定が不正です。" });
      if (typeof explanation !== "string" || explanation.length > 1000) return send(res, 400, { error: "解説が長すぎます。" });
      const entry = { id: id || crypto.randomUUID(), difficulty, question: question.trim(), choices: choices.map(v => v.trim()), answerIndex, explanation: explanation.trim(), active: Boolean(active) };
      const index = items.findIndex(item => item.id === entry.id);
      if (index >= 0) items[index] = entry; else items.push(entry);
    } else return send(res, 400, { error: "操作が不正です。" });
    const payload = { message: action === "delete" ? "Delete quiz question" : "Save quiz question", content: Buffer.from(JSON.stringify(items, null, 2) + "\n").toString("base64"), branch: BRANCH, sha: file.sha };
    await github(dataPath, { method: "PUT", body: JSON.stringify(payload) });
    return send(res, 200, { ok: true });
  } catch (error) {
    console.error("Quiz admin failed:", error);
    return send(res, 500, { error: "クイズの保存に失敗しました: " + error.message });
  }
};
