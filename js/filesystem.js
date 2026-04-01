// ============================================================
// PORTFOLIO CONFIGURATION
// Edit this section — all personal data lives here.
// ============================================================
export const PORTFOLIO_CONFIG = {
  name:       "Your Name",
  title:      "Software Engineer",
  location:   "San Francisco, CA",
  email:      "your.email@example.com",
  github:     "github.com/yourusername",
  linkedin:   "linkedin.com/in/yourusername",
  website:    "yourwebsite.com",

  about: `Hi! I'm Your Name, a software engineer based in San Francisco.

I love building things for the web — from interactive UIs to distributed
backend systems. Currently working on [your current project or role].

I'm passionate about clean code, great developer experience, and tools
that make people's lives easier.

When I'm not coding, I'm [your hobbies here].

Type  cat resume.md   for my full resume.
Type  ls projects/    to see what I've built.
Type  bash skills.sh  to see my skill set.
Type  cat contact.json to get in touch.`,

  resume: `# Your Name
# ${new Date().getFullYear()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXPERIENCE
──────────────────────────────────────────────────────

  Senior Software Engineer @ Company Name  (2022–Present)
  ─────────────────────────────────────────────────────
  • Led development of [feature], reducing [metric] by X%
  • Architected a [system] serving N million users
  • Mentored 3 junior engineers
  • Stack: TypeScript, React, Node.js, PostgreSQL, AWS

  Software Engineer @ Previous Company  (2019–2022)
  ─────────────────────────────────────────────────
  • Built and shipped [product feature] from 0 to 1
  • Reduced API latency by 40% through caching layer
  • Contributed to open source: [project name]
  • Stack: Python, Django, React, Redis, Docker

EDUCATION
──────────────────────────────────────────────────────

  B.S. Computer Science — State University  (2019)
  Relevant coursework: Algorithms, Systems, Distributed Computing

SKILLS
──────────────────────────────────────────────────────

  Languages:  JavaScript/TypeScript, Python, Go, SQL
  Frontend:   React, Next.js, CSS, HTML
  Backend:    Node.js, Django, PostgreSQL, Redis
  DevOps:     Docker, Kubernetes, AWS, GitHub Actions
  Tools:      Git, vim (yes, really), Linux

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
References available upon request. Or just hire me.`,

  education: `Education & Certifications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Degrees
  B.S. Computer Science
  State University | 2015–2019
  GPA: 3.8/4.0 | Dean's List x4

Certifications
  AWS Solutions Architect Associate    (2023)
  Google Cloud Professional DE         (2022)

Courses & Training
  CS50x — HarvardX (edX)
  Machine Learning — Stanford (Coursera)
  Kubernetes for Developers — Linux Foundation`,

  contact: {
    email:        "your.email@example.com",
    github:       "https://github.com/yourusername",
    linkedin:     "https://linkedin.com/in/yourusername",
    twitter:      "@yourhandle",
    website:      "https://yourwebsite.com",
    location:     "San Francisco, CA",
    availability: "Open to new opportunities",
  },

  skills: {
    languages: { JavaScript: 95, TypeScript: 90, Python: 85, Go: 70, SQL: 80 },
    frontend:  { React: 90, "Next.js": 85, CSS: 85, HTML: 95, "Tailwind CSS": 80 },
    backend:   { "Node.js": 88, Django: 75, PostgreSQL: 80, Redis: 75, REST: 90 },
    devops:    { Docker: 80, Kubernetes: 65, AWS: 75, "GitHub Actions": 85, Linux: 80 },
  },

  projects: {
    "project-one": {
      name:        "Project One",
      description: "A full-stack web app that does something cool.",
      tech:        ["TypeScript", "React", "Node.js", "PostgreSQL"],
      github:      "https://github.com/yourusername/project-one",
      demo:        "https://project-one.example.com",
      year:        "2024",
    },
    "project-two": {
      name:        "Project Two",
      description: "An open-source CLI tool that solves a real problem.",
      tech:        ["Go", "SQLite"],
      github:      "https://github.com/yourusername/project-two",
      demo:        null,
      year:        "2023",
    },
    "project-three": {
      name:        "Project Three",
      description: "A machine learning model that predicts something interesting.",
      tech:        ["Python", "PyTorch", "FastAPI"],
      github:      "https://github.com/yourusername/project-three",
      demo:        "https://project-three.example.com",
      year:        "2023",
    },
  },
};
// ============================================================
// END CONFIGURATION
// ============================================================

export const START_TIME = Date.now();

function skillsContent() {
  const bar = (pct) => "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
  let out = "#!/usr/bin/env bash\n# Skills Overview — run with: bash skills.sh\n\n";
  for (const [category, skills] of Object.entries(PORTFOLIO_CONFIG.skills)) {
    out += `${category.toUpperCase()}\n`;
    for (const [name, pct] of Object.entries(skills)) {
      out += `  ${name.padEnd(20)} [${bar(pct)}] ${pct}%\n`;
    }
    out += "\n";
  }
  return out;
}

