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

// ── help <name> entries (brief, like bash help) ──────────────

const HELP_ENTRIES = {
  ls:       "ls [-la] [path] - list directory contents",
  cd:       "cd [-L|-P] [dir] - change the working directory\n    cd        change to HOME\n    cd -      change to previous directory\n    cd ..     change to parent directory",
  cat:      "cat [file ...] - concatenate and print files",
  pwd:      "pwd - print name of current working directory",
  tree:     "tree [dir] - list contents of directories in a tree-like format",
  find:     "find [path] -name <pattern> - search for files in a directory hierarchy",
  file:     "file [file] - determine file type",
  stat:     "stat [file] - display file status",
  head:     "head [-n N] [file] - output the first part of files",
  tail:     "tail [-n N] [file] - output the last part of files",
  wc:       "wc [-lwc] [file] - print newline, word, and byte counts",
  touch:    "touch [file] - change file timestamps / create empty file",
  mkdir:    "mkdir [dir] - make directories",
  grep:     "grep [-inc] <pattern> [file] - print lines that match patterns\n    -i  ignore case\n    -n  prefix with line number\n    -c  count of matching lines only",
  echo:     "echo [text ...] - display a line of text\n    Supports $VAR expansion",
  sort:     "sort [-r] [file] - sort lines of text files\n    -r  reverse the result of comparisons",
  uniq:     "uniq [file] - report or omit repeated lines",
  rev:      "rev [file] - reverse lines characterwise",
  whoami:   "whoami - print effective userid",
  hostname: "hostname - show the system's host name",
  uname:    "uname [-a] - print system information",
  date:     "date - display the current date and time",
  uptime:   "uptime - tell how long the system has been running",
  env:      "env - print the environment",
  id:       "id - print real and effective user and group IDs",
  neofetch: "neofetch - a command-line system information tool",
  help:     "help [pattern] - display information about builtin commands",
  clear:    "clear - clear the terminal screen",
  history:  "history - display the command history list",
  man:      "man [command] - an interface to the system reference manuals",
  which:    "which [command] - locate a command",
  type:     "type [command] - display information about command type",
  exit:     "exit [n] - exit the shell",
  bash:     "bash [file] - execute commands from file",
  sudo:     "sudo [command] - execute a command as another user",
  rm:       "rm [-rf] [file] - remove files or directories",
  vim:      "vim [file] - Vi IMproved, a programmer's text editor",
  nano:     "nano [file] - a simple text editor",
  emacs:    "emacs [file] - the extensible, customizable display editor",
  curl:     "curl [url] - transfer a URL",
  wget:     "wget [url] - non-interactive network downloader",
  apt:      "apt [subcommand] - command-line interface for the package management system",
  brew:     "brew [subcommand] - the missing package manager for macOS (or Linux)",
  pip:      "pip [subcommand] - package installer for Python",
  chmod:    "chmod [mode] [file] - change file mode bits",
  chown:    "chown [owner] [file] - change file owner and group",
  alias:    "alias [name=value] - define or display aliases",
  top:      "top - display Linux processes",
  htop:     "htop - interactive process viewer",
  ping:     "ping [host] - send ICMP ECHO_REQUEST to network hosts",
  ssh:      "ssh [destination] - OpenSSH remote login client",
  poweroff: "poweroff - power off the machine",
  reboot:   "reboot - reboot the machine",
  python:   "python - the Python interpreter",
  node:     "node - server-side JavaScript runtime",
  docker:   "docker [subcommand] - a self-sufficient runtime for containers",
  git:      "git [subcommand] - the stupid content tracker",
  make:     "make [target] - GNU make utility to maintain groups of programs",
  yes:      "yes [string] - output a string repeatedly until killed",
};

// ── man pages (detailed, like man(1)) ────────────────────────

