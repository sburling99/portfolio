// ============================================================
// Terminal — input handling, history, tab completion, rendering
// ============================================================
import { VirtualFS } from "./filesystem.js";
import { parse, stripHtml } from "./parser.js";
import { COMMANDS, setFS, esc } from "./commands.js";
import { EASTER_EGG_COMMANDS, isForkBomb } from "./easter-eggs.js";

// Linkify URLs in HTML output — only touches text outside of tags
const URL_RE = /\bhttps?:\/\/[^\s<>"']+|(?:www\.)[^\s<>"']+|\b[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+(?:\/[^\s<>"']*)?/g;

function linkifyUrls(html) {
  // Split on HTML tags so we only process text nodes
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) return tag; // pass HTML tags through untouched
    return text.replace(URL_RE, (url) => {
      const href = url.startsWith("http") ? url : `https://${url}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="term-link">${url}</a>`;
    });
  });
}

export class Terminal {
  constructor() {
    this.fs = new VirtualFS();
    setFS(this.fs);

    this.history    = [];
    this.historyIdx = -1;
    this.savedInput = "";
    this.tabState   = { prefix: null, matches: [], idx: 0 };

    // DOM references
    this.outputEl  = document.getElementById("output");
    this.inputEl   = document.getElementById("input");
    this.promptEl  = document.getElementById("prompt-display");
    this.bodyEl    = document.getElementById("terminal-body");

    // Merge command maps — easter eggs are lower priority
    this.commands = { ...EASTER_EGG_COMMANDS, ...COMMANDS };

    this._bindEvents();
    this._renderPrompt();
  }

  // ── Event binding ──────────────────────────────────────────

  _bindEvents() {
    this.inputEl.addEventListener("keydown", (e) => this._onKeyDown(e));

    // Click anywhere in terminal body to focus input
    this.bodyEl.addEventListener("click", (e) => {
      // Don't steal focus from text selection
      if (!window.getSelection().toString()) {
        this.inputEl.focus();
      }
    });

    // Keep input focused
    this.inputEl.addEventListener("blur", () => {
      setTimeout(() => this.inputEl.focus(), 10);
    });
  }

