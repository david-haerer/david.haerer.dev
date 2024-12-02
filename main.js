// == IMPORTS ==

import { micromark } from "https://esm.sh/micromark@3?bundle";
import {
  math,
  mathHtml,
} from "https://esm.sh/micromark-extension-math@3?bundle";
import { gfm, gfmHtml } from "https://esm.sh/micromark-extension-gfm@3?bundle";
import { all } from "https://esm.sh/@wooorm/starry-night@3?bundle";
import { rehype } from "https://esm.sh/rehype@13?bundle";
import rehypeStarryNight from "https://esm.sh/rehype-starry-night@2?bundle";

// == UTILS ==

function decode(encoded) {
  return decodeURIComponent(encoded);
}

function windowHash() {
  return window.location.hash.slice(1);
}

function toHash(path) {
  return isDir(path) ? path : path.slice(0, -3);
}

function toFilepath(hash) {
  return isDir(hash) ? hash : hash + ".md";
}

function isDir(filepath) {
  return filepath.endsWith("/");
}

function createBtn(id, innerHTML, onclick, classList) {
  const btn = document.createElement("button");
  [btn.id, btn.innerHTML, btn.onclick] = [id, innerHTML, onclick];
  if (classList) btn.classList = classList;
  return btn;
}

// == CONSTANTS ==

const SHARE_ID = "AdTDBMHMGCZXNnW";
const NEXTCLOUD = "https://nextcloud.haerer.dev";

// == GLOBALS ==

let TREE;
let STATE;
const CACHE = {};
let ADMIN_KEY = localStorage.getItem("ADMIN_KEY");
let HOOKS = [];

// == FUNCTIONS ==

// -- NETWORK FUNCTIONS --

async function fetchTree(id, password) {
  const path = `/public.php/dav/files/${id}/`;
  const url = NEXTCLOUD + path;
  const headers = {};
  headers["Depth"] = "infinity";
  headers["Content-Type"] = "text/xml";
  headers["Accept"] = "application/xml";
  if (password) {
    headers["X-Requested-With"] = "XMLHttpRequest";
    headers["Authorization"] = `Basic ${btoa(id + ":" + password)}`;
  }
  const res = await fetch(url, {
    method: "PROPFIND",
    headers: headers,
    body: "<?xml version='1.0'?><d:propfind xmlns:d='DAV:'><d:prop><d:href/><d:displayname/></d:prop></d:propfind>",
  });
  if (!res.ok) return false;
  const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
  const responses = Array.from(xml.getElementsByTagName("d:response"));
  const name = responses
    .filter((r) => r.childNodes[0].innerHTML == path)
    .map((r) => r.childNodes[1].childNodes[0].childNodes[0].innerHTML)[0];
  const files = responses
    .map((response) => response.childNodes[0].innerHTML)
    .map((href) => href.replace(path, "/"))
    .filter((file) => file !== "/");
  const tree = { name: name, files: [], dirs: {} };
  for (let file of files) {
    const parts = file.split("/");
    let [branch, end] = [tree, isDir(file) ? -2 : -1];
    for (let part of parts.slice(1, end)) branch = branch.dirs[`${part}/`];
    const name = isDir(file) ? `${parts.slice(-2, -1)}/` : parts.slice(-1)[0];
    branch.files.push({ path: file, name: name });
    if (isDir(file)) branch.dirs[name] = { files: [], dirs: {} };
  }
  return tree;
}

async function download(url, headers) {
  if (CACHE[url]) return CACHE[url];
  const response = await fetch(url, { headers });
  if (!response.ok) return { ok: false, text: "" };
  const text = await response.text();
  CACHE[url] = { ok: true, text };
  return CACHE[url];
}

async function downloadPublic(id, filepath) {
  const parts = filepath.split("/");
  const [path, file] = isDir(filepath)
    ? [filepath, "index.md"]
    : [parts.slice(0, -1).join("/"), parts.slice(-1)[0]];
  const url = `${NEXTCLOUD}/s/${id}/download?path=${path}&files=${file}`;
  return download(url, {});
}

