// ============================================================
// Easter Eggs — fun commands
// ============================================================
import { esc } from "./commands.js";
import { PORTFOLIO_CONFIG, START_TIME } from "./filesystem.js";

function span(cls, text) { return `<span class="${cls}">${esc(text)}</span>`; }

// ── FORTUNES ─────────────────────────────────────────────────

const FORTUNES = [
  "There are only two hard things in CS: cache invalidation, naming things, and off-by-one errors.",
  "It works on my machine. — Every developer ever",
  "\"Any sufficiently advanced technology is indistinguishable from magic.\" — Arthur C. Clarke",
  "\"First, solve the problem. Then, write the code.\" — John Johnson",
  "\"The best error message is the one that never shows up.\" — Thomas Fuchs",
  "\"Weeks of coding can save you hours of planning.\"",
  "\"It's not a bug, it's a feature.\" — Anonymous",
  "\"Programming is the art of telling another human what one wants the computer to do.\" — Donald Knuth",
  "\"Talk is cheap. Show me the code.\" — Linus Torvalds",
  "\"The only way to learn a new programming language is by writing programs in it.\" — Dennis Ritchie",
  "\"Deleted code is debugged code.\" — Jeff Sickel",
  "\"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.\" — Antoine de Saint-Exupéry",
  "\"Code is like humor. When you have to explain it, it's bad.\" — Cory House",
  "\"Before software can be reusable it first has to be usable.\" — Ralph Johnson",
  "\"In theory, theory and practice are the same. In practice, they're not.\"",
  "\"There is no Ctrl-Z in life.\"",
  "\"A SQL query walks into a bar, walks up to two tables and asks... Can I join you?\"",
  "\"Why do Java developers wear glasses? Because they can't C#.\"",
  "\"!false — it's funny because it's true.\"",
];

// ── COWSAY ───────────────────────────────────────────────────

function cowsay(msg) {
  const text = msg || "moo";
  const len = text.length;
  const top    = " " + "_".repeat(len + 2);
  const bottom = " " + "-".repeat(len + 2);
  const cow = `        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||`;
  return `${top}\n< ${esc(text)} >\n${bottom}\n${cow}`;
}

// ── TRAIN (sl) ───────────────────────────────────────────────

const TRAIN_FRAMES = [
  `      ====        ________                ___________
  _D _|  |_______/        \\__I_I_____===__|_________|
   |(_)---  |   H\\________/ |   |        =|___ ___|
   /     |  |   H  |  |     |   |         ||_| |_||
  |      |  |   H  |__--------------------| [___] |
  | ________|___H__/__|_____/[][]~\\_______|       |
  |/ |   |-----------I_____I [][] []  D   |=======|_
__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__
 |/-=|___|=    ||    ||    ||    |_____/~\\___/
  \\_/      \\O=====O=====O=====O_/      \\_/`,
];

// ── FAKE PROCESS LIST (top/htop) ─────────────────────────────