const MAN_PAGES = {
  ls:       "<b>LS(1)</b>\n\nNAME\n     ls - list directory contents\n\nSYNOPSIS\n     ls [-la] [path]\n\nDESCRIPTION\n     List information about files in the current directory or\n     the given path.\n\n     -l  use a long listing format\n     -a  do not ignore entries starting with .",
  cd:       "<b>CD(1)</b>\n\nNAME\n     cd - change the working directory\n\nSYNOPSIS\n     cd [-L|-P] [dir]\n\nDESCRIPTION\n     Change the current directory to dir.  If dir is not\n     supplied, the value of HOME is used.\n\n     -     change to the previous directory (OLDPWD) and print\n           the new working directory\n     -L    follow symbolic links (default)\n     -P    use physical directory structure\n     ..    parent directory\n     ~     home directory",
  cat:      "<b>CAT(1)</b>\n\nNAME\n     cat - concatenate files and print on the standard output\n\nSYNOPSIS\n     cat [file ...]\n\nDESCRIPTION\n     Concatenate file(s) to standard output.\n     With no file, or when file is -, read standard input.",
  pwd:      "<b>PWD(1)</b>\n\nNAME\n     pwd - print name of current/working directory\n\nSYNOPSIS\n     pwd\n\nDESCRIPTION\n     Print the full filename of the current working directory.",
  tree:     "<b>TREE(1)</b>\n\nNAME\n     tree - list contents of directories in a tree-like format\n\nSYNOPSIS\n     tree [directory]\n\nDESCRIPTION\n     Recursively list directory contents indented to show the\n     nesting level.",
  find:     "<b>FIND(1)</b>\n\nNAME\n     find - search for files in a directory hierarchy\n\nSYNOPSIS\n     find [path] -name <pattern>\n\nDESCRIPTION\n     Search for files matching a name pattern under the given\n     starting path.  Supports * and ? wildcards.\n\nEXAMPLE\n     find / -name \"*.md\"",
  file:     "<b>FILE(1)</b>\n\nNAME\n     file - determine file type\n\nSYNOPSIS\n     file [file]\n\nDESCRIPTION\n     Determine the type of the given file (regular file,\n     directory, symbolic link, etc).",
  stat:     "<b>STAT(1)</b>\n\nNAME\n     stat - display file or file system status\n\nSYNOPSIS\n     stat [file]\n\nDESCRIPTION\n     Display detailed information about the given file,\n     including permissions, size, and type.",
  head:     "<b>HEAD(1)</b>\n\nNAME\n     head - output the first part of files\n\nSYNOPSIS\n     head [-n N] [file]\n\nDESCRIPTION\n     Print the first N lines of each file to standard output.\n     With no -n, defaults to 10 lines.",
  tail:     "<b>TAIL(1)</b>\n\nNAME\n     tail - output the last part of files\n\nSYNOPSIS\n     tail [-n N] [file]\n\nDESCRIPTION\n     Print the last N lines of each file to standard output.\n     With no -n, defaults to 10 lines.",
  wc:       "<b>WC(1)</b>\n\nNAME\n     wc - print newline, word, and byte counts for each file\n\nSYNOPSIS\n     wc [-lwc] [file]\n\nDESCRIPTION\n     Print newline, word, and byte counts.  With no flags,\n     prints all three.\n\n     -l  print the newline count\n     -w  print the word count\n     -c  print the byte count",
  touch:    "<b>TOUCH(1)</b>\n\nNAME\n     touch - change file timestamps\n\nSYNOPSIS\n     touch [file]\n\nDESCRIPTION\n     Create an empty file if it does not exist.  Only writable\n     under /tmp.",
  mkdir:    "<b>MKDIR(1)</b>\n\nNAME\n     mkdir - make directories\n\nSYNOPSIS\n     mkdir [dir]\n\nDESCRIPTION\n     Create the directory if it does not already exist.  Only\n     writable under /tmp.",
  grep:     "<b>GREP(1)</b>\n\nNAME\n     grep - print lines that match patterns\n\nSYNOPSIS\n     grep [-inc] <pattern> [file]\n\nDESCRIPTION\n     Search for pattern in each file or stdin.\n\n     -i  ignore case distinctions in patterns and data\n     -n  prefix each line of output with the line number\n     -c  suppress normal output; print a count of matching lines",
  echo:     "<b>ECHO(1)</b>\n\nNAME\n     echo - display a line of text\n\nSYNOPSIS\n     echo [-n] [string ...]\n\nDESCRIPTION\n     Echo the string(s) to standard output.\n     Supports $VAR expansion from environment.\n\n     -n  do not output the trailing newline",
  sort:     "<b>SORT(1)</b>\n\nNAME\n     sort - sort lines of text files\n\nSYNOPSIS\n     sort [-r] [file]\n\nDESCRIPTION\n     Write sorted concatenation of file(s) to standard output.\n\n     -r  reverse the result of comparisons",
  uniq:     "<b>UNIQ(1)</b>\n\nNAME\n     uniq - report or omit repeated lines\n\nSYNOPSIS\n     uniq [file]\n\nDESCRIPTION\n     Filter adjacent matching lines from input, writing to\n     standard output.",
  rev:      "<b>REV(1)</b>\n\nNAME\n     rev - reverse lines characterwise\n\nSYNOPSIS\n     rev [file]\n\nDESCRIPTION\n     Reverse the order of characters in every line.",
  whoami:   "<b>WHOAMI(1)</b>\n\nNAME\n     whoami - print effective userid\n\nSYNOPSIS\n     whoami\n\nDESCRIPTION\n     Print the user name associated with the current effective\n     user ID.",
  hostname: "<b>HOSTNAME(1)</b>\n\nNAME\n     hostname - show or set the system's host name\n\nSYNOPSIS\n     hostname\n\nDESCRIPTION\n     Display the system's host name.",
  uname:    "<b>UNAME(1)</b>\n\nNAME\n     uname - print system information\n\nSYNOPSIS\n     uname [-a]\n\nDESCRIPTION\n     Print certain system information.\n\n     -a  print all information",
  date:     "<b>DATE(1)</b>\n\nNAME\n     date - display or set date and time\n\nSYNOPSIS\n     date\n\nDESCRIPTION\n     Display the current date and time.",
  uptime:   "<b>UPTIME(1)</b>\n\nNAME\n     uptime - tell how long the system has been running\n\nSYNOPSIS\n     uptime\n\nDESCRIPTION\n     Print how long the system has been running since page load.",
  env:      "<b>ENV(1)</b>\n\nNAME\n     env - run a program in a modified environment\n\nSYNOPSIS\n     env\n\nDESCRIPTION\n     Print the current environment variables.",
  id:       "<b>ID(1)</b>\n\nNAME\n     id - print real and effective user and group IDs\n\nSYNOPSIS\n     id\n\nDESCRIPTION\n     Print user and group information for the current user.",
  neofetch: "<b>NEOFETCH(1)</b>\n\nNAME\n     neofetch - a command-line system information tool\n\nSYNOPSIS\n     neofetch\n\nDESCRIPTION\n     Display system information alongside an ASCII logo.",
  help:     "<b>HELP(1)</b>\n\nNAME\n     help - display information about builtin commands\n\nSYNOPSIS\n     help [pattern]\n\nDESCRIPTION\n     Display helpful information about builtin commands.  If\n     pattern is specified, give detailed help on the matching\n     command; otherwise list all available commands.",
  clear:    "<b>CLEAR(1)</b>\n\nNAME\n     clear - clear the terminal screen\n\nSYNOPSIS\n     clear\n\nDESCRIPTION\n     Clear the terminal screen.  Also available via Ctrl+L.",
  history:  "<b>HISTORY(1)</b>\n\nNAME\n     history - display the command history list\n\nSYNOPSIS\n     history\n\nDESCRIPTION\n     Display the list of previously entered commands with line\n     numbers.  Use !! to repeat the last command and !N to\n     repeat command number N.",
  man:      "<b>MAN(1)</b>\n\nNAME\n     man - an interface to the system reference manuals\n\nSYNOPSIS\n     man [command]\n\nDESCRIPTION\n     Display the manual page for the given command.",
  which:    "<b>WHICH(1)</b>\n\nNAME\n     which - locate a command\n\nSYNOPSIS\n     which [command]\n\nDESCRIPTION\n     Write the full path of the command to standard output.",
  type:     "<b>TYPE(1)</b>\n\nNAME\n     type - display information about command type\n\nSYNOPSIS\n     type [command]\n\nDESCRIPTION\n     Indicate how each name would be interpreted if used as a\n     command name (builtin, alias, or file).",
  exit:     "<b>EXIT(1)</b>\n\nNAME\n     exit - cause the shell to exit\n\nSYNOPSIS\n     exit [n]\n\nDESCRIPTION\n     Exit the shell with a status of n.",
  bash:     "<b>BASH(1)</b>\n\nNAME\n     bash - GNU Bourne-Again SHell\n\nSYNOPSIS\n     bash [file]\n\nDESCRIPTION\n     Execute commands read from file.",
  sudo:     "<b>SUDO(8)</b>\n\nNAME\n     sudo - execute a command as another user\n\nSYNOPSIS\n     sudo [command]\n\nDESCRIPTION\n     Execute the given command as the superuser.",
  rm:       "<b>RM(1)</b>\n\nNAME\n     rm - remove files or directories\n\nSYNOPSIS\n     rm [-rf] [file ...]\n\nDESCRIPTION\n     Remove each specified file.\n\n     -r  remove directories and their contents recursively\n     -f  ignore nonexistent files, never prompt",
  vim:      "<b>VIM(1)</b>\n\nNAME\n     vim - Vi IMproved, a programmer's text editor\n\nSYNOPSIS\n     vim [file]\n\nDESCRIPTION\n     Vim is a text editor that is upwards compatible to Vi.",
  nano:     "<b>NANO(1)</b>\n\nNAME\n     nano - Nano's ANOther editor, inspired by Pico\n\nSYNOPSIS\n     nano [file]\n\nDESCRIPTION\n     A simple, modeless text editor.",
  emacs:    "<b>EMACS(1)</b>\n\nNAME\n     emacs - GNU project Emacs editor\n\nSYNOPSIS\n     emacs [file]\n\nDESCRIPTION\n     The extensible, customizable, self-documenting real-time\n     display editor.",
  curl:     "<b>CURL(1)</b>\n\nNAME\n     curl - transfer a URL\n\nSYNOPSIS\n     curl [options] [url]\n\nDESCRIPTION\n     Transfer data from or to a server using supported protocols.",
  wget:     "<b>WGET(1)</b>\n\nNAME\n     wget - the non-interactive network downloader\n\nSYNOPSIS\n     wget [url]\n\nDESCRIPTION\n     GNU Wget is a free utility for non-interactive download of\n     files from the Web.",
  apt:      "<b>APT(8)</b>\n\nNAME\n     apt - command-line interface for the package management system\n\nSYNOPSIS\n     apt [subcommand] [package]\n\nDESCRIPTION\n     High-level interface to the dpkg package management system.",
  brew:     "<b>BREW(1)</b>\n\nNAME\n     brew - the missing package manager for macOS (or Linux)\n\nSYNOPSIS\n     brew [subcommand] [formula]\n\nDESCRIPTION\n     Homebrew installs the stuff macOS forgot.",
  pip:      "<b>PIP(1)</b>\n\nNAME\n     pip - package installer for Python\n\nSYNOPSIS\n     pip [subcommand] [package]\n\nDESCRIPTION\n     Install and manage Python packages.",
  chmod:    "<b>CHMOD(1)</b>\n\nNAME\n     chmod - change file mode bits\n\nSYNOPSIS\n     chmod [mode] [file]\n\nDESCRIPTION\n     Change the file mode (permissions) of each given file.",
  chown:    "<b>CHOWN(1)</b>\n\nNAME\n     chown - change file owner and group\n\nSYNOPSIS\n     chown [owner[:group]] [file]\n\nDESCRIPTION\n     Change the user and/or group ownership of each given file.",
  alias:    "<b>ALIAS(1)</b>\n\nNAME\n     alias - define or display aliases\n\nSYNOPSIS\n     alias [name=value]\n\nDESCRIPTION\n     Without arguments, print the list of aliases.  Otherwise\n     define an alias for each name whose value is given.",
  top:      "<b>TOP(1)</b>\n\nNAME\n     top - display Linux processes\n\nSYNOPSIS\n     top\n\nDESCRIPTION\n     Provide a dynamic real-time view of a running system.",
  htop:     "<b>HTOP(1)</b>\n\nNAME\n     htop - interactive process viewer\n\nSYNOPSIS\n     htop\n\nDESCRIPTION\n     An interactive process viewer for Unix systems.",
  ping:     "<b>PING(8)</b>\n\nNAME\n     ping - send ICMP ECHO_REQUEST to network hosts\n\nSYNOPSIS\n     ping [host]\n\nDESCRIPTION\n     Send ICMP ECHO_REQUEST packets to a host and report\n     round-trip times.",
  ssh:      "<b>SSH(1)</b>\n\nNAME\n     ssh - OpenSSH remote login client\n\nSYNOPSIS\n     ssh [user@]hostname\n\nDESCRIPTION\n     Log into a remote machine and execute commands.",
  poweroff: "<b>POWEROFF(8)</b>\n\nNAME\n     poweroff - power off the machine\n\nSYNOPSIS\n     poweroff\n\nDESCRIPTION\n     Power off the machine.",
  reboot:   "<b>REBOOT(8)</b>\n\nNAME\n     reboot - reboot the machine\n\nSYNOPSIS\n     reboot\n\nDESCRIPTION\n     Reboot the machine.",
  python:   "<b>PYTHON(1)</b>\n\nNAME\n     python - an interpreted, interactive, object-oriented\n              programming language\n\nSYNOPSIS\n     python\n\nDESCRIPTION\n     Start the Python interpreter.",
  node:     "<b>NODE(1)</b>\n\nNAME\n     node - server-side JavaScript runtime built on V8\n\nSYNOPSIS\n     node\n\nDESCRIPTION\n     Start the Node.js REPL.",
  docker:   "<b>DOCKER(1)</b>\n\nNAME\n     docker - a self-sufficient runtime for containers\n\nSYNOPSIS\n     docker [subcommand]\n\nDESCRIPTION\n     A platform for developing, shipping, and running\n     applications in containers.",
  git:      "<b>GIT(1)</b>\n\nNAME\n     git - the stupid content tracker\n\nSYNOPSIS\n     git [subcommand]\n\nDESCRIPTION\n     Git is a fast, scalable, distributed revision control\n     system.\n\n     Supported subcommands: status, log, push",
  make:     "<b>MAKE(1)</b>\n\nNAME\n     make - GNU make utility to maintain groups of programs\n\nSYNOPSIS\n     make [target]\n\nDESCRIPTION\n     Determine which pieces of a program need to be recompiled\n     and issue the commands to recompile them.",
  yes:      "<b>YES(1)</b>\n\nNAME\n     yes - output a string repeatedly until killed\n\nSYNOPSIS\n     yes [string]\n\nDESCRIPTION\n     Repeatedly output a line with all specified string(s), or\n     'y'.",
};

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
    // Parse options vs operands (cd accepts -L, -P; "-" alone is an operand)
    let dir = null;
    let operandCount = 0;
    let endOfOpts = false;
    for (const a of args) {
      if (endOfOpts || a === "-" || !a.startsWith("-")) {
        operandCount++;
        if (operandCount === 1) dir = a;
      } else if (a === "--") {
        endOfOpts = true;
      } else if (/^-[LP]+$/.test(a)) {
        // -L, -P accepted and ignored (no symlinks in virtual fs)
      } else {
        return err(`cd: ${a.slice(0,2)}: invalid option\ncd: usage: cd [-L|-P] [dir]`);
      }
    }
    if (operandCount > 1) return err("cd: too many arguments");

    // No argument → HOME
    if (dir === null || dir === "") dir = "~";

    const res = fs.cd(dir);
    if (res.error) return err(res.error);

    // "cd -" prints the new working directory (POSIX behavior)
    if (dir === "-") return esc(fs.cwd);
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

  help({ args }) {
    const cmd = plainArgs(args)[0];

    // help <command> — show brief builtin help
    if (cmd) {
      const entry = HELP_ENTRIES[cmd];
      if (!entry) return err(`bash: help: no help topics match \`${cmd}'.`);
      return entry;
    }

    // bare help — list all commands in columns
    const builtins = Object.keys(COMMANDS).sort();
    const maxLen = Math.max(...builtins.map(s => s.length)) + 2;
    const cols = Math.max(1, Math.floor(80 / maxLen));
    const rows = [];
    for (let i = 0; i < builtins.length; i += cols) {
      rows.push(builtins.slice(i, i + cols).map(s => esc(s).padEnd(maxLen)).join(""));
    }
    return `GNU bash, version 5.2.15(1)-release (x86_64-pc-linux-gnu)
These shell commands are defined internally.  Type \`help <command>' to find
out more about the function.  Use \`man <command>' for more info.

${rows.join("\n")}`;
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
    const page = MAN_PAGES[cmd];
    if (!page) return err(`No manual entry for ${cmd}`);
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
    return `logout\nConnection to portfolio closed.`;
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

// ── Fun command helpers ──────────────────────────────────────

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

function cowsayText(msg) {
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
    { pid: 9999, user: "guest", cpu: "99.9", mem: "0.1", cmd: "[kworker/0:1-events]" },
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
  return `${summary}\n${header}\n${rows}`;
}

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
  lines.push(`<span class="c-red c-bold">rm: cannot remove '/': Permission denied</span>`);
  return lines.join("\n");
}

