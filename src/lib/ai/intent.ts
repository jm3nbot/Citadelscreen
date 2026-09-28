// Cheap keyword-based intent detection. Used by /api/ai/assistant to decide
// which context blocks to attach to the prompt + whether to enable the
// "change settings" action protocol. A real implementation would use a
// router model or Gemini function-calling; for MVP a regex catches most.

const EMAIL_RE = [
  /\bemails?\b/i,
  /\binbox(es)?\b/i,
  /\bmail\b/i,
  /\bsenders?\b/i,
  /\bunread\b/i,
  /\bgmail\b/i,
  /\bthreads?\b/i,
  /\breply\b/i,
  /\battention\b/i,
  /\bmessages?\b/i,
  /\bsubject(s| line)?\b/i,
  /\bfrom\s+\w+/i,
];

const SPOTIFY_RE = [
  /\bspotify\b/i,
  /\bplaying\b/i,
  /\bcurrently listening\b/i,
  /\bmy music\b/i,
  /\btop tracks?\b/i,
  /\btop artists?\b/i,
  /\brecently played\b/i,
  /\b(what|which) song\b/i,
];

const YOUTUBE_RE = [
  /\byoutube\b/i,
  /\bsubscriptions?\b/i,
  /\bchannel\b/i,
  /\bvideos?\b/i,
  /\bwatched?\b/i,
];

const GITHUB_RE = [
  /\bgithub\b/i,
  /\bgit\b/i,
  /\brepos?\b/i,
  /\brepositor(y|ies)\b/i,
  /\bcommits?\b/i,
  /\bpull requests?\b/i,
  /\bprs?\b/i,
  /\bpr review\b/i,
  /\bcode review\b/i,
  /\bissues?\b/i,
  /\bbranch(es)?\b/i,
  /\bstars?\b/i,
  /\bpushed?\b/i,
  /\blanguage(s)? i use\b/i,
  /\bcontributions?\b/i,
  /\bwhat am i working on\b/i,
  /\bworking on\b/i,
  /\bship(ped|ping)?\b/i,
];

const REMINDER_RE = [
  /\breminders?\b/i,
  /\btodos?\b/i,
  /\bto-?dos?\b/i,
  /\btasks?\b/i,
  /\bwhat (do|did) i need to do\b/i,
  /\bwhat'?s on my plate\b/i,
];

const STICKER_RE = [
  /\bsticky notes?\b/i,
  /\bstickers?\b/i,
  /\bnotes? on my network\b/i,
  /\bnotes on the canvas\b/i,
];

const SETTINGS_RE = [
  /\bset(ting|tings)?\b/i,
  /\bchange the (color|colour|theme|accent|grid|background)\b/i,
  /\baccent\b/i,
  /\bcolou?r\b/i,
  /\btheme\b/i,
  /\bgrid\b/i,
  /\bmake it (red|blue|cyan|green|violet|amber|purple|orange)\b/i,
  /\bswitch to (dashboard|node) (mode|view)\b/i,
  /\b(collapse|expand) the sidebar\b/i,
  /\bminimalist|minimal nodes\b/i,
  /\b(show|hide) the minimap\b/i,
  /\banimate(d)? edges\b/i,
];

export type Intents = {
  email: boolean;
  spotify: boolean;
  youtube: boolean;
  github: boolean;
  reminder: boolean;
  sticker: boolean;
  settings: boolean;
};

function any(res: RegExp[], s: string): boolean {
  return res.some((r) => r.test(s));
}

export function detectIntents(message: string): Intents {
  return {
    email: any(EMAIL_RE, message),
    spotify: any(SPOTIFY_RE, message),
    youtube: any(YOUTUBE_RE, message),
    github: any(GITHUB_RE, message),
    reminder: any(REMINDER_RE, message),
    sticker: any(STICKER_RE, message),
    settings: any(SETTINGS_RE, message),
  };
}

// Kept for back-compat with anything still importing it. New code should
// call detectIntents() and read the `.email` field.
export function isEmailIntent(message: string): boolean {
  return any(EMAIL_RE, message);
}