function buildProjectDirs() {
  const dirs = {};
  for (const [slug, proj] of Object.entries(PORTFOLIO_CONFIG.projects)) {
    dirs[slug] = {
      type: "dir",
      permissions: "drwxr-xr-x",
      children: {
        "README.md": {
          type: "file",
          permissions: "-rw-r--r--",
          content: [
            `# ${proj.name}`,
            ``,
            proj.description,
            ``,
            `Tech Stack:  ${proj.tech.join(", ")}`,
            `Year:        ${proj.year}`,
            `GitHub:      ${proj.github}`,
            proj.demo ? `Demo:        ${proj.demo}` : null,
          ].filter(l => l !== null).join("\n"),
        },
      },
    };
  }
  return dirs;
}

function buildFilesystem() {
  const cfg = PORTFOLIO_CONFIG;
  const projectDirEntries = buildProjectDirs();

  const projectsReadme = [
    "# Projects",
    "",
    ...Object.entries(cfg.projects).map(([slug, p]) =>
      `  ${slug}/\n    ${p.description}`
    ),
    "",
    "Run:  ls        to list projects",
    "      cd <name> to explore one",
    "      cat <name>/README.md for details",
  ].join("\n");

  return {
    type: "dir",
    permissions: "drwxr-xr-x",
    children: {
      home: {
        type: "dir",
        permissions: "drwxr-xr-x",
        children: {
          guest: {
            type: "dir",
            permissions: "drwxr-xr-x",
            children: {
              "README.md": {
                type: "file",
                permissions: "-rw-r--r--",
                content: `Welcome to ${cfg.name}'s portfolio terminal!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files in this directory:

  about.txt      — Who I am
  resume.md      — Full resume
  contact.json   — Get in touch
  education.txt  — Academic background
  skills.sh      — Run to see skill levels
  projects/      — Things I've built

Quick start:
  cat about.txt
  cat resume.md
  bash skills.sh
  ls projects/
  neofetch

Type  help  for all available commands.
`,
              },
              "about.txt": {
                type: "file",
                permissions: "-rw-r--r--",
                content: cfg.about,
              },
              "resume.md": {
                type: "file",
                permissions: "-rw-r--r--",
                content: cfg.resume,
              },
              "contact.json": {
                type: "file",
                permissions: "-rw-r--r--",
                content: JSON.stringify(cfg.contact, null, 2),
              },
              "education.txt": {
                type: "file",
                permissions: "-rw-r--r--",
                content: cfg.education,
              },
              "skills.sh": {
                type: "file",
                permissions: "-rwxr-xr-x",
                content: skillsContent,
              },
              ".bashrc": {
                type: "file",
                permissions: "-rw-r--r--",
                content: `# ~/.bashrc — ${cfg.name}'s shell configuration

# Prompt
PS1='\\u@portfolio:\\w\\$ '

# Aliases
alias ll='ls -la'
alias la='ls -a'
alias l='ls -l'
alias ..='cd ..'
alias grep='grep --color=auto'
alias vim='echo "Haha good luck with that"'

# Environment
export EDITOR=vim
export PAGER=less
export LANG=en_US.UTF-8

# History
HISTSIZE=1000
HISTCONTROL=ignoredups:erasedups
`,
              },
              ".secret": {
                type: "file",
                permissions: "-rw-------",
                content: `nice find :)

here's a cookie: 🍪

Since you're clearly the curious type, I already like you.
Feel free to reach out: ${cfg.email}

P.S. Try:  :(){ :|:& };:
`,
              },
              projects: {
                type: "dir",
                permissions: "drwxr-xr-x",
                children: {
                  "README.md": {
                    type: "file",
                    permissions: "-rw-r--r--",
                    content: projectsReadme,
                  },
                  ...projectDirEntries,
                },
              },
            },
          },
        },
      },

      etc: {
        type: "dir",
        permissions: "drwxr-xr-x",
        children: {
          hostname: {
            type: "file",
            permissions: "-rw-r--r--",
            content: "portfolio\n",
          },
          "os-release": {
            type: "file",
            permissions: "-rw-r--r--",
            content: `NAME="Portfolio OS"
VERSION="2.0.0 (Noble Coder)"
ID=portfolio
ID_LIKE=debian
PRETTY_NAME="Portfolio OS 2.0.0"
HOME_URL="https://${cfg.website}"
SUPPORT_URL="mailto:${cfg.email}"
BUG_REPORT_URL="${cfg.github}"
`,
          },
          passwd: {
            type: "file",
            permissions: "-rw-r--r--",
            content: `root:x:0:0:root:/root:/bin/bash
guest:x:1000:1000:${cfg.name}:/home/guest:/bin/bash
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
`,
          },
          shells: {
            type: "file",
            permissions: "-rw-r--r--",
            content: "/bin/sh\n/bin/bash\n/usr/bin/bash\n/bin/zsh\n",
          },
        },
      },

      proc: {
        type: "dir",
        permissions: "dr-xr-xr-x",
        children: {
          uptime: {
            type: "file",
            permissions: "-r--r--r--",
            content: () => {
              const s = (Date.now() - START_TIME) / 1000;
              return `${s.toFixed(2)} ${(s * 0.7).toFixed(2)}\n`;
            },
          },
          version: {
            type: "file",
            permissions: "-r--r--r--",
            content: `Linux version 6.5.0-portfolio (${cfg.name.toLowerCase().replace(/\s+/g, "@")}portfolio) (gcc 13.2.0) #1 SMP PREEMPT_DYNAMIC`,
          },
          cpuinfo: {
            type: "file",
            permissions: "-r--r--r--",
            content: `processor\t: 0
vendor_id\t: GenuineIntel
model name\t: JavaScript V8 Engine @ 3.20GHz
cpu MHz\t\t: 3200.000
cache size\t: 8192 KB
cpu cores\t: 8
flags\t\t: fpu vme de pse tsc msr cx8 apic
bogomips\t: 6400.00

processor\t: 1
vendor_id\t: GenuineIntel
model name\t: JavaScript V8 Engine @ 3.20GHz
cpu MHz\t\t: 3200.000
`,
          },
          meminfo: {
            type: "file",
            permissions: "-r--r--r--",
            content: () => {
              const usedKB = Math.round(Math.random() * 512000 + 200000);
              return `MemTotal:       16384000 kB
MemFree:        ${(16384000 - usedKB).toString().padStart(9)} kB
MemAvailable:   ${(16384000 - usedKB / 2).toString().padStart(9)} kB
Buffers:            32768 kB
Cached:            524288 kB
SwapTotal:       8192000 kB
SwapFree:        8192000 kB
`;
            },
          },
        },
      },

      var: {
        type: "dir",
        permissions: "drwxr-xr-x",
        children: {
          log: {
            type: "dir",
            permissions: "drwxr-xr-x",
            children: {
              "auth.log": {
                type: "file",
                permissions: "-rw-r-----",
                content: `Apr  1 00:00:01 portfolio sshd[1337]: Server listening on 0.0.0.0 port 22.
Apr  1 00:01:42 portfolio sshd[1338]: Accepted publickey for guest from 127.0.0.1
Apr  1 00:01:42 portfolio systemd-logind[420]: New session 1 of user guest.
Apr  1 09:15:03 portfolio sudo[9999]: guest : user NOT in sudoers ; TTY=pts/0
Apr  1 09:15:04 portfolio sudo[9999]: pam_unix(sudo:auth): authentication failure
Apr  1 10:22:17 portfolio sshd[2048]: Failed password for root from 192.168.1.100
Apr  1 10:22:18 portfolio sshd[2048]: Failed password for root from 192.168.1.100
Apr  1 10:22:19 portfolio sshd[2048]: Failed password for root from 192.168.1.100
Apr  1 10:22:20 portfolio sshd[2048]: error: maximum authentication attempts exceeded
Apr  1 12:00:00 portfolio CRON[3000]: (guest) CMD (echo "still working")
Apr  1 14:37:55 portfolio sshd[4096]: Accepted publickey for you from [your-ip]
Apr  1 14:37:55 portfolio systemd-logind[420]: New session 42 of user guest.
`,
              },
              syslog: {
                type: "file",
                permissions: "-rw-r-----",
                content: () => {
                  const ts = new Date().toLocaleString("en-US", {
                    month: "short", day: "2-digit",
                    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
                  });
                  return `${ts} portfolio kernel: Linux version 6.5.0 (portfolio@localhost)
${ts} portfolio systemd[1]: Started Portfolio Web Server.
${ts} portfolio portfolio-server[80]: Listening on port 80
${ts} portfolio portfolio-server[80]: GET / 200 OK
${ts} portfolio portfolio-server[80]: Serving curious visitor #${Math.floor(Math.random() * 9000 + 1000)}
`;
                },
              },
            },
          },
        },
      },

      tmp: {
        type: "dir",
        permissions: "drwxrwxrwt",
        children: {},
      },

      usr: {
        type: "dir",
        permissions: "drwxr-xr-x",
        children: {
          bin: {
            type: "dir",
            permissions: "drwxr-xr-x",
            children: Object.fromEntries([
              "ls","cat","grep","find","tree","head","tail","wc","sort","uniq",
              "echo","pwd","touch","mkdir","file","stat","rev","date","env","id",
              "uname","uptime","whoami","hostname","which","type","man","history",
              "vim","cowsay","sl","fortune","matrix","neofetch","ping","ssh",
              "curl","wget","top","htop","sudo","rm","bash",
            ].map(cmd => [cmd, { type: "file", permissions: "-rwxr-xr-x", content: `#!/bin/bash\n# ${cmd}` }])),
          },
          local: {
            type: "dir",
            permissions: "drwxr-xr-x",
            children: { bin: { type: "dir", permissions: "drwxr-xr-x", children: {} } },
          },
        },
      },

      bin: { type: "symlink", permissions: "lrwxrwxrwx", target: "/usr/bin" },

      root: { type: "dir", permissions: "drwx------", children: {} },

      dev: {
        type: "dir",
        permissions: "drwxr-xr-x",
        children: {
          null:   { type: "file", permissions: "crw-rw-rw-", content: "" },
          zero:   { type: "file", permissions: "crw-rw-rw-", content: "\0".repeat(64) },
          random: { type: "file", permissions: "crw-rw-rw-", content: () => Math.random().toString(36).slice(2).repeat(8) },
          tty:    { type: "file", permissions: "crw-rw-rw-", content: "" },
        },
      },
    },
  };
}

