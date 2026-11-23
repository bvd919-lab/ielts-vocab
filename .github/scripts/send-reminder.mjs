// Sends the daily "time to review" Web Push with a word of the day.
// Secrets: VAPID_PRIVATE_KEY, PUSH_SUBSCRIPTION (one JSON subscription, or several on separate lines).
import fs from "node:fs";
import webpush from "web-push";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BEhgmHUNltY2C5aLqjAXYlAEbB8UujKQvs0H4xjcxaYNFy7WH_D-Wr-AwaQO1CtjNfw47ChdGixCcHz_uMJIJnI";
const { VAPID_PRIVATE_KEY, PUSH_SUBSCRIPTION } = process.env;
if (!VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTION) {
  console.log("Reminder skipped: add the VAPID_PRIVATE_KEY and PUSH_SUBSCRIPTION secrets in Settings → Secrets and variables → Actions.");
  process.exit(0);
}

// Word of the day: prefer this week's notes, otherwise any IELTS word.
function pickWord() {
  const html = fs.readFileSync("index.html", "utf8");
  const block = name => (html.match(new RegExp("const " + name + "=`([\\s\\S]*?)`;")) || [])[1] || "";
  const rows = txt => txt.split("\n").filter(l => l && !l.startsWith("#")).map(l => l.split("|")).filter(f => f.length >= 5);
  const notes = rows(block("NOTES_RAW")), all = notes.concat(rows(block("IELTS_RAW")));
  const pool = notes.length && Math.random() < 0.6 ? notes : all;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
const w = pickWord();
const payload = JSON.stringify({
  title: "Time to review 📚",
  body: w ? `Word of the day: ${w[0]} — ${w[3]}\nTap to practise a few cards.` : "Open Picture Vocab and review a few words.",
  url: "./",
});

webpush.setVapidDetails("https://github.com/bvd919-lab/ielts-vocab", PUBLIC_KEY, VAPID_PRIVATE_KEY);
const subs = PUSH_SUBSCRIPTION.split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => JSON.parse(s));
let failed = 0;
for (const sub of subs) {
  try { await webpush.sendNotification(sub, payload, { TTL: 6 * 3600 }); console.log("Sent to", sub.endpoint.slice(0, 60) + "…"); }
  catch (e) {
    failed++;
    console.error("Failed:", e.statusCode, e.body || e.message);
    if (e.statusCode === 404 || e.statusCode === 410) console.error("This subscription expired. Open the app → Profile → Daily reminder, and save the new code as PUSH_SUBSCRIPTION.");
  }
}
if (failed === subs.length) process.exit(1);