// ── Fun commands ─────────────────────────────────────────────────────────────

COMMANDS.sudo = function({ args }) {
  return `<span class="c-red c-bold">[sudo] password for guest: \nguest is not in the sudoers file.  This incident will be reported.</span>`;
};

COMMANDS.rm = function({ args, flags }) {
  const joined = args.join(" ");
  if ((flags.has("r") && flags.has("f") && joined.includes("/")) ||
      joined.includes("-rf /") || joined.includes("-rf/")) {
    return rmRfSlash();
  }
  return `<span class="c-red">rm: cannot remove: Permission denied</span>`;
};

COMMANDS.vim = function() {
  return `<span class="c-comment">~\n~\n~\n~\n~\n~\n~                              VIM - Vi IMproved\n~\n~                                version 9.0\n~                          by Bram Moolenaar et al.\n~\n~                 type  :q<Enter>       to exit\n~                 type  :help<Enter>    for on-line help\n~\n~\n~\n~</span>`;
};

COMMANDS.nano = function() {
  return `<span class="c-comment">  GNU nano 7.2             New Buffer\n\n\n\n\n\n^G Help    ^O Write Out  ^W Where Is  ^K Cut\n^X Exit    ^R Read File  ^\\ Replace   ^U Paste</span>`;
};

COMMANDS.emacs = function() {
  return `<span class="c-comment">GNU Emacs 29.1\nCopyright (C) 2023 Free Software Foundation, Inc.\nType C-x C-c to exit.</span>`;
};

