// ============================================================
// Terminal — input handling, history, tab completion, rendering
// ============================================================
import { VirtualFS } from "./filesystem.js";
import { parse, stripHtml } from "./parser.js";
import { COMMANDS, setFS, esc, isForkBomb } from "./commands.js";

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
    this.tabState   = { prefix: null, matches: [], idx: 0, tabCount: 0 };

    // DOM references
    this.outputEl  = document.getElementById("output");
    this.inputEl   = document.getElementById("input");
    this.promptEl  = document.getElementById("prompt-display");
    this.bodyEl    = document.getElementById("terminal-body");

    this.commands = COMMANDS;

    this._bindEvents();
    this._renderPrompt();
  }

  // ── Event binding ──────────────────────────────────────────

  _bindEvents() {
    this.inputEl.addEventListener("keydown", (e) => this._onKeyDown(e));

    // Handle paste with newlines — execute each line as a command
    this.inputEl.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text");
      if (!text || !text.includes("\n")) return; // let single-line paste work normally
      e.preventDefault();
      const lines = text.split(/\r?\n/);
      // Append first line to current input
      const first = this.inputEl.value + lines[0];
      this.inputEl.value = first;
      this._execute();
      // Execute remaining non-empty lines
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim() && i === lines.length - 1) break; // skip trailing empty line
        this.inputEl.value = line;
        this._execute();
      }
    });

    // Click anywhere in terminal body to focus input
    this.bodyEl.addEventListener("mouseup", (e) => {
      // Don't steal focus when user is selecting text
      if (!window.getSelection().toString()) {
        this.inputEl.focus();
      }
    });
  }

  _onKeyDown(e) {
    // Reset tab state on any key except Tab
    if (e.key !== "Tab") {
      this.tabState = { prefix: null, matches: [], idx: 0, tabCount: 0 };
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
        this._tabComplete(e.shiftKey ? -1 : 1);
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
    let { command, args, flags } = seg;
    if (!command) return null;

    let handler = this.commands[command];

    // Handle "cd.." / "cd~" / "cd/" etc — common typos missing the space
    if (!handler && /^cd[.~\/]/.test(command)) {
      command = "cd";
      args = [seg.command.slice(2), ...args];
      handler = this.commands["cd"];
    }

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

  // ── Tab completion (bash-style) ────────────────────────────

  _tabComplete(direction = 1) {
    this.tabState.tabCount = (this.tabState.tabCount || 0) + 1;

    const val = this.inputEl.value;
    const parts = val.split(/\s+/);
    const isFirst = parts.length <= 1;
    const command = parts[0];
    const dirsOnly = command === "cd";
    const hasTrailingSpace = val.endsWith(" ");
    const current = (isFirst || !hasTrailingSpace) ? (parts[parts.length - 1] || "") : "";
    if (hasTrailingSpace && !isFirst) {
      parts.push("");
    }

    // Empty input: ignore single Tab, double Tab lists all commands
    if (!val.trim()) {
      if (this.tabState.tabCount >= 2) {
        const allCmds = Object.keys(this.commands).sort();
        this._showCompletions(allCmds);
      }
      return;
    }

    // Compute matches on first Tab press
    if (this.tabState.prefix === null) {
      let matches;
      if (isFirst) {
        matches = Object.keys(this.commands).filter(c => c.startsWith(current)).sort();
      } else {
        matches = this._pathComplete(current, dirsOnly).sort();
      }

      if (matches.length === 0) return;

      // Unique match: complete it immediately
      if (matches.length === 1) {
        parts[parts.length - 1] = matches[0];
        this.inputEl.value = parts.join(" ");
        return;
      }

      // Multiple matches: fill common prefix
      const common = this._commonPrefix(matches);
      if (common.length > current.length) {
        parts[parts.length - 1] = common;
        this.inputEl.value = parts.join(" ");
      }

      this.tabState = { ...this.tabState, prefix: current, matches, idx: 0, parts: [...parts] };
      return;
    }

    // Second+ Tab with multiple matches: display them
    const { matches } = this.tabState;
    if (matches.length > 1) {
      this._showCompletions(matches);
    }
  }

  _showCompletions(items) {
    // Freeze current prompt + input, show matches, re-render prompt
    this._freezeLine(this.inputEl.value);
    const cols = this._columnize(items);
    this._appendOutput(cols);
    this._scrollToBottom();
    // Reset so next Tab recomputes
    this.tabState = { prefix: null, matches: [], idx: 0, tabCount: 0 };
  }

  _columnize(items) {
    if (items.length === 0) return "";
    const maxLen = Math.max(...items.map(s => s.length)) + 2;
    const termWidth = 80;
    const cols = Math.max(1, Math.floor(termWidth / maxLen));
    const rows = [];
    for (let i = 0; i < items.length; i += cols) {
      rows.push(items.slice(i, i + cols).map(s => esc(s).padEnd(maxLen)).join(""));
    }
    return rows.join("\n");
  }

  _pathComplete(partial, dirsOnly = false) {
    let dir, prefix, dirPart;

    if (partial.includes("/")) {
      const lastSlash = partial.lastIndexOf("/");
      dirPart = partial.slice(0, lastSlash + 1) || "/";
      prefix = partial.slice(lastSlash + 1);
      dir = this.fs.getNode(dirPart);
    } else {
      dirPart = "";
      dir = this.fs.getNode(this.fs.cwd);
      prefix = partial;
    }

    if (!dir || dir.type !== "dir") return [];

    const entries = Object.entries(dir.children || {});
    const matches = [];

    for (const [name, node] of entries) {
      if (dirsOnly && node.type !== "dir") continue;
      if (name.startsWith(prefix)) {
        const base = dirPart ? dirPart + name : name;
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
