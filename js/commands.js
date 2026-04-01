// ============================================================
// Commands — each handler: ({ args, flags, stdin, term, history }) => string|null
// ============================================================
import { PORTFOLIO_CONFIG, START_TIME } from "./filesystem.js";
import { stripHtml } from "./parser.js";

// Module-level fs reference — set by terminal before first use
let fs;
export function setFS(filesystem) { fs = filesystem; }

// ── Utility helpers ──────────────────────────────────────────

export function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function span(cls, text)  { return `<span class="${cls}">${esc(text)}</span>`; }
function err(msg)         { return `<span class="error">${esc(msg)}</span>`; }

function lsColor(name, node) {
  if (node.type === "dir")     return `<span class="ls-dir">${esc(name)}</span>`;
  if (node.type === "symlink") return `<span class="ls-sym">${esc(name)}</span>`;
  if (fs.isExecutable(node))   return `<span class="ls-exec">${esc(name)}</span>`;
  return `<span class="ls-file">${esc(name)}</span>`;
}

function fmtSize(n) {
  if (n < 1024)           return n + "B";
  if (n < 1024 * 1024)    return (n / 1024).toFixed(1) + "K";
  return (n / 1024 / 1024).toFixed(1) + "M";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fakeTs() {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function nodeSize(node) {
  if (node.type !== "file") return 4096;
  const c = node.content;
  if (typeof c === "function") return 512;
  return String(c ?? "").length;
}

// Filter flag-style tokens from args to get plain arguments
function plainArgs(args) {
  return args.filter(a => !a.startsWith("-"));
}

// ── COMMANDS ─────────────────────────────────────────────────

export const COMMANDS = {

  // ── File / directory ──────────────────────────────────────

  ls({ args, flags }) {
    const showHidden = flags.has("a") || flags.has("A");
    const longFmt    = flags.has("l");
    const pathArg    = plainArgs(args)[0] ?? fs.cwd;
    const node       = fs.getNode(pathArg);

    if (!node) return err(`ls: cannot access '${pathArg}': No such file or directory`);

    if (node.type === "file") return lsColor(fs.getName(pathArg), node);

    let entries = Object.entries(node.children ?? {});
    if (!showHidden) entries = entries.filter(([n]) => !n.startsWith("."));

    entries.sort(([a, na], [b, nb]) => {
      const ad = na.type === "dir" ? 0 : 1;
      const bd = nb.type === "dir" ? 0 : 1;
      return ad !== bd ? ad - bd : a.localeCompare(b);
    });

    if (longFmt) {
      const lines = [span("c-comment", `total ${entries.length}`)];
      for (const [name, child] of entries) {
        const perms = child.permissions ?? (child.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--");
        const sz    = String(nodeSize(child)).padStart(7);
        const sym   = child.type === "symlink" ? ` -> ${esc(child.target)}` : "";
        lines.push(`${esc(perms)} 1 guest guest ${sz} ${fakeTs()} ${lsColor(name, child)}${sym}`);
      }
      return lines.join("\n");
    }

    return entries.map(([name, child]) => lsColor(name, child)).join("  ");
  },

  cd({ args }) {
    const target = plainArgs(args)[0] ?? "~";
    const res = fs.cd(target);
    if (res.error) return err(res.error);
    if (target === "-") return esc(fs.cwd);
    return "";
  },

  pwd() { return esc(fs.cwd); },

  cat({ args, stdin }) {
    const fileArgs = plainArgs(args);
    if (stdin !== null && fileArgs.length === 0) return esc(stripHtml(stdin));

    if (!fileArgs.length) return err("cat: missing operand");

    return fileArgs.map(arg => {
      const node = fs.getNode(arg);
      if (!node)               return err(`cat: ${arg}: No such file or directory`);
      if (node.type === "dir") return err(`cat: ${arg}: Is a directory`);
      return esc(fs.getContent(node) ?? "");
    }).join("\n");
  },

  tree({ args }) {
    const pathArg = plainArgs(args)[0] ?? fs.cwd;
    const node    = fs.getNode(pathArg);
    if (!node)               return err(`tree: ${pathArg}: No such file or directory`);
    if (node.type !== "dir") return err(`tree: ${pathArg}: Not a directory`);

    const lines = [`<span class="ls-dir">${esc(fs.displayPath())}</span>`];
    let files = 0, dirs = 0;

    function walk(dir, prefix) {
      const entries = Object.entries(dir.children ?? {})
        .filter(([n]) => !n.startsWith("."))
        .sort(([a, na], [b, nb]) => {
          if (na.type === "dir" && nb.type !== "dir") return -1;
          if (na.type !== "dir" && nb.type === "dir") return  1;
          return a.localeCompare(b);
        });

      entries.forEach(([name, child], i) => {
        const last = i === entries.length - 1;
        lines.push(prefix + (last ? "└── " : "├── ") + lsColor(name, child));
        if (child.type === "dir") { dirs++;  walk(child, prefix + (last ? "    " : "│   ")); }
        else                      { files++; }
      });
    }

    walk(node, "");
    lines.push(`\n${dirs} director${dirs === 1 ? "y" : "ies"}, ${files} file${files === 1 ? "" : "s"}`);
    return lines.join("\n");
  },

  find({ args }) {
    const nameIdx   = args.indexOf("-name");
    const pattern   = nameIdx >= 0 ? args[nameIdx + 1] : null;
    const nonFlags  = plainArgs(args).filter(a => a !== pattern);
    const searchArg = nonFlags[0] ?? ".";
    const startPath = fs.resolve(searchArg);
    const startNode = fs.getNode(startPath);

    if (!startNode) return err(`find: '${searchArg}': No such file or directory`);

    const regex = pattern
      ? new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i")
      : null;

    const results = [];

    function walk(node, path) {
      if (!regex || regex.test(path.split("/").pop())) results.push(esc(path));
      if (node.type === "dir") {
        for (const [name, child] of Object.entries(node.children ?? {})) {
          walk(child, path === "/" ? "/" + name : path + "/" + name);
        }
      }
    }

    walk(startNode, startPath);
    return results.join("\n") || "(no matches)";
  },

  file({ args }) {
    const arg  = plainArgs(args)[0];
    if (!arg)  return err("file: missing operand");
    const node = fs.getNode(arg);
    if (!node) return err(`file: ${arg}: No such file or directory`);
    if (node.type === "dir")     return `${esc(arg)}: directory`;
    if (node.type === "symlink") return `${esc(arg)}: symbolic link to ${esc(node.target)}`;
    if (arg.endsWith(".sh"))   return `${esc(arg)}: Bourne-Again shell script, ASCII text executable`;
    if (arg.endsWith(".json")) return `${esc(arg)}: JSON data`;
    if (arg.endsWith(".md"))   return `${esc(arg)}: Markdown document, ASCII text`;
    return `${esc(arg)}: ASCII text`;
  },

  stat({ args }) {
    const arg  = plainArgs(args)[0];
    if (!arg)  return err("stat: missing operand");
    const norm = fs.resolve(arg);
    const node = fs.getNode(norm);
    if (!node) return err(`stat: cannot stat '${arg}': No such file or directory`);

    const perms  = node.permissions ?? "-rw-r--r--";
    const sz     = nodeSize(node);
    const now    = new Date().toISOString().replace("T", " ").slice(0, 19);
    const inode  = Math.floor(Math.random() * 900000 + 100000);
    const kind   = node.type === "dir" ? "directory" : "regular file";

    return `  File: ${esc(norm)}
  Size: ${sz}\t\tBlocks: ${Math.ceil(sz / 512) * 8}\t IO Block: 4096   ${kind}
Device: fd00h\tInode: ${inode}\tLinks: 1
Access: (${perms})  Uid: (1000/guest)   Gid: (1000/guest)
Access: ${now}
Modify: ${now}
Change: ${now}`;
  },

  head({ args, stdin }) {
    const nIdx = args.indexOf("-n");
    const n    = nIdx >= 0 ? (parseInt(args[nIdx + 1]) || 10) : 10;
    let text;
    if (stdin !== null) {
      text = stripHtml(stdin);
    } else {
      const p = plainArgs(args).find(a => !/^\d+$/.test(a));
      if (!p) return err("head: missing operand");
      const node = fs.getNode(p);
      if (!node)               return err(`head: cannot open '${p}': No such file or directory`);
      if (node.type === "dir") return err(`head: error reading '${p}': Is a directory`);
      text = fs.getContent(node) ?? "";
    }
    return esc(text.split("\n").slice(0, n).join("\n"));
  },

  tail({ args, stdin }) {
    const nIdx = args.indexOf("-n");
    const n    = nIdx >= 0 ? (parseInt(args[nIdx + 1]) || 10) : 10;
    let text;
    if (stdin !== null) {
      text = stripHtml(stdin);
    } else {
      const p = plainArgs(args).find(a => !/^\d+$/.test(a));
      if (!p) return err("tail: missing operand");
      const node = fs.getNode(p);
      if (!node)               return err(`tail: cannot open '${p}': No such file or directory`);
      if (node.type === "dir") return err(`tail: error reading '${p}': Is a directory`);
      text = fs.getContent(node) ?? "";
    }
    return esc(text.split("\n").slice(-n).join("\n"));
  },

  wc({ args, flags, stdin }) {
    let text;
    if (stdin !== null) {
      text = stripHtml(stdin);
    } else {
      const p = plainArgs(args)[0];
      if (!p) return err("wc: missing operand");
      const node = fs.getNode(p);
      if (!node) return err(`wc: ${p}: No such file or directory`);
      text = fs.getContent(node) ?? "";
    }
    const lines = text.split("\n").length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;

    if (flags.has("l")) return String(lines);
    if (flags.has("w")) return String(words);
    if (flags.has("c")) return String(chars);
    return `${String(lines).padStart(7)} ${String(words).padStart(7)} ${String(chars).padStart(7)}`;
  },

  touch({ args }) {
    const p = plainArgs(args)[0];
    if (!p) return err("touch: missing file operand");
    if (!fs.resolve(p).startsWith("/tmp/")) return err("touch: Permission denied (only /tmp/ is writable)");
    const r = fs.createFile(fs.resolve(p), "");
    return r.error ? err(r.error) : "";
  },

  mkdir({ args }) {
    const p = plainArgs(args)[0];
    if (!p) return err("mkdir: missing operand");
    const norm = fs.resolve(p);
    if (!norm.startsWith("/tmp/")) return err("mkdir: Permission denied (only /tmp/ is writable)");
    const parentPath = norm.split("/").slice(0, -1).join("/") || "/";
    const parent = fs.getNode(parentPath);
    if (!parent || parent.type !== "dir") return err(`mkdir: cannot create directory '${p}': No such directory`);
    const name = norm.split("/").pop();
    if (parent.children[name]) return err(`mkdir: cannot create directory '${p}': File exists`);
    parent.children[name] = { type: "dir", permissions: "drwxr-xr-x", children: {} };
    return "";
  },

  // ── Text processing ───────────────────────────────────────

  grep({ args, flags, stdin }) {
    const caseI   = flags.has("i");
    const showLN  = flags.has("n");
    const count   = flags.has("c");
    const pArgs   = plainArgs(args);
    const pattern = pArgs[0];
    if (!pattern) return err("grep: missing pattern");

    let text;
    if (stdin !== null) {
      text = stripHtml(stdin);
    } else {
      const p = pArgs[1];
      if (!p) return err("grep: missing file operand");
      const node = fs.getNode(p);
      if (!node)               return err(`grep: ${p}: No such file or directory`);
      if (node.type === "dir") return err(`grep: ${p}: Is a directory`);
      text = fs.getContent(node) ?? "";
    }

    let regex;
    try { regex = new RegExp(pattern, caseI ? "i" : ""); }
    catch { return err(`grep: invalid regular expression: ${pattern}`); }

    const lines = text.split("\n");
    let matchCount = 0;
    const results = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        matchCount++;
        if (!count) {
          const highlighted = highlightGrep(line, pattern, caseI);
          const prefix = showLN ? `<span class="c-green">${i + 1}</span>:` : "";
          results.push(prefix + highlighted);
        }
      }
    }

    return count ? String(matchCount) : (results.join("\n") || "");
  },

  echo({ args, flags }) {
    const ENV = {
      PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      HOME: "/home/guest",
      USER: "guest",
      SHELL: "/bin/bash",
      TERM: "xterm-256color",
      LANG: "en_US.UTF-8",
      PWD: fs.cwd,
      OLDPWD: fs.prevDir,
      HOSTNAME: "portfolio",
      EDITOR: "vim",
    };
    const words = plainArgs(args);
    const text  = words.join(" ").replace(/\$(\w+)/g, (_, k) => ENV[k] ?? "");
    return esc(text);
  },

  sort({ args, flags, stdin }) {
    let text;
    if (stdin !== null) {
      text = stripHtml(stdin);
    } else {
      const p = plainArgs(args)[0];
      if (!p) return err("sort: missing operand");
      const node = fs.getNode(p);
      if (!node) return err(`sort: ${p}: No such file or directory`);
      text = fs.getContent(node) ?? "";
    }
    const rev   = flags.has("r");
    const lines = text.split("\n").filter(l => l);
    lines.sort((a, b) => rev ? b.localeCompare(a) : a.localeCompare(b));
    return esc(lines.join("\n"));
  },

  uniq({ args, stdin }) {
    let text;
    if (stdin !== null) {
      text = stripHtml(stdin);
    } else {
      const p = plainArgs(args)[0];
      if (!p) return err("uniq: missing operand");
      const node = fs.getNode(p);
      if (!node) return err(`uniq: ${p}: No such file or directory`);
      text = fs.getContent(node) ?? "";
    }
    const lines = text.split("\n");
    return esc(lines.filter((l, i) => i === 0 || l !== lines[i - 1]).join("\n"));
  },

  rev({ args, stdin }) {
    let text;
    if (stdin !== null) {
      text = stripHtml(stdin);
    } else {
      const p = plainArgs(args)[0];
      if (!p) return "";
      const node = fs.getNode(p);
      if (!node) return err(`rev: ${p}: No such file or directory`);
      text = fs.getContent(node) ?? "";
    }
    return esc(text.split("\n").map(l => [...l].reverse().join("")).join("\n"));
  },

  // ── System info ───────────────────────────────────────────

  whoami()   { return "guest"; },
  hostname() { return "portfolio"; },

  uname({ args, flags }) {
    const all = flags.has("a") || args.includes("-a");
    if (all) return "Linux portfolio 6.5.0-portfolio #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux";
    if (flags.has("r")) return "6.5.0-portfolio";
    if (flags.has("n")) return "portfolio";
    if (flags.has("m")) return "x86_64";
    return "Linux";
  },

  date() { return esc(new Date().toString()); },

  uptime() {
    const secs  = Math.floor((Date.now() - START_TIME) / 1000);
    const days  = Math.floor(secs / 86400);
    const hrs   = Math.floor((secs % 86400) / 3600);
    const mins  = Math.floor((secs % 3600)  / 60);
    const s     = secs % 60;
    const now   = new Date().toTimeString().slice(0, 8);
    let ut = "";
    if (days) ut += `${days} day${days > 1 ? "s" : ""}, `;
    ut += `${String(hrs).padStart(2,"0")}:${String(mins).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    const la = `0.${Math.floor(Math.random()*30).toString().padStart(2,"0")}`;
    return ` ${now} up ${ut},  1 user,  load average: ${la}, 0.${Math.floor(Math.random()*20)}, 0.${Math.floor(Math.random()*10)}`;
  },

  env() {
    const vars = {
      USER: "guest", LOGNAME: "guest", HOME: "/home/guest",
      SHELL: "/bin/bash", TERM: "xterm-256color", LANG: "en_US.UTF-8",
      PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      PWD: fs.cwd, OLDPWD: fs.prevDir, HOSTNAME: "portfolio",
      EDITOR: "vim", PAGER: "less", COLORTERM: "truecolor",
    };
    return esc(Object.entries(vars).map(([k, v]) => `${k}=${v}`).join("\n"));
  },

  id() {
    return "uid=1000(guest) gid=1000(guest) groups=1000(guest),4(adm),24(cdrom),27(sudo)";
  },

  // ── Navigation / meta ─────────────────────────────────────

  help() {
    return `<span class="c-blue c-bold">Available Commands</span>
<span class="c-comment">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</span>

<span class="c-yellow c-bold">File Operations</span>
  <span class="c-green">ls</span>     [-la]            List directory contents
  <span class="c-green">cd</span>     [dir]            Change directory  (supports ~, -, ..)
  <span class="c-green">cat</span>    [file ...]       Print file contents
  <span class="c-green">pwd</span>                     Print working directory
  <span class="c-green">tree</span>   [dir]            Recursive directory listing
  <span class="c-green">find</span>   [path] -name pat  Search for files by name pattern
  <span class="c-green">file</span>   [file]           Show file type
  <span class="c-green">stat</span>   [file]           Show file metadata
  <span class="c-green">head</span>   [-n N] [file]    First N lines (default 10)
  <span class="c-green">tail</span>   [-n N] [file]    Last N lines (default 10)
  <span class="c-green">wc</span>     [-lwc] [file]    Word/line/char count
  <span class="c-green">touch</span>  [file]           Create empty file (in /tmp only)
  <span class="c-green">mkdir</span>  [dir]            Create directory (in /tmp only)

<span class="c-yellow c-bold">Text Processing</span>
  <span class="c-green">grep</span>   [-inc] pat [file] Filter lines matching regex
  <span class="c-green">echo</span>   [text]           Print text  (\$VAR expansion supported)
  <span class="c-green">sort</span>   [-r] [file]      Sort lines alphabetically
  <span class="c-green">uniq</span>   [file]           Remove adjacent duplicate lines
  <span class="c-green">rev</span>    [file]           Reverse each line

<span class="c-yellow c-bold">System Info</span>
  <span class="c-green">whoami</span>                  Current user
  <span class="c-green">hostname</span>                System hostname
  <span class="c-green">uname</span>  [-a]             System information
  <span class="c-green">date</span>                    Current date and time
  <span class="c-green">uptime</span>                  Uptime since page load
  <span class="c-green">env</span>                     Environment variables
  <span class="c-green">id</span>                      User/group identity
  <span class="c-green">neofetch</span>                Fancy system info

<span class="c-yellow c-bold">Shell</span>
  <span class="c-green">help</span>                    Show this help
  <span class="c-green">clear</span>                   Clear the terminal  (also Ctrl+L)
  <span class="c-green">history</span>                 Command history
  <span class="c-green">man</span>    [command]        Manual page
  <span class="c-green">which</span>  [command]        Command location
  <span class="c-green">type</span>   [command]        Command type
  <span class="c-green">exit</span>                    Try to leave

<span class="c-yellow c-bold">Fun</span>
  <span class="c-green">cowsay</span> [msg]            ASCII cow
  <span class="c-green">fortune</span>                 Random programming quote
  <span class="c-green">matrix</span>                  Wake up, Neo
  <span class="c-green">sl</span>                      Choo choo
  <span class="c-green">sudo</span>   [cmd]            Feel powerful
  <span class="c-green">top</span> / <span class="c-green">htop</span>             Process list
  <span class="c-green">ping</span>   [host]           Ping a host
  <span class="c-green">vim</span>                     Good luck

<span class="c-comment">Pipes:    cmd1 | cmd2          Redirect:  cmd > file   cmd >> file</span>
<span class="c-comment">Chain:    cmd1 && cmd2         History:   !!  !N</span>
<span class="c-comment">Ctrl+C:   cancel input         Ctrl+L:    clear         Ctrl+U: erase line</span>`;
  },

  clear() { return "__CLEAR__"; },

  history({ history: hist }) {
    if (!hist?.length) return span("c-comment", "(no history)");
    return hist.map((cmd, i) =>
      `  ${span("c-comment", String(i + 1).padStart(4))}  ${esc(cmd)}`
    ).join("\n");
  },

  man({ args }) {
    const cmd = plainArgs(args)[0];
    if (!cmd) return err("What manual page do you want?");

    const pages = {
      ls:      `<b>LS(1)</b>\n\nNAME\n     ls - list directory contents\nSYNOPSIS\n     ls [-la] [path]\nDESCRIPTION\n     -l  long format with permissions and size\n     -a  show hidden files (dotfiles)`,
      cd:      `<b>CD(1) BUILTIN</b>\n\nNAME\n     cd - change working directory\nSYNOPSIS\n     cd [dir]\nDESCRIPTION\n     ~   home directory\n     -   previous directory\n     ..  parent directory`,
      cat:     `<b>CAT(1)</b>\n\nNAME\n     cat - concatenate and print files\nSYNOPSIS\n     cat [file ...]\nDESCRIPTION\n     Reads files sequentially, writing them to stdout.\n     Reads stdin if no files given.`,
      grep:    `<b>GREP(1)</b>\n\nNAME\n     grep - search for a pattern\nSYNOPSIS\n     grep [-inc] pattern [file]\nFLAGS\n     -i  case insensitive\n     -n  show line numbers\n     -c  count matching lines only`,
      head:    `<b>HEAD(1)</b>\n\nNAME\n     head - first lines of a file\nSYNOPSIS\n     head [-n N] [file]`,
      tail:    `<b>TAIL(1)</b>\n\nNAME\n     tail - last lines of a file\nSYNOPSIS\n     tail [-n N] [file]`,
      find:    `<b>FIND(1)</b>\n\nNAME\n     find - search for files\nSYNOPSIS\n     find [path] -name pattern\nEXAMPLE\n     find . -name "*.md"`,
      tree:    `<b>TREE(1)</b>\n\nNAME\n     tree - list directory contents recursively\nSYNOPSIS\n     tree [directory]`,
      man:     `<b>MAN(1)</b>\n\nNAME\n     man - display manual pages\nSYNOPSIS\n     man [command]\nDESCRIPTION\n     You're using it right now. Meta.`,
      echo:    `<b>ECHO(1)</b>\n\nNAME\n     echo - print text\nSYNOPSIS\n     echo [text ...]\nDESCRIPTION\n     Expands \$VARIABLE references before printing.`,
      grep:    `<b>GREP(1)</b>\n\nNAME\n     grep - filter lines by pattern\nSYNOPSIS\n     grep [-inc] pattern [file]\nFLAGS\n     -i  case insensitive\n     -n  line numbers\n     -c  count only`,
    };

    const page = pages[cmd];
    if (!page) return err(`man: no manual entry for ${cmd}`);
    return `<span class="c-bright">${page}</span>`;
  },

  which({ args }) {
    const cmd = plainArgs(args)[0];
    if (!cmd) return err("which: missing argument");
    if (COMMANDS[cmd] || BUILTIN_NAMES.has(cmd)) return `/usr/bin/${cmd}`;
    return err(`which: ${cmd}: not found`);
  },

  type({ args }) {
    const cmd = plainArgs(args)[0];
    if (!cmd) return err("type: missing argument");
    if (SHELL_BUILTINS.has(cmd)) return `${esc(cmd)} is a shell builtin`;
    if (COMMANDS[cmd])           return `${esc(cmd)} is /usr/bin/${esc(cmd)}`;
    return err(`${cmd}: not found`);
  },

  exit() {
    const msgs = [
      "There is no escape. :)",
      "This is a website. Where would you go?",
      "exit: cannot exit browser tab (permission denied)",
      "Nice try. You're stuck here forever.",
      "logout\n\nThere are stopped jobs.\n(just kidding, stay a while)",
    ];
    return span("c-yellow", msgs[Math.floor(Math.random() * msgs.length)]);
  },

  neofetch() {
    const secs   = Math.floor((Date.now() - START_TIME) / 1000);
    const mins   = Math.floor(secs / 60);
    const upStr  = mins > 0 ? `${mins} min${mins !== 1 ? "s" : ""}` : `${secs} sec${secs !== 1 ? "s" : ""}`;
    const skills = Object.values(PORTFOLIO_CONFIG.skills).reduce((a, b) => a + Object.keys(b).length, 0);
    const cfg    = PORTFOLIO_CONFIG;

    const logo = [
      `<span class="c-blue"> ██████╗  </span>`,
      `<span class="c-blue"> ██╔══██╗ </span>`,
      `<span class="c-blue"> ██████╔╝ </span>`,
      `<span class="c-blue"> ██╔═══╝  </span>`,
      `<span class="c-blue"> ██║      </span>`,
      `<span class="c-blue"> ╚═╝      </span>`,
      ``,
      `<span class="c-blue c-bold">portfolio</span>`,
    ];

    const info = [
      `<span class="c-green c-bold">${esc(cfg.name)}</span><span class="c-comment">@</span><span class="c-blue c-bold">portfolio</span>`,
      `<span class="c-comment">─────────────────────────────</span>`,
      `<span class="c-blue c-bold">OS:      </span> Portfolio OS 2.0.0`,
      `<span class="c-blue c-bold">Shell:   </span> bash 5.2.21`,
      `<span class="c-blue c-bold">Terminal:</span> portfolio-term 1.0`,
      `<span class="c-blue c-bold">Uptime:  </span> ${esc(upStr)}`,
      `<span class="c-blue c-bold">Role:    </span> ${esc(cfg.title)}`,
      `<span class="c-blue c-bold">Location:</span> ${esc(cfg.location)}`,
      `<span class="c-blue c-bold">Skills:  </span> ${skills} packages installed`,
      `<span class="c-blue c-bold">GitHub:  </span> ${esc(cfg.github)}`,
      ``,
      `<span style="background:#f7768e">   </span><span style="background:#ff9e64">   </span><span style="background:#e0af68">   </span><span style="background:#9ece6a">   </span><span style="background:#7dcfff">   </span><span style="background:#7aa2f7">   </span><span style="background:#bb9af7">   </span><span style="background:#c0caf5">   </span>`,
    ];

    const rows = Math.max(logo.length, info.length);
    const lines = [];
    for (let i = 0; i < rows; i++) {
      lines.push(`${logo[i] ?? "          "}  ${info[i] ?? ""}`);
    }
    return lines.join("\n");
  },

  bash({ args }) {
    const p = plainArgs(args)[0];
    if (!p) return err("bash: missing script path");
    const node = fs.getNode(p);
    if (!node)               return err(`bash: ${p}: No such file or directory`);
    if (node.type === "dir") return err(`bash: ${p}: Is a directory`);
    return esc(fs.getContent(node) ?? "");
  },
};

// ── Internal sets used by which/type ────────────────────────
const SHELL_BUILTINS = new Set(["cd","echo","pwd","help","clear","history","exit","type","source","."]);
const BUILTIN_NAMES  = new Set(Object.keys(COMMANDS));

// ── grep highlight helper ────────────────────────────────────
function highlightGrep(line, pattern, caseI) {
  try {
    const splitRe = new RegExp(`(${pattern})`, caseI ? "gi" : "g");
    return line.split(splitRe).map((part, i) =>
      i % 2 === 1
        ? `<span class="grep-match">${esc(part)}</span>`
        : esc(part)
    ).join("");
  } catch {
    return esc(line);
  }
}
