// ============================================================
// Main — entry point, wires everything together
// ============================================================
import { Terminal } from "./terminal.js";

const BANNER = `<span class="c-blue c-bold">guest@portfolio</span> <span class="c-comment">—</span> <span class="c-fg">interactive portfolio terminal</span>
<span class="c-comment">Type <strong>help</strong> to see available commands, or <strong>cat README.md</strong> to get started.</span>
`;

document.addEventListener("DOMContentLoaded", () => {
  const term = new Terminal();
  term.appendBanner(BANNER);
  term._scrollToBottom();
  term.inputEl.focus();
});
