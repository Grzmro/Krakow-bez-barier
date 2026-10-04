import type { Messages } from "../messages";

export const share: Messages["share"] = {
  button: "Share",
  panelLabel: "Sharing",
  place: { title: (name: string) => `${name} — Kraków bez barier`, text: "Check the accessibility of this place." },
  route: { title: "Route — Kraków bez barier", text: "Check the accessibility of this route." },
  send: "Send…",
  copy: "Copy link",
  copied: "Link copied",
  copyFailed: "Couldn't copy the link",
  linkLabel: "Link to share",
  qrLabel: "QR code with the link",
  qrHint: "The recipient scans the code with their phone camera.",
  privacy: "The link has neither your needs profile nor your account.",
  includeStart: "Include my start",
  includeStartHint: "We add your position rounded to about 100 m. Without it the recipient picks their own start.",
  noPositionYet: "With no start in the link, the recipient starts from their own position or picks a start.",
  notice: {
    title: "Someone shared this plan with you",
    place: "The place card is the same for everyone, but the accessibility rating is computed from your needs profile.",
    route: "The route is planned again from your needs profile, so it may differ from the sender's.",
    withProfile: (profileName: string) => `Your profile: ${profileName}. The profile stays in your browser.`,
    noProfile: "You have no profile yet, so we check stairs and surface by default. Pick a profile to make the rating fit you.",
  },
};
