module.exports = (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "GET only" });
  }

  // Diagnostic only: never return secret values or lengths.
  return res.status(200).json({
    ok: true,
    environment: process.env.VERCEL_ENV || "unknown",
    branch: process.env.VERCEL_GIT_COMMIT_REF || "unknown",
    hasGithubToken: Boolean(process.env.GITHUB_TOKEN),
    hasEquipmentAdminKey: Boolean(process.env.EQUIPMENT_ADMIN_KEY)
  });
};
