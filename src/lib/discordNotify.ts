// Posts a short notice to the shop owner's Discord channel. The webhook URL is a secret kept in the
// DISCORD_WEBHOOK_URL environment variable (Vercel / .env.local) -- if it isn't set this does
// nothing. Never throws: a Discord outage must not affect order processing.
export async function notifyOwner(content: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Charo 3D 注文通知",
        content: content.slice(0, 1800),
        allowed_mentions: { parse: [] },
      }),
    });
    if (!res.ok) console.error(`Discord notify failed: ${res.status}`);
  } catch (error) {
    console.error("Discord notify failed", error);
  }
}