function fakeTop() {
  const secs = Math.floor((Date.now() - START_TIME) / 1000);
  const procs = [
    { pid: 1,    user: "root",  cpu: "0.0", mem: "0.1", cmd: "systemd" },
    { pid: 42,   user: "guest", cpu: "2.3", mem: "1.2", cmd: "portfolio-server" },
    { pid: 80,   user: "guest", cpu: "0.5", mem: "0.4", cmd: "bash" },
    { pid: 256,  user: "guest", cpu: "15.7", mem: "3.8", cmd: "node --max-old-space-size=imagination" },
    { pid: 404,  user: "guest", cpu: "0.0", mem: "0.0", cmd: "motivation (not found)" },
    { pid: 420,  user: "root",  cpu: "0.1", mem: "0.2", cmd: "systemd-logind" },
    { pid: 666,  user: "guest", cpu: "6.6", mem: "6.6", cmd: "debugging-production" },
    { pid: 1024, user: "guest", cpu: "0.3", mem: "0.5", cmd: "caffeine-daemon" },
    { pid: 1337, user: "guest", cpu: "0.0", mem: "0.1", cmd: "sshd: guest [priv]" },
    { pid: 1984, user: "guest", cpu: "8.1", mem: "2.1", cmd: "chrome --type=renderer" },
    { pid: 2048, user: "guest", cpu: "4.2", mem: "12.5", cmd: "vscode --extensions-dir=~/.vscode" },
    { pid: 3000, user: "guest", cpu: "1.0", mem: "0.8", cmd: "webpack --watch --mode=desperation" },
    { pid: 8080, user: "guest", cpu: "0.2", mem: "0.3", cmd: "imposter-syndrome" },
    { pid: 9999, user: "guest", cpu: "99.9", mem: "0.1", cmd: "infinite-loop (just kidding)" },
  ];
  const header = `<span class="top-header"> PID  USER        %CPU  %MEM  COMMAND</span>`;
  const upStr = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  const summary = `<span class="c-bright">top - uptime ${upStr}, 1 user, load average: 0.42, 0.15, 0.08</span>
<span class="c-comment">Tasks: ${procs.length} total, 1 running, ${procs.length - 1} sleeping</span>
<span class="c-comment">%Cpu(s):  4.2 us, 1.0 sy, 0.0 ni, 94.8 id</span>
<span class="c-comment">MiB Mem:  16384.0 total, 12288.0 free, 2048.0 used, 2048.0 buff/cache</span>
`;
  const rows = procs.map(p => {
    return `${String(p.pid).padStart(5)}  ${p.user.padEnd(10)}  ${p.cpu.padStart(4)}  ${p.mem.padStart(4)}  ${esc(p.cmd)}`;
  }).join("\n");
  return `${summary}\n${header}\n${rows}\n\n<span class="c-comment">Press q to quit (just kidding, this isn't interactive)</span>`;
}

// ── RM -RF / DRAMATIC SEQUENCE ───────────────────────────────

function rmRfSlash() {
  const dirs = [
    "/usr", "/var", "/home", "/etc", "/opt", "/boot",
    "/lib", "/bin", "/sbin", "/tmp", "/dev", "/proc",
    "/root", "/srv", "/mnt",
  ];
  const lines = [
    `<span class="c-red c-bold">rm: WARNING: proceeding with recursive removal of '/'</span>`,
    "",
  ];
  for (const d of dirs) {
    lines.push(`<span class="c-red">rm: removing '${d}'...</span>`);
  }
  lines.push("");
  lines.push(`<span class="c-red c-bold">rm: cannot remove '/': the website is still here</span>`);
  lines.push("");
  lines.push(`<span class="c-yellow">Just kidding. Nice try though. 😏</span>`);
  return lines.join("\n");
}

// ── PING ─────────────────────────────────────────────────────

function fakePing(host) {
  const target = host || "localhost";
  const lines = [`<span class="c-bright">PING ${esc(target)} (127.0.0.1) 56(84) bytes of data.</span>`];
  for (let i = 0; i < 5; i++) {
    const ms = (Math.random() * 2 + 0.1).toFixed(3);
    lines.push(`64 bytes from 127.0.0.1: icmp_seq=${i + 1} ttl=64 time=${ms} ms`);
  }
  lines.push("");
  lines.push(`<span class="c-bright">--- ${esc(target)} ping statistics ---</span>`);
  lines.push("5 packets transmitted, 5 received, 0% packet loss");
  lines.push(`rtt min/avg/max/mdev = 0.102/0.423/0.891/0.245 ms`);
  return lines.join("\n");
}

// ── MATRIX ───────────────────────────────────────────────────