async function downloadPrivate(id, password, filepath) {
  const url = `${NEXTCLOUD}/public.php/webdav${filepath}`;
  const headers = {
    "X-Requested-With": "XMLHttpRequest",
    Authorization: "Basic " + btoa(id + ":" + password),
  };
  return download(url, headers);
}

// -- RENDER FUNCTIONS --

async function renderNavHeader(tree) {
  const link = createBtn("/", tree.name, () => open("/"));
  document.getElementById("header").appendChild(link);
  const toggle = createBtn("toggle", "-", () => toggleNav(), ["btn"]);
  document.getElementById("header").appendChild(toggle);
}

function toggleNav(hide) {
  const hidden = document.getElementById("toggle").innerHTML == "+";
  if (hide && hidden) return;
  document.getElementById("toggle").innerHTML = hidden ? "-" : "+";
  document.getElementById("body").classList = hidden ? ["nav"] : ["main"];
}

async function renderNavUl(branch, rootUl) {
  for (let f of branch.files.sort((a, b) => {
    if (isDir(a.path) && !isDir(b.path)) return -1;
    if (!isDir(a.path) && isDir(b.path)) return 1;
    if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
    if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
    return 0;
  })) {
    if (f.name == "index.md") continue;
    const li = document.createElement("li");
    const link = createBtn(f.path, decode(toHash(f.name)), () => open(f.path));
    li.appendChild(link);
    if (isDir(f.path)) {
      const hide = !toFilepath(windowHash()).startsWith(f.path);
      const [id, label] = [f.path + "-toggle", hide ? "+" : "-"];
      const toggle = createBtn(id, label, () => toggleNavUl(id), ["btn"]);
      li.appendChild(toggle);
      const ul = document.createElement("ul");
      ul.id = f.path + "-toggle-ul";
      ul.hidden = hide;
      li.appendChild(ul);
      renderNavUl(branch.dirs[f.name], ul);
    }
    rootUl.appendChild(li);
  }
}

function toggleNavUl(toggleId) {
  const ul = document.getElementById(`${toggleId}-ul`);
  document.getElementById(toggleId).innerHTML = ul.hidden ? "-" : "+";
  ul.hidden = !ul.hidden;
}

async function renderMain(markdown) {
  const html = micromark(markdown, {
    extensions: [math(), gfm()],
    htmlExtensions: [mathHtml(), gfmHtml()],
  });
  const main = document.getElementById("main");
  main.innerHTML = String(
    await rehype().use(rehypeStarryNight, { grammars: all }).process(html),
  );
  Array.from(main.getElementsByTagName("a"))
    .filter((a) => a.href.startsWith(window.location.origin + "/#/"))
    .forEach(async (a) => {
      const filepath = toFilepath(new URL(a.href).hash.slice(1));
      a.onclick = () => open(filepath);
      a.removeAttribute("href");
    });
}

async function open(filepath) {
  if (window.innerWidth <= 800) toggleNav("hide");
  if (filepath === STATE) return false;
  try {
    document.getElementById(STATE).disabled = false;
  } catch {}
  STATE = filepath;
  const link = document.getElementById(STATE);
  if (!link) return false;
  link.disabled = true;

  const response = await downloadPublic(SHARE_ID, filepath);
  if (!response.ok && !isDir(filepath)) return false;
  let markdown;
  if (response.ok) {
    markdown = response.text;
  } else {
    let tree = TREE;
    const parts = filepath.split("/");
    for (let part of parts.slice(1, -1)) tree = tree.dirs[part + "/"];
    const title = decode(parts.slice(-2, -1));
    const list = tree.files
      .map((file) => [decode(toHash(file.name)), toHash(file.path)])
      .map((link) => `* [${link[0]}](${window.origin}#${link[1]})`);
    markdown = `# ${title}\n${list.join("\n")}`;
  }

  await renderMain(markdown);
  window.location.hash = toHash(STATE);
  HOOKS.forEach((f) => f(windowHash()));
  return true;
}

async function init() {
  HOOKS.push(feedback);
  HOOKS.push(notes);
  HOOKS.push(bookmarks);
  TREE = await fetchTree(SHARE_ID);
  await renderNavHeader(TREE);
  await renderNavUl(TREE, document.getElementById("ul"));
  if (!(await open(toFilepath(windowHash())))) open("/");
  window.onhashchange = () => {
    const filepath = toFilepath(windowHash());
    if (filepath === STATE) return;
    open(filepath);
  };
}