COMMANDS.curl = function({ args }) {
  const url = args.filter(a => !a.startsWith("-"))[0];
  if (!url) return `curl: try 'curl --help' for more information`;
  return `<span class="c-red">curl: (6) Could not resolve host: ${esc(url)}</span>`;
};

COMMANDS.wget = function({ args }) {
  const url = args.filter(a => !a.startsWith("-"))[0];
  if (!url) return `wget: missing URL`;
  return `<span class="c-red">wget: unable to resolve host address '${esc(url)}'</span>`;
};

COMMANDS.apt = function() {
  return `<span class="c-red">E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)</span>`;
};

COMMANDS.brew = function() {
  return `<span class="c-red">bash: brew: command not found</span>`;
};

COMMANDS.pip = function() {
  return `<span class="c-red">bash: pip: command not found</span>`;
};

COMMANDS.chmod = function({ args }) {
  const joined = args.join(" ");
  if (joined.includes("777")) {
    return `<span class="c-red">chmod: changing permissions of '/': Operation not permitted</span>`;
  }
  return `<span class="c-red">chmod: changing permissions: Read-only file system</span>`;
};

COMMANDS.chown = function() {
  return `<span class="c-red">chown: changing ownership: Operation not permitted</span>`;
};

COMMANDS.alias = function() {
  return ``;
};