export class VirtualFS {
  constructor() {
    this.root    = buildFilesystem();
    this.homePath = "/home/guest";
    this.cwd     = "/home/guest";
    this.prevDir = "/home/guest";
  }

  // ── Path resolution ────────────────────────────────────────

  resolve(inputPath) {
    if (!inputPath || inputPath === "~")    return this.homePath;
    if (inputPath.startsWith("~/"))         return this.homePath + inputPath.slice(1);
    if (inputPath === "-")                  return this.prevDir;
    if (inputPath.startsWith("/"))          return this._normalize(inputPath);
    return this._normalize(this.cwd + "/" + inputPath);
  }

  _normalize(path) {
    const parts = path.split("/").filter(Boolean);
    const result = [];
    for (const p of parts) {
      if (p === ".")  continue;
      if (p === "..") { result.pop(); continue; }
      result.push(p);
    }
    return "/" + result.join("/");
  }

  // ── Node access ────────────────────────────────────────────

  getNode(path) {
    const norm = typeof path === "string" ? this.resolve(path) : path;
    if (norm === "/") return this.root;
    const parts = norm.split("/").filter(Boolean);
    let node = this.root;
    for (const part of parts) {
      if (!node || node.type !== "dir") return null;
      node = node.children?.[part] ?? null;
      if (node?.type === "symlink") node = this.getNode(node.target);
    }
    return node;
  }