function matrixEffect(term) {
  const canvas = document.createElement("canvas");
  canvas.id = "matrix-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const fontSize = 14;
  const cols = Math.floor(canvas.width / fontSize);
  const drops = new Array(cols).fill(1);
  const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  function draw() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#9ece6a";
    ctx.font = `${fontSize}px monospace`;

    for (let i = 0; i < drops.length; i++) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  const interval = setInterval(draw, 40);

  setTimeout(() => {
    clearInterval(interval);
    canvas.remove();
  }, 5000);

  return `<span class="c-green">Wake up, Neo...</span>\n<span class="c-comment">(Matrix effect for 5 seconds)</span>`;
}

// ── SL TRAIN ANIMATION ──────────────────────────────────────

function slAnimation(term) {
  const outputEl = document.getElementById("output");
  const trackDiv = document.createElement("div");
  trackDiv.className = "sl-track";
  const inner = document.createElement("div");
  inner.className = "sl-inner";
  inner.textContent = TRAIN_FRAMES[0];
  trackDiv.appendChild(inner);
  outputEl.appendChild(trackDiv);

  const width = trackDiv.offsetWidth;
  const trainWidth = inner.offsetWidth;
  let pos = width;

  const interval = setInterval(() => {
    pos -= 6;
    inner.style.left = pos + "px";
    if (pos < -trainWidth) {
      clearInterval(interval);
      trackDiv.remove();
    }
  }, 30);

  return null; // Don't print anything extra
}

// ── EASTER EGG COMMANDS ──────────────────────────────────────