COMMANDS.top = function() { return fakeTop(); };
COMMANDS.htop = function() { return fakeTop(); };

COMMANDS.ping = function({ args }) {
  const host = args.filter(a => !a.startsWith("-"))[0];
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
};

COMMANDS.ssh = function({ args }) {
  const host = args.filter(a => !a.startsWith("-"))[0];
  if (!host) return `usage: ssh [-l login_name] destination`;
  return `<span class="c-red">ssh: connect to host ${esc(host)} port 22: Connection refused</span>`;
};

COMMANDS.poweroff = function() {
  return `<span class="c-red">Failed to set wall message, ignoring: Interactive authentication required.\nFailed to power off system via logind: Interactive authentication required.\nFailed to open initctl fifo: Permission denied\npoweroff: Failed to talk to init daemon.</span>`;
};

COMMANDS.reboot = function() {
  return `<span class="c-red">Failed to set wall message, ignoring: Interactive authentication required.\nFailed to reboot system via logind: Interactive authentication required.\nFailed to open initctl fifo: Permission denied\nreboot: Failed to talk to init daemon.</span>`;
};

COMMANDS.python = function() {
  return `Python 3.12.0 (main, Oct  2 2023, 00:00:00) [GCC 13.2.0] on linux\nType "help", "copyright", "credits" or "license" for more information.\n>>> `;
};

