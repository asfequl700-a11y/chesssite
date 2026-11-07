// Builds the Supabase Auth email templates (supabase/templates/*.html) from one shared layout.
// Email apps only support simple HTML: tables + inline styles, no web fonts, no CSS files.
// Visuals are made of HTML (chessboard stripe, 3D button, emoji tiles) so nothing is blocked as an "image".
// Run: node scripts/build-emails.mjs   Then paste each file into Supabase → Authentication → Emails → Templates.
import { mkdirSync, writeFileSync } from "node:fs";

const C = { bg: "#302e2b", card: "#262421", tile: "#3a3835", light: "#ebecd0", dark: "#739552", green: "#81b64c", greenDark: "#45753c", text: "#ffffff", muted: "#bababa" };
const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const serif = "Georgia,'Times New Roman',serif";

const stripe = () =>
  `<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${Array.from({ length: 16 }, (_, i) => `<td style="height:12px;background:${i % 2 ? C.dark : C.light};font-size:0;line-height:0">&nbsp;</td>`).join("")}</tr></table></td></tr>`;

const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 8px">
  <tr><td style="background:${C.green};border-radius:10px;border-bottom:5px solid ${C.greenDark}">
    <a href="${href}" style="display:inline-block;padding:16px 40px;font-family:${font};font-size:20px;font-weight:800;color:#ffffff;text-decoration:none">${label}</a>
  </td></tr>
</table>`;

const tiles = (items) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr>
${items
  .map(
    ([icon, title, text]) => `<td width="33%" valign="top" style="padding:4px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:${C.tile};border-radius:10px;padding:16px 10px;text-align:center">
    <div style="font-size:30px;line-height:36px">${icon}</div>
    <div style="font-family:${font};font-size:14px;font-weight:700;color:${C.text};padding-top:6px">${title}</div>
    <div style="font-family:${font};font-size:12px;color:${C.muted};padding-top:4px">${text}</div>
  </td></tr></table>
</td>`,
  )
  .join("")}
</tr></table>`;

/** The shared layout: chessboard stripe, logo, big card, footer. `preheader` = the grey preview line in the inbox. */
const layout = ({ preheader, title, intro, cta, extra = "", note }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border-radius:14px;overflow:hidden">
    ${stripe()}
    <tr><td style="padding:28px 32px 0;text-align:center">
      <div style="font-family:${serif};font-size:30px;font-weight:700;color:${C.text}">&#9822; ChessSite</div>
      <div style="font-family:${font};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.green};padding-top:4px">Free chess, forever</div>
    </td></tr>
    <tr><td style="padding:28px 32px 32px;text-align:center">
      <h1 style="margin:0;font-family:${serif};font-size:32px;line-height:38px;font-weight:700;color:${C.text}">${title}</h1>
      <p style="margin:14px 0 0;font-family:${font};font-size:16px;line-height:24px;color:${C.muted}">${intro}</p>
      ${button(cta.href, cta.label)}
      <p style="margin:10px 0 0;font-family:${font};font-size:12px;color:${C.muted}">${note}</p>
      ${extra}
    </td></tr>
    <tr><td style="padding:18px 32px;background:#1f1e1c;text-align:center">
      <p style="margin:0;font-family:${font};font-size:12px;line-height:18px;color:#8b8987">
        Button not working? Copy this link into your browser:<br>
        <a href="${cta.href}" style="color:${C.green};word-break:break-all">${cta.href}</a>
      </p>
    </td></tr>
    ${stripe()}
  </table>
  <p style="margin:16px 0 0;font-family:${font};font-size:12px;color:#8b8987">ChessSite &middot; Play, puzzles and unlimited game review, all free.</p>
</td></tr>
</table>
</body>
</html>
`;

// {{ .ConfirmationURL }} etc. are filled in by Supabase when it sends the email.
const templates = {
  confirmation: {
    subject: "Confirm your ChessSite account ♞",
    html: layout({
      preheader: "One click and your free account is ready: bots, puzzles and unlimited game review.",
      title: "Your board is ready!",
      intro: "Thanks for joining ChessSite. Confirm your email and start playing: everything here is free, including unlimited game review.",
      cta: { href: "{{ .ConfirmationURL }}", label: "Confirm my email" },
      note: "This link works once and expires soon, so use it now.",
      extra: tiles([
        ["&#129302;", "10 bots", "From beginner to master"],
        ["&#129513;", "Puzzles", "Rating, themes, Rush"],
        ["&#128269;", "Game Review", "Unlimited, no paywall"],
      ]),
    }),
  },
  recovery: {
    subject: "Reset your ChessSite password",
    html: layout({
      preheader: "Someone asked to reset your ChessSite password. If it was you, use the button inside.",
      title: "Reset your password",
      intro: "We got a request to reset the password for <b style=\"color:#ffffff\">{{ .Email }}</b>. Click below to choose a new one.",
      cta: { href: "{{ .ConfirmationURL }}", label: "Choose a new password" },
      note: "Didn't ask for this? Ignore this email: your password stays the same.",
    }),
  },
  email_change: {
    subject: "Confirm your new ChessSite email",
    html: layout({
      preheader: "Confirm the new email address for your ChessSite account.",
      title: "Confirm your new email",
      intro: "You asked to change your ChessSite email from <b style=\"color:#ffffff\">{{ .Email }}</b> to <b style=\"color:#ffffff\">{{ .NewEmail }}</b>.",
      cta: { href: "{{ .ConfirmationURL }}", label: "Confirm new email" },
      note: "Didn't ask for this? Ignore this email and nothing changes.",
    }),
  },
};

const dir = new URL("../supabase/templates/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const [name, t] of Object.entries(templates)) writeFileSync(new URL(`${name}.html`, dir), t.html);
writeFileSync(new URL("subjects.txt", dir), Object.entries(templates).map(([n, t]) => `${n}: ${t.subject}`).join("\n") + "\n");
console.log("emails written:", Object.keys(templates).join(", "));