export const EASTER_EGG_COMMANDS = {

  sudo({ args }) {
    return `<span class="c-red c-bold">guest is not in the sudoers file. This incident will be reported.</span>\n<span class="c-comment">(just kidding, this is a portfolio website)</span>`;
  },

  rm({ args, flags }) {
    const joined = args.join(" ");
    if ((flags.has("r") && flags.has("f") && joined.includes("/")) ||
        joined.includes("-rf /") || joined.includes("-rf/")) {
      return rmRfSlash();
    }
    return `<span class="c-red">rm: cannot remove: Permission denied</span>`;
  },

  vim() {
    return `<span class="c-yellow">You've opened vim. To exit, close your browser tab.</span>\n\n<span class="c-comment">(just kidding, press i to insert your dignity back)</span>`;
  },

  nano() {
    return `<span class="c-yellow">nano: terminal too fancy for nano. Try vim.</span>\n<span class="c-comment">(just kidding, neither works here)</span>`;
  },

  emacs() {
    return `<span class="c-yellow">emacs: great OS, just needs a good text editor.</span>`;
  },

  sl({ term }) {
    return slAnimation(term);
  },

  cowsay({ args }) {
    const msg = args.filter(a => !a.startsWith("-")).join(" ");
    return cowsay(msg);
  },

  matrix({ term }) {
    return matrixEffect(term);
  },

  fortune() {
    return `<span class="c-yellow">${esc(FORTUNES[Math.floor(Math.random() * FORTUNES.length)])}</span>`;
  },

  curl({ args }) {
    const msgs = [
      "In this economy? Use wget like a normal person.",
      "curl: (6) Could not resolve host. This is a browser, not a shell.",
      "curl: connection refused. Try curl-ing up with a good book instead.",
    ];
    return `<span class="c-yellow">${msgs[Math.floor(Math.random() * msgs.length)]}</span>`;
  },

  wget() {
    return `<span class="c-yellow">Nice try, but there's no internet in here.</span>`;
  },

  apt({ args }) {
    return `<span class="c-red">E: Package manager not found. Try getting some real skills instead.</span>\n<span class="c-comment">Just kidding. Check out: bash skills.sh</span>`;
  },

  brew({ args }) {
    return `<span class="c-red">Error: Homebrew is not installed in this terminal dimension.</span>\n<span class="c-comment">Just kidding. Check out: bash skills.sh</span>`;
  },

  pip({ args }) {
    return `<span class="c-red">pip: command not found in portfolio-verse.</span>\n<span class="c-comment">Try: bash skills.sh</span>`;
  },

  chmod({ args, flags }) {
    const joined = args.join(" ");
    if (joined.includes("777")) {
      return `<span class="c-yellow c-bold">Whoa there, cowboy. 🤠</span>`;
    }
    return `<span class="c-red">chmod: Permission denied (readonly filesystem)</span>`;
  },

  chown() {
    return `<span class="c-red">chown: Permission denied. You don't own anything here.</span>`;
  },

  alias() {
    return `<span class="c-yellow">You can't customize a website terminal. Or can you?</span>`;
  },

  top() { return fakeTop(); },
  htop() { return fakeTop(); },

  ping({ args }) {
    const host = args.filter(a => !a.startsWith("-"))[0];
    return fakePing(host);
  },

  ssh({ args }) {
    return `<span class="c-yellow">SSH server coming soon. In the meantime, you're already here.</span>`;
  },

  exit() {
    const msgs = [
      "There is no escape. :)",
      "This is a website. Where would you go?",
      "exit: cannot exit browser tab (permission denied)",
      "Nice try. You're stuck here forever.",
      "logout\n\nThere are stopped jobs.\n(just kidding, stay a while)",
    ];
    return `<span class="c-yellow">${msgs[Math.floor(Math.random() * msgs.length)]}</span>`;
  },

  poweroff() {
    return `<span class="c-red">poweroff: Permission denied. Also, this is a website.</span>`;
  },

  reboot() {
    return `<span class="c-yellow">Rebooting...</span>\n<span class="c-comment">Just kidding. Refresh the page if you really want.</span>`;
  },

  python() {
    return `<span class="c-yellow">Python 3.12.0 (just kidding)\n>>> import antigravity\n>>> # That only works in real Python :)</span>`;
  },

  node() {
    return `<span class="c-green">Welcome to Node.js v21.0.0.\nType ".help" for more information.\n> console.log("This is a website, not Node")\nThis is a website, not Node\nundefined\n></span>`;
  },

  docker() {
    return `<span class="c-cyan">Cannot connect to the Docker daemon. Is the daemon running?\n</span><span class="c-comment">(Spoiler: no, this is a browser)</span>`;
  },

  git({ args }) {
    const sub = args[0];
    if (sub === "status") return `On branch main\nnothing to commit, working tree clean\n\n<span class="c-comment">(this portfolio is already deployed ✨)</span>`;
    if (sub === "log") return `<span class="c-yellow">commit abc123</span> (HEAD -> main)\nAuthor: ${esc(PORTFOLIO_CONFIG.name)} <${esc(PORTFOLIO_CONFIG.email)}>\nDate:   ${new Date().toUTCString()}\n\n    Initial portfolio deployment 🚀`;
    if (sub === "push") return `<span class="c-red">error: remote origin already deployed.</span>`;
    return `<span class="c-comment">git: '${esc(sub || "")}' is not a git command. See 'git --help'.</span>`;
  },

  make() {
    return `<span class="c-green">make: *** No targets specified. Stop.</span>\n<span class="c-comment">Try:  make coffee</span>`;
  },

  yes({ args }) {
    const word = args.filter(a => !a.startsWith("-")).join(" ") || "y";
    const lines = [];
    for (let i = 0; i < 50; i++) lines.push(esc(word));
    lines.push(`<span class="c-comment">(...okay that's enough)</span>`);
    return lines.join("\n");
  },

  lolcat({ args, stdin }) {
    const text = stdin || args.join(" ") || "meow";
    const colors = ["c-red", "c-orange", "c-yellow", "c-green", "c-cyan", "c-blue", "c-magenta"];
    return [...text].map((ch, i) =>
      `<span class="${colors[i % colors.length]}">${esc(ch)}</span>`
    ).join("");
  },
};

// Check if input matches fork bomb
export function isForkBomb(raw) {
  const trimmed = raw.trim();
  return trimmed === ":(){ :|:& };:" || trimmed === ":(){ :|: & };:";
}