COMMANDS.node = function() {
  return `Welcome to Node.js v21.0.0.\nType ".help" for more information.\n> `;
};

COMMANDS.docker = function() {
  return `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`;
};

COMMANDS.git = function({ args }) {
  const sub = args[0];
  if (sub === "status") return `On branch main\nnothing to commit, working tree clean`;
  if (sub === "log") return `<span class="c-yellow">commit abc123</span> (HEAD -> main)\nAuthor: ${esc(PORTFOLIO_CONFIG.name)} <${esc(PORTFOLIO_CONFIG.email)}>\nDate:   ${new Date().toUTCString()}\n\n    Initial portfolio deployment`;
  if (sub === "push") return `Everything up-to-date`;
  return `<span class="c-comment">git: '${esc(sub || "")}' is not a git command. See 'git --help'.</span>`;
};

COMMANDS.make = function() {
  return `make: *** No targets specified and no makefile found.  Stop.`;
};

COMMANDS.yes = function({ args }) {
  const word = args.filter(a => !a.startsWith("-")).join(" ") || "y";
  const lines = [];
  for (let i = 0; i < 50; i++) lines.push(esc(word));
  lines.push(`^C`);
  return lines.join("\n");
};

// ── Fork bomb detection ──────────────────────────────────────
export function isForkBomb(raw) {
  const trimmed = raw.trim();
  return trimmed === ":(){ :|:& };:" || trimmed === ":(){ :|: & };:";
}