function feedback(hash) {
  if (hash !== "/Contact") return;
  const hr = document.getElementsByTagName("hr")[0];
  const form = document.createElement("p");
  form.id = "feedback";
  const input = document.createElement("textarea");
  input.id = "feedbackInput";
  input.placeholder = "Send an anonymous message...";
  input.rows = "3";
  form.appendChild(input);
  const submit = document.createElement("button");
  submit.id = "feedbackSubmit";
  submit.innerHTML = "Submit";
  submit.onclick = async () => {
    const content = document.getElementById("feedbackInput").value;
    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });
    const shareId = "F84pjQm9QDXt8xt";
    const now = new Date();
    const headers = {
      "Content-Type": "application/octet-stream",
    };
    const response = await fetch(
      `https://nextcloud.haerer.dev/public.php/dav/files/${shareId}/${now.toISOString()}`,
      { method: "PUT", headers: headers, body: blob },
    );
    if (!response.ok) alert("That didn't work :/");
    document.getElementById("feedbackInput").value = "";
    alert("Thanks for your feedback :)");
  };
  submit.classList.add("btn", "submit");
  form.appendChild(submit);
  hr.after(form);
}

function key() {
  const main = document.getElementById("main");
  const form = document.createElement("p");
  form.id = "admin";
  const input = document.createElement("input");
  input.id = "adminInput";
  input.placeholder = "Key...";
  input.type = "password";
  form.appendChild(input);
  const submit = document.createElement("button");
  submit.id = "adminSubmit";
  submit.innerHTML = "Unlock";
  submit.onclick = async () => {
    ADMIN_KEY = document.getElementById("adminInput").value;
    localStorage.setItem("ADMIN_KEY", ADMIN_KEY);
    notes(windowHash());
  };
  submit.classList.add("btn", "submit");
  form.appendChild(submit);
  main.appendChild(form);
}

async function notes(hash) {
  if (hash !== "/Apps/Notes") return;
  const id = "D3EWB4jeBYtDEPT";
  if (!ADMIN_KEY) return key();
  const tree = await fetchTree(id, ADMIN_KEY);
  if (tree === false) return key();
  const lines = await Promise.all(
    tree.files.sort().map(async (file) => {
      const response = await downloadPrivate(id, ADMIN_KEY, file.path);
      return response.text.slice(-1) === "\n"
        ? response.text.slice(0, -1)
        : response.text;
    }),
  );
  const notes = JSON.parse(
    "[" + lines.join("\n").split(/\n/).join(",") + "]",
  ).reverse();
  main = document.getElementById("main");
  main.innerHTML = "";
  const form = document.createElement("p");
  form.id = "addNote";
  const input = document.createElement("textarea");
  input.id = "noteInput";
  input.placeholder = "Add a new note...";
  input.rows = "3";
  form.appendChild(input);
  const submit = document.createElement("button");
  submit.id = "noteSubmit";
  submit.innerHTML = "Post";
  submit.onclick = async () => {
    const content = document.getElementById("noteInput").value;
    const timestamp = new Date().toISOString();
    const note = { timestamp: timestamp, content: content };
    const blob = new Blob([JSON.stringify(note)], {
      type: "text/plain;charset=utf-8",
    });
    const headers = {
      "Content-Type": "application/octet-stream",
      "X-Requested-With": "XMLHttpRequest",
      Authorization: "Basic " + btoa(id + ":" + ADMIN_KEY),
    };
    const response = await fetch(
      `https://nextcloud.haerer.dev/public.php/dav/files/${id}/${timestamp}.jsonl`,
      { method: "PUT", headers: headers, body: blob },
    );
    if (!response.ok) alert("That didn't work :/");
    document.getElementById("noteInput").value = "";
    document.getElementById("notes").prepend(renderNote(note));
  };
  submit.classList.add("btn", "submit");
  form.appendChild(submit);
  main.appendChild(form);
  const aside = document.createElement("aside");
  aside.id = "notes";
  main.appendChild(aside);
  notes.forEach((note) => {
    aside.appendChild(renderNote(note));
  });
}

