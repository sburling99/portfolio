// ============================================================
// Parser — tokenizer, pipe/redirect/chain splitting
// ============================================================

export function tokenize(raw) {
  const tokens = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (!inSingle && !inDouble && (ch === " " || ch === "\t")) {
      if (cur) { tokens.push(cur); cur = ""; }
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function parseSegment(tokens) {
  const command = tokens[0] ?? "";
  const args    = [];
  const flags   = new Set();
  let redirect     = null;
  let redirectMode = null;

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === ">" || tok === ">>") {
      redirectMode = tok;
      redirect     = tokens[++i] ?? null;
      continue;
    }
    // Short flags: -la → {l,a}, long flags: --foo → {foo}
    if (tok.startsWith("--") && tok.length > 2) {
      flags.add(tok.slice(2));
      args.push(tok);
    } else if (tok.startsWith("-") && tok.length > 1 && !/^-\d+$/.test(tok)) {
      for (const c of tok.slice(1)) flags.add(c);
      args.push(tok);
    } else {
      args.push(tok);
    }
  }

  return { command, args, flags, redirect, redirectMode };
}

// Split input on && and ; (respecting quotes)
function splitChains(input) {
  const result = [];
  let cur = "";
  let inS = false, inD = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'" && !inD) { inS = !inS; cur += ch; continue; }
    if (ch === '"' && !inS) { inD = !inD; cur += ch; continue; }
    if (!inS && !inD) {
      if (ch === "&" && input[i + 1] === "&") {
        result.push({ cmd: cur.trim(), op: "&&" });
        cur = ""; i++; continue;
      }
      if (ch === ";") {
        result.push({ cmd: cur.trim(), op: ";" });
        cur = ""; continue;
      }
    }
    cur += ch;
  }
  if (cur.trim()) result.push({ cmd: cur.trim(), op: null });
  return result;
}

// Split on pipes (respecting quotes)
function splitPipes(input) {
  const segs = [];
  let cur = "";
  let inS = false, inD = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'" && !inD) { inS = !inS; cur += ch; continue; }
    if (ch === '"' && !inS) { inD = !inD; cur += ch; continue; }
    if (ch === "|" && !inS && !inD) { segs.push(cur); cur = ""; continue; }
    cur += ch;
  }
  segs.push(cur);
  return segs;
}

// Returns: Array<{ segments: ParsedSegment[], chainOp: string|null }>
export function parse(input) {
  const chains = splitChains(input);
  return chains.map(({ cmd, op }) => ({
    segments: splitPipes(cmd).map(seg => parseSegment(tokenize(seg.trim()))),
    chainOp: op,
  }));
}

// Strip HTML tags and unescape HTML entities — used when passing output between pipes
export function stripHtml(str) {
  return String(str ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, " ");
}