  getParent(path) {
    const norm = this.resolve(path);
    const parts = norm.split("/").filter(Boolean);
    parts.pop();
    return this.getNode("/" + parts.join("/")) ?? this.root;
  }

  getName(path) {
    return this.resolve(path).split("/").filter(Boolean).pop() ?? "/";
  }

  getContent(node) {
    if (!node || node.type !== "file") return null;
    return typeof node.content === "function" ? node.content() : (node.content ?? "");
  }

  isExecutable(pathOrNode) {
    const node = typeof pathOrNode === "string" ? this.getNode(pathOrNode) : pathOrNode;
    return !!node?.permissions?.includes("x");
  }

  // ── Mutation ───────────────────────────────────────────────

  createFile(path, content = "") {
    const resolved = this.resolve(path);
    if (!resolved.startsWith("/tmp/")) return { error: "Permission denied (only /tmp/ is writable)" };
    const parentPath = resolved.split("/").slice(0, -1).join("/") || "/";
    const parent = this.getNode(parentPath);
    if (!parent || parent.type !== "dir") return { error: `No such directory: ${parentPath}` };
    const name = resolved.split("/").pop();
    parent.children[name] = { type: "file", permissions: "-rw-r--r--", content };
    return { success: true };
  }

  appendFile(path, content) {
    const resolved = this.resolve(path);
    if (!resolved.startsWith("/tmp/")) return { error: "Permission denied (only /tmp/ is writable)" };
    const existing = this.getNode(resolved);
    if (existing && existing.type === "file") {
      const cur = this.getContent(existing) ?? "";
      existing.content = cur + content;
      return { success: true };
    }
    return this.createFile(resolved, content);
  }

  cd(path) {
    const resolved = this.resolve(path);
    const node = this.getNode(resolved);
    if (!node)               return { error: `cd: ${path}: No such file or directory` };
    if (node.type !== "dir") return { error: `cd: ${path}: Not a directory` };
    this.prevDir = this.cwd;
    this.cwd = resolved;
    return { success: true, path: resolved };
  }

  displayPath() {
    if (this.cwd === this.homePath)               return "~";
    if (this.cwd.startsWith(this.homePath + "/")) return "~" + this.cwd.slice(this.homePath.length);
    return this.cwd;
  }
}