function renderNote(note) {
  const datetime = new Date(note.timestamp);
  const year = datetime.getFullYear();
  const month = (datetime.getMonth() + 1).toString().padStart(2, "0");
  const day = datetime.getDate().toString().padStart(2, "0");
  const h = datetime.getHours().toString().padStart(2, "0");
  const m = datetime.getMinutes().toString().padStart(2, "0");
  const s = datetime.getSeconds().toString().padStart(2, "0");
  const date = `${year}-${month}-${day}`;
  const time = h + m + s === "000000" ? "" : ` ${h}:${m}:${s}`;
  const markdown = `# \`${date}${time}\`\n${note.content}\n`;
  const html = micromark(markdown, {
    extensions: [math(), gfm()],
    htmlExtensions: [mathHtml(), gfmHtml()],
  });
  const section = document.createElement("section");
  section.innerHTML = html;
  section.id = note.timestamp;
  section.classList.add("note");
  return section;
}

async function bookmarks(hash) {
  if (hash !== "/Apps/Bookmarks") return;
  const id = "a73eCLtDcQpTtiW";
  if (!ADMIN_KEY) return key();
  const tree = await fetchTree(id, ADMIN_KEY);
  if (tree === false) return key();
  const lines = await Promise.all(
    tree.files.sort().map(async (file) => {
      const response = await downloadPrivate(id, ADMIN_KEY, file.path);
      return response.text.slice(-1) === "\n"
        ? response.text.slice(0, -1)
        : response.text;
    }),
  );
  const bookmarks = JSON.parse(
    "[" + lines.join("\n").split(/\n/).join(",") + "]",
  ).reverse();
  main = document.getElementById("main");
  main.innerHTML = "";
  const form = document.createElement("p");
  form.id = "addBookmark";
  const inputText = document.createElement("input");
  const inputUrl = document.createElement("input");
  inputText.id = "bookmarkInputText";
  inputUrl.id = "bookmarkInputUrl";
  inputText.placeholder = "Title...";
  inputUrl.placeholder = "URL...";
  form.appendChild(inputText);
  form.appendChild(inputUrl);
  const submit = document.createElement("button");
  submit.id = "bookmarkSubmit";
  submit.innerHTML = "Save";
  submit.onclick = async () => {
    let url = document.getElementById("bookmarkInputUrl").value;
    if (!url) {
      alert("URL is required!");
      return;
    }
    if (!url.startsWith("https://")) url = "https://" + url;
    const text = document.getElementById("bookmarkInputText").value;
    const timestamp = new Date().toISOString();
    const note = { timestamp: timestamp, url: url, text: text };
    const blob = new Blob([JSON.stringify(note)], {
      type: "text/plain;charset=utf-8",
    });
    const headers = {
      "Content-Type": "application/octet-stream",
      "X-Requested-With": "XMLHttpRequest",
      Authorization: "Basic " + btoa(id + ":" + ADMIN_KEY),
    };
    const response = await fetch(
      `https://nextcloud.haerer.dev/public.php/dav/files/${id}/${timestamp}.jsonl`,
      { method: "PUT", headers: headers, body: blob },
    );
    if (!response.ok) {
      alert("That didn't work :/");
      return;
    }
    document.getElementById("bookmarkInputText").value = "";
    document.getElementById("bookmarkInputUrl").value = "";
    document.getElementById("bookmarks").prepend(renderBookmark(note));
  };
  submit.classList.add("btn", "submit");
  form.appendChild(submit);
  main.appendChild(form);
  const aside = document.createElement("aside");
  aside.id = "bookmarks";
  main.appendChild(aside);
  bookmarks.forEach((bookmark) => {
    aside.appendChild(renderBookmark(bookmark));
  });
}

function renderBookmark(bookmark) {
  const section = document.createElement("section");
  section.classList.add("bookmark");
  const a = document.createElement("a");
  a.href = bookmark.url;
  a.target = "_blank";
  a.innerHTML = bookmark.text ? bookmark.text : bookmark.url;
  section.appendChild(a);
  return section;
}

export { init };