  _onKeyDown(e) {
    // Reset tab state on any key except Tab
    if (e.key !== "Tab") {
      this.tabState = { prefix: null, matches: [], idx: 0 };
    }

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        this._execute();
        break;

      case "ArrowUp":
        e.preventDefault();
        this._historyBack();
        break;

      case "ArrowDown":
        e.preventDefault();
        this._historyForward();
        break;

      case "Tab":
        e.preventDefault();
        this._tabComplete();
        break;

      case "c":
        if (e.ctrlKey) {
          e.preventDefault();
          this._cancelInput();
        }
        break;

      case "l":
        if (e.ctrlKey) {
          e.preventDefault();
          this.clear();
        }
        break;

      case "u":
        if (e.ctrlKey) {
          e.preventDefault();
          this.inputEl.value = "";
        }
        break;
    }
  }

  // ── Prompt ─────────────────────────────────────────────────

  _renderPrompt() {
    const path = this.fs.displayPath();
    this.promptEl.innerHTML =
      `<span class="prompt-user">guest</span>` +
      `<span class="prompt-at">@</span>` +
      `<span class="prompt-host">portfolio</span>` +
      `<span class="prompt-colon">:</span>` +
      `<span class="prompt-path">${esc(path)}</span>` +
      `<span class="prompt-dollar">$ </span>`;

    document.title = `guest@portfolio: ${path}`;
  }

  // ── Execution ──────────────────────────────────────────────

  _execute() {
    let raw = this.inputEl.value;
    this.inputEl.value = "";

    // History expansion: !! and !n
    raw = this._expandHistory(raw);

    // Freeze prompt + command
    this._freezeLine(raw);

    if (!raw.trim()) {
      this._renderPrompt();
      this._scrollToBottom();
      return;
    }

    // Add to history
    this.history.push(raw);
    this.historyIdx = -1;

    // Check fork bomb
    if (isForkBomb(raw)) {
      this._appendOutput(`<span class="c-red c-bold">Fork bomb detected!</span> <span class="c-comment">Just kidding, this terminal is immune to your shenanigans.</span>`);
      this._renderPrompt();
      this._scrollToBottom();
      return;
    }

    // Parse and execute
    const chains = parse(raw);
    let lastSuccess = true;

    for (const chain of chains) {
      // Handle && chaining
      if (chain.chainOp === "&&" && !lastSuccess) continue;

      let pipeOutput = null;
      for (const seg of chain.segments) {
        const result = this._runSegment(seg, pipeOutput);
        pipeOutput = result;
      }

      // Handle clear sentinel
      if (pipeOutput === "__CLEAR__") {
        this.clear();
        lastSuccess = true;
        continue;
      }

      // Handle redirect
      const lastSeg = chain.segments[chain.segments.length - 1];
      if (lastSeg.redirect && pipeOutput !== null) {
        const filePath = this.fs.resolve(lastSeg.redirect);
        const content = stripHtml(pipeOutput);
        let res;
        if (lastSeg.redirectMode === ">>") {
          res = this.fs.appendFile(filePath, content);
        } else {
          res = this.fs.createFile(filePath, content);
        }
        if (res.error) {
          this._appendOutput(`<span class="error">${esc(res.error)}</span>`);
          lastSuccess = false;
        } else {
          lastSuccess = true;
        }
      } else if (pipeOutput !== null && pipeOutput !== "") {
        this._appendOutput(pipeOutput);
        lastSuccess = true;
      } else {
        lastSuccess = pipeOutput !== null;
      }
    }

    this._renderPrompt();
    this._scrollToBottom();
  }

  _runSegment(seg, stdin) {
    const { command, args, flags } = seg;
    if (!command) return null;

    const handler = this.commands[command];
    if (!handler) {
      return `<span class="error">${esc(command)}: command not found</span>`;
    }

    // Strip HTML from stdin for piped input
    const plainStdin = stdin !== null ? stripHtml(stdin) : null;

    try {
      const result = handler({
        args,
        flags,
        stdin: plainStdin,
        term: this,
        history: this.history,
      });
      return result;
    } catch (err) {
      return `<span class="error">${esc(command)}: ${esc(err.message)}</span>`;
    }
  }

  _expandHistory(raw) {
    if (raw === "!!") {
      return this.history.length > 0 ? this.history[this.history.length - 1] : "";
    }
    const bangN = raw.match(/^!(\d+)$/);
    if (bangN) {
      const idx = parseInt(bangN[1]) - 1;
      return (idx >= 0 && idx < this.history.length) ? this.history[idx] : "";
    }
    return raw;
  }

  // ── Output ─────────────────────────────────────────────────

  _freezeLine(command) {
    const div = document.createElement("div");
    div.className = "frozen-prompt";
    div.innerHTML = this.promptEl.innerHTML +
      `<span class="frozen-command">${esc(command)}</span>`;
    this.outputEl.appendChild(div);
  }

  _appendOutput(html) {
    if (html === null || html === undefined) return;
    const div = document.createElement("div");
    div.className = "output-block";
    div.innerHTML = linkifyUrls(html);
    this.outputEl.appendChild(div);
  }

  appendBanner(html) {
    const div = document.createElement("div");
    div.className = "output-block";
    div.innerHTML = linkifyUrls(html);
    this.outputEl.appendChild(div);
  }

  clear() {
    this.outputEl.innerHTML = "";
    window.scrollTo(0, 0);
  }

  _scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
  }

  // ── History navigation ─────────────────────────────────────

  _historyBack() {
    if (this.history.length === 0) return;
    if (this.historyIdx === -1) {
      this.savedInput = this.inputEl.value;
      this.historyIdx = this.history.length - 1;
    } else if (this.historyIdx > 0) {
      this.historyIdx--;
    }
    this.inputEl.value = this.history[this.historyIdx];
  }

  _historyForward() {
    if (this.historyIdx === -1) return;
    if (this.historyIdx < this.history.length - 1) {
      this.historyIdx++;
      this.inputEl.value = this.history[this.historyIdx];
    } else {
      this.historyIdx = -1;
      this.inputEl.value = this.savedInput;
    }
  }

  // ── Cancel ─────────────────────────────────────────────────

  _cancelInput() {
    this._freezeLine(this.inputEl.value + "^C");
    this.inputEl.value = "";
    this._renderPrompt();
    this._scrollToBottom();
  }

  // ── Tab completion ─────────────────────────────────────────

  _tabComplete() {
    const val = this.inputEl.value;
    const parts = val.split(/\s+/);
    const isFirst = parts.length <= 1;
    const current = parts[parts.length - 1] || "";

    let matches;

    if (isFirst) {
      // Command completion
      const allCmds = Object.keys(this.commands);
      matches = allCmds.filter(c => c.startsWith(current));
    } else {
      // Path completion
      matches = this._pathComplete(current);
    }

    if (matches.length === 0) return;

    if (matches.length === 1) {
      // Single match — complete it
      parts[parts.length - 1] = matches[0];
      this.inputEl.value = parts.join(" ");
      return;
    }

    // Multiple matches — find common prefix
    const prefix = this._commonPrefix(matches);
    if (prefix.length > current.length) {
      parts[parts.length - 1] = prefix;
      this.inputEl.value = parts.join(" ");
      return;
    }

    // Show all matches (double-tab behavior — show immediately)
    this._freezeLine(val);
    this._appendOutput(matches.map(m => `  ${esc(m)}`).join("\n"));
    this._renderPrompt();
    this.inputEl.value = val;
    this._scrollToBottom();
  }

  _pathComplete(partial) {
    let dir, prefix;

    if (partial.includes("/")) {
      const lastSlash = partial.lastIndexOf("/");
      const dirPart = partial.slice(0, lastSlash + 1) || "/";
      prefix = partial.slice(lastSlash + 1);
      dir = this.fs.getNode(dirPart);
    } else {
      dir = this.fs.getNode(this.fs.cwd);
      prefix = partial;
    }

    if (!dir || dir.type !== "dir") return [];

    const entries = Object.entries(dir.children || {});
    const matches = [];

    for (const [name, node] of entries) {
      if (name.startsWith(prefix)) {
        const base = partial.includes("/")
          ? partial.slice(0, partial.lastIndexOf("/") + 1) + name
          : name;
        matches.push(node.type === "dir" ? base + "/" : base);
      }
    }

    return matches;
  }

  _commonPrefix(arr) {
    if (arr.length === 0) return "";
    let prefix = arr[0];
    for (let i = 1; i < arr.length; i++) {
      while (!arr[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
      }
    }
    return prefix;
  }
}
