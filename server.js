import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';
import { t, languageNames } from './i18n.js';
import { generatePalette, paletteToCSS } from './colors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ── Config (all values must come from environment / .env) ────────────────────
function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`\n❌  Missing required environment variable: ${name}`);
    console.error(`    Create a .env file based on .env.example and set ${name}.\n`);
    process.exit(1);
  }
  return val;
}

const MASTER_PASSWORD = requireEnv('MASTER_PASSWORD');
const SESSION_SECRET  = requireEnv('SESSION_SECRET');
const BASE_URL        = requireEnv('BASE_URL').replace(/\/$/, ''); // strip trailing slash
const PORT            = process.env.PORT || 3000;

// DATA_DIR defaults to ./data locally; Docker sets it to /app/data via ENV
const DATA_DIR      = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE       = path.join(DATA_DIR, 'db.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const UPLOADS_DIR   = path.join(DATA_DIR, 'uploads');

mkdirSync(UPLOADS_DIR, { recursive: true });

const DEFAULT_SETTINGS = {
  companyName: 'Lynkivo', accentColor: '#00e5ff', theme: 'dark', language: 'de',
  logo: null, favicon: null, privacyUrl: '', imprintUrl: '', termsUrl: '',
};

// ── Persistence ───────────────────────────────────────────────────────────────
function loadDB() {
  if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, JSON.stringify({ links: {} }));
  return JSON.parse(readFileSync(DB_FILE, 'utf8'));
}
function saveDB(db) { writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function loadSettings() {
  if (!existsSync(SETTINGS_FILE)) writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
  return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) };
}
function saveSettings(s) { writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2)); }

// ── File upload ───────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${req.params.type}_${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({ secret: SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { httpOnly: true, maxAge: 86400000 } }));
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Helpers ───────────────────────────────────────────────────────────────────
const getCSS = s => paletteToCSS(generatePalette(s.accentColor || '#00e5ff', s.theme || 'dark'));

function faviconTag(s) {
  return s.favicon
    ? `<link rel="icon" href="/uploads/${s.favicon}">`
    : `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='${encodeURIComponent(s.accentColor||'#00e5ff')}'/><text x='50%' y='58%' dominant-baseline='middle' text-anchor='middle' font-size='18' font-family='serif' fill='%230a0a0a'>⚡</text></svg>">`;
}

const fonts = () => `<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;800&display=swap" rel="stylesheet">`;

function baseCSS(vars) {
  return `<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{${vars}}
body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;min-height:100vh}
a{color:inherit;text-decoration:none}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
input[type=text],input[type=url],input[type=password]{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'DM Mono',monospace;font-size:.875rem;padding:10px 14px;border-radius:8px;outline:none;transition:border-color .2s,box-shadow .2s}
input[type=color]{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:4px 8px;height:42px;cursor:pointer;outline:none}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 15%,transparent)}
select{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:'DM Mono',monospace;font-size:.875rem;padding:10px 14px;border-radius:8px;outline:none;cursor:pointer;transition:border-color .2s}
select:focus{border-color:var(--accent)}
.btn-primary{background:var(--accent);color:var(--accent-text);font-family:'DM Mono',monospace;font-weight:500;font-size:.85rem;border:none;border-radius:8px;padding:11px 22px;cursor:pointer;transition:opacity .15s,transform .1s;white-space:nowrap;letter-spacing:.02em;display:inline-flex;align-items:center;gap:6px}
.btn-primary:hover{opacity:.88;transform:translateY(-1px)}
.btn-primary:active{transform:translateY(0)}
.btn-ghost{background:none;border:1px solid var(--border);color:var(--muted);font-family:'DM Mono',monospace;font-size:.78rem;padding:6px 14px;border-radius:6px;cursor:pointer;transition:all .15s}
.btn-ghost:hover{border-color:var(--accent);color:var(--accent)}
.btn-edit{background:none;border:1px solid var(--border);color:var(--text);font-family:'DM Mono',monospace;font-size:.75rem;padding:5px 10px;border-radius:5px;cursor:pointer;transition:all .15s}
.btn-edit:hover{border-color:var(--accent);color:var(--accent)}
.btn-del{background:none;border:1px solid transparent;color:var(--muted);font-family:'DM Mono',monospace;font-size:.75rem;padding:5px 10px;border-radius:5px;cursor:pointer;transition:all .15s}
.btn-del:hover{border-color:var(--danger);color:var(--danger)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.card-accent{position:relative}.card-accent::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--accent),var(--accent2));z-index:1}
.card-body{padding:26px}
.field-label{display:block;font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px}
.section-title{font-family:'Syne',sans-serif;font-weight:800;font-size:.68rem;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:14px}
#toast{position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px}
.toast-item{padding:11px 16px;border-radius:9px;font-size:.8rem;animation:sIn .22s ease;max-width:300px;backdrop-filter:blur(8px)}
.toast-ok{background:color-mix(in srgb,var(--accent) 12%,var(--surface));border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);color:var(--accent)}
.toast-err{background:color-mix(in srgb,var(--danger) 12%,var(--surface));border:1px solid color-mix(in srgb,var(--danger) 35%,transparent);color:var(--danger)}
@keyframes sIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
.modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);align-items:center;justify-content:center;z-index:200}
.modal-bg.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:32px;width:100%;max-width:440px;animation:mIn .18s ease}
@keyframes mIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
nav{border-bottom:1px solid var(--border);padding:14px 32px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px}
.nav-left{display:flex;align-items:center}
.nav-center{display:flex;gap:4px;justify-content:center}
.nav-right{display:flex;justify-content:flex-end}
.wordmark{font-family:'Syne',sans-serif;font-weight:800;font-size:1.2rem;color:var(--accent);letter-spacing:-.02em}
.nav-link{font-size:.78rem;color:var(--muted);padding:7px 14px;border-radius:6px;transition:all .15s}
.nav-link:hover{color:var(--text);background:var(--surface2)}
.nav-link.active{color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}
</style>`;
}

function adminNav(s, active) {
  const lang = s.language || 'de';
  const logo = s.logo
    ? `<img src="/uploads/${s.logo}" style="height:28px;object-fit:contain" alt="">`
    : `<span class="wordmark">${s.companyName || 'Lynkivo'}</span>`;
  return `<nav>
    <div class="nav-left">${logo}</div>
    <div class="nav-center">
      <a href="/admin" class="nav-link ${active==='links'?'active':''}">${t(lang,'nav_links')}</a>
      <a href="/admin/settings" class="nav-link ${active==='settings'?'active':''}">${t(lang,'nav_settings')}</a>
    </div>
    <div class="nav-right">
      <form method="POST" action="/logout"><button class="btn-ghost" type="submit">${t(lang,'nav_logout')}</button></form>
    </div>
  </nav>`;
}

// ── Auth guards ───────────────────────────────────────────────────────────────
function apiAuth(req, res, next) {
  const h = req.headers['authorization'] || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : h;
  if (tok !== MASTER_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function webAuth(req, res, next) {
  if (!req.session.authenticated) return res.redirect('/login');
  next();
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════
app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/admin');
  res.send(loginPage(loadSettings()));
});
app.post('/login', (req, res) => {
  const s = loadSettings();
  if (req.body.password === MASTER_PASSWORD) { req.session.authenticated = true; return res.redirect('/admin'); }
  res.send(loginPage(s, true));
});
app.post('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

function loginPage(s, err = false) {
  const lang = s.language || 'de';
  const css = getCSS(s);
  const logoHtml = s.logo
    ? `<img src="/uploads/${s.logo}" style="max-height:52px;max-width:200px;object-fit:contain;margin-bottom:20px" alt="">`
    : `<div class="wordmark" style="font-size:2rem;margin-bottom:6px">${s.companyName||'Lynkivo'}</div>`;
  const legal = [
    s.privacyUrl ? `<a href="${s.privacyUrl}" target="_blank">${t(lang,'login_privacy')}</a>` : '',
    s.imprintUrl ? `<a href="${s.imprintUrl}" target="_blank">${t(lang,'login_imprint')}</a>` : '',
    s.termsUrl   ? `<a href="${s.termsUrl}"   target="_blank">${t(lang,'login_terms')}</a>`   : '',
  ].filter(Boolean).join('<span style="opacity:.35">·</span>');
  return `<!DOCTYPE html><html lang="${lang}"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${s.companyName||'Lynkivo'} · ${t(lang,'login_title')}</title>
${faviconTag(s)}${fonts()}${baseCSS(css)}
<style>
body{display:flex;flex-direction:column;align-items:center;justify-content:center;
  background-image:radial-gradient(ellipse 80% 55% at 50% -5%,var(--glow) 0%,transparent 70%)}
.wrap{width:100%;max-width:400px;padding:24px}
.sub{color:var(--muted);font-size:.78rem;margin-bottom:34px}
.err{background:color-mix(in srgb,var(--danger) 10%,var(--surface2));border:1px solid color-mix(in srgb,var(--danger) 35%,transparent);border-radius:8px;padding:10px 14px;font-size:.8rem;color:var(--danger);margin-bottom:14px}
.legal{text-align:center;margin-top:20px;font-size:.71rem;color:var(--muted);display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.legal a{color:var(--muted);transition:color .15s}.legal a:hover{color:var(--accent)}
</style></head><body>
<div class="wrap">
  <div class="card card-accent" style="padding:44px 40px">
    ${logoHtml}
    <div class="sub">${t(lang,'login_subtitle')}</div>
    ${err?`<div class="err">⚠ ${t(lang,'login_error')}</div>`:''}
    <form method="POST" action="/login">
      <label class="field-label" for="pw">${t(lang,'login_password_label')}</label>
      <input type="password" id="pw" name="password" autofocus autocomplete="current-password" placeholder="••••••••••">
      <button class="btn-primary" type="submit" style="width:100%;margin-top:18px;justify-content:center">${t(lang,'login_button')} →</button>
    </form>
  </div>
  ${legal?`<div class="legal">${legal}</div>`:''}
</div></body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
app.get('/admin', webAuth, (req, res) => res.send(dashboardPage(loadSettings(), loadDB().links, req.query)));

app.post('/admin/create', webAuth, (req, res) => {
  const { slug, target } = req.body;
  if (!target) return res.redirect('/admin?error=missing_target');
  const db = loadDB();
  const key = slug?.trim() || nanoid(7);
  if (db.links[key]) return res.redirect(`/admin?error=slug_taken&slug=${encodeURIComponent(key)}`);
  db.links[key] = { target: target.trim(), created: new Date().toISOString(), hits: 0 };
  saveDB(db);
  res.redirect(`/admin?success=created&slug=${encodeURIComponent(key)}`);
});
app.post('/admin/delete/:slug', webAuth, (req, res) => {
  const db = loadDB(); delete db.links[req.params.slug]; saveDB(db);
  res.redirect('/admin?success=deleted');
});
app.post('/admin/update/:slug', webAuth, (req, res) => {
  const { target } = req.body;
  const db = loadDB();
  if (!db.links[req.params.slug]) return res.redirect('/admin?error=not_found');
  db.links[req.params.slug].target = target.trim(); saveDB(db);
  res.redirect('/admin?success=updated');
});

function dashboardPage(s, links, q = {}) {
  const lang = s.language || 'de';
  const css = getCSS(s);
  const entries = Object.entries(links);
  const successKey = {created:'toast_created',deleted:'toast_deleted',updated:'toast_updated'}[q.success]||'';
  const errorKey   = {slug_taken:'toast_error_slug_taken',missing_target:'toast_error_missing_target',not_found:'toast_error_not_found'}[q.error]||'';
  const toastJS    = successKey ? `showToast('ok','${t(lang,successKey)}${q.slug?': /'+q.slug:''}')` :
                     errorKey   ? `showToast('err','${t(lang,errorKey)}${q.slug?': /'+q.slug:''}')` : '';

  const rows = !entries.length
    ? `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:48px">${t(lang,'dash_no_links')}</td></tr>`
    : entries.map(([slug,d])=>{
        const date = new Date(d.created).toLocaleDateString(lang==='de'?'de-DE':lang==='fr'?'fr-FR':'en-US',{day:'2-digit',month:'2-digit',year:'2-digit'});
        const safeTarget = d.target.replace(/"/g,'&quot;').replace(/'/g,"\\'");
        return `<tr>
          <td><div style="display:flex;align-items:center;gap:8px">
            <a href="/${slug}" target="_blank" style="color:var(--accent);font-weight:500">/${slug}</a>
            <button class="copy-btn" onclick="doCopy(this,'${slug}')" title="Copy" style="background:none;border:none;color:var(--muted);cursor:pointer;display:flex;padding:2px;border-radius:4px;transition:color .15s">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div></td>
          <td style="color:var(--muted);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${d.target.replace(/"/g,'&quot;')}">${d.target}</td>
          <td style="color:var(--accent2);font-weight:500">${d.hits}</td>
          <td style="color:var(--muted);font-size:.75rem">${date}</td>
          <td><div style="display:flex;gap:6px;align-items:center">
            <button class="btn-edit" onclick="openEdit('${slug}','${safeTarget}')">${t(lang,'dash_edit')}</button>
            <form method="POST" action="/admin/delete/${slug}" style="display:inline" onsubmit="return confirm('/${slug} ${t(lang,'dash_delete_confirm')}')">
              <button class="btn-del" type="submit">${t(lang,'dash_delete')}</button>
            </form>
          </div></td>
        </tr>`;
      }).join('');

  return `<!DOCTYPE html><html lang="${lang}"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${s.companyName||'Lynkivo'} · ${t(lang,'nav_links')}</title>
${faviconTag(s)}${fonts()}${baseCSS(css)}
<style>
body{background-image:radial-gradient(ellipse 70% 30% at 85% -5%,var(--glow) 0%,transparent 55%),radial-gradient(ellipse 50% 25% at -5% 85%,var(--glow2) 0%,transparent 55%)}
main{max-width:1100px;margin:0 auto;padding:40px 32px}
.pg-hdr{display:flex;align-items:baseline;gap:12px;margin-bottom:26px}
.pg-num{font-family:'Syne',sans-serif;font-weight:800;font-size:1.5rem}
.pg-sub{color:var(--muted);font-size:.8rem}
.form-row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
.fg{flex:1;min-width:140px}
table{width:100%;border-collapse:collapse}
thead th{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);padding:10px 14px;border-bottom:1px solid var(--border);text-align:left}
tbody tr{border-bottom:1px solid var(--border);transition:background .1s}
tbody tr:hover{background:var(--surface2)}
tbody td{padding:12px 14px;font-size:.83rem;vertical-align:middle}
.copy-btn:hover{color:var(--accent) !important}
.modal h3{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;margin-bottom:20px}
.m-actions{display:flex;gap:10px;margin-top:20px}
</style></head><body>
${adminNav(s,'links')}
<div id="toast"></div>
<main>
  <div class="pg-hdr"><span class="pg-num">${entries.length}</span><span class="pg-sub">// ${entries.length} ${entries.length===1?t(lang,'dash_subtitle_one'):t(lang,'dash_subtitle_many')}</span></div>
  <div class="card card-accent" style="margin-bottom:24px"><div class="card-body">
    <div class="section-title">${t(lang,'dash_create_title')}</div>
    <form method="POST" action="/admin/create">
      <div class="form-row">
        <div class="fg" style="flex:2"><label class="field-label">${t(lang,'dash_target_label')} *</label><input type="url" name="target" placeholder="https://example.com/long/url" required></div>
        <div class="fg"><label class="field-label">${t(lang,'dash_slug_label')}</label><input type="text" name="slug" placeholder="${t(lang,'dash_slug_placeholder')}"></div>
        <button class="btn-primary" type="submit">${t(lang,'dash_create_button')}</button>
      </div>
    </form>
  </div></div>
  <div class="card">
    <table>
      <thead><tr><th>${t(lang,'dash_col_short')}</th><th>${t(lang,'dash_col_target')}</th><th>${t(lang,'dash_col_hits')}</th><th>${t(lang,'dash_col_created')}</th><th>${t(lang,'dash_col_actions')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</main>
<div class="modal-bg" id="modal">
  <div class="modal">
    <h3>${t(lang,'edit_title')}</h3>
    <form method="POST" id="editForm">
      <label class="field-label">${t(lang,'edit_new_target')}</label>
      <input type="url" name="target" id="editTarget" required>
      <div class="m-actions">
        <button type="button" class="btn-ghost" onclick="closeModal()" style="flex:1">${t(lang,'edit_cancel')}</button>
        <button type="submit" class="btn-primary" style="flex:1;justify-content:center">${t(lang,'edit_save')}</button>
      </div>
    </form>
  </div>
</div>
<script>
function openEdit(slug,target){document.getElementById('editTarget').value=target;document.getElementById('editForm').action='/admin/update/'+slug;document.getElementById('modal').classList.add('open');setTimeout(()=>document.getElementById('editTarget').focus(),50)}
function closeModal(){document.getElementById('modal').classList.remove('open')}
document.getElementById('modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()})
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()})
async function doCopy(btn,slug){await navigator.clipboard.writeText(location.origin+'/'+slug);btn.style.color='var(--accent)';showToast('ok','${t(lang,'dash_copy')}');setTimeout(()=>btn.style.color='',1500)}
function showToast(type,msg){const w=document.getElementById('toast');const el=document.createElement('div');el.className='toast-item toast-'+type;el.textContent=msg;w.appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300)},3000)}
${toastJS?`window.addEventListener('load',()=>${toastJS})`:''}</script>
</body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════════════════
app.get('/admin/settings', webAuth, (req, res) => res.send(settingsPage(loadSettings(), req.query)));

app.post('/admin/settings', webAuth, (req, res) => {
  const s = loadSettings();
  const { companyName, accentColor, theme, language, privacyUrl, imprintUrl, termsUrl } = req.body;
  if (companyName !== undefined) s.companyName = companyName.trim();
  if (accentColor) s.accentColor = accentColor;
  if (theme) s.theme = theme;
  if (language) s.language = language;
  s.privacyUrl = (privacyUrl||'').trim();
  s.imprintUrl = (imprintUrl||'').trim();
  s.termsUrl   = (termsUrl  ||'').trim();
  saveSettings(s);
  res.redirect('/admin/settings?success=1');
});

app.post('/admin/settings/upload/:type', webAuth, upload.single('file'), (req, res) => {
  const type = req.params.type;
  if (!['logo','favicon'].includes(type)) return res.redirect('/admin/settings?error=1');
  const s = loadSettings();
  if (s[type]) { try { unlinkSync(path.join(UPLOADS_DIR, s[type])); } catch {} }
  s[type] = req.file ? req.file.filename : null;
  saveSettings(s);
  res.redirect('/admin/settings?success=1');
});

app.post('/admin/settings/remove/:type', webAuth, (req, res) => {
  const type = req.params.type;
  if (!['logo','favicon'].includes(type)) return res.redirect('/admin/settings?error=1');
  const s = loadSettings();
  if (s[type]) { try { unlinkSync(path.join(UPLOADS_DIR, s[type])); } catch {} s[type] = null; saveSettings(s); }
  res.redirect('/admin/settings?success=1');
});

function settingsPage(s, q = {}) {
  const lang = s.language || 'de';
  const css = getCSS(s);
  const toastJS = q.success ? `window.addEventListener('load',()=>showToast('ok','${t(lang,'toast_settings_saved')}'))` : '';
  const langOpts = Object.entries(languageNames).map(([c,n])=>`<option value="${c}"${s.language===c?' selected':''}>${n}</option>`).join('');

  const logoPreview = s.logo
    ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><img src="/uploads/${s.logo}" style="max-height:44px;max-width:160px;object-fit:contain" alt="logo"><form method="POST" action="/admin/settings/remove/logo" style="display:inline"><button class="btn-ghost" type="submit">${t(lang,'settings_remove')}</button></form></div>`
    : `<p style="font-size:.75rem;color:var(--muted);font-style:italic;margin-bottom:12px">— ${t(lang,'settings_current')}: Standard —</p>`;
  const faviconPreview = s.favicon
    ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><img src="/uploads/${s.favicon}" style="width:32px;height:32px;object-fit:contain;image-rendering:pixelated" alt="favicon"><form method="POST" action="/admin/settings/remove/favicon" style="display:inline"><button class="btn-ghost" type="submit">${t(lang,'settings_remove')}</button></form></div>`
    : `<p style="font-size:.75rem;color:var(--muted);font-style:italic;margin-bottom:12px">— ${t(lang,'settings_current')}: Standard —</p>`;

  return `<!DOCTYPE html><html lang="${lang}"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${s.companyName||'Lynkivo'} · ${t(lang,'settings_title')}</title>
${faviconTag(s)}${fonts()}${baseCSS(css)}
<style>
body{background-image:radial-gradient(ellipse 60% 35% at 100% 0%,var(--glow2) 0%,transparent 55%)}
main{max-width:720px;margin:0 auto;padding:40px 32px}
.pg-title{font-family:'Syne',sans-serif;font-weight:800;font-size:1.5rem;margin-bottom:30px}
.sec{margin-bottom:24px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:540px){.grid2{grid-template-columns:1fr}}
.full{grid-column:1/-1}
.hint{font-size:.72rem;color:var(--muted);margin-top:5px}
.theme-row{display:flex;gap:8px}
.t-btn{flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:none;color:var(--muted);font-family:'DM Mono',monospace;font-size:.82rem;cursor:pointer;transition:all .15s}
.t-btn.on{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}
.upload-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.meth{padding:2px 8px;border-radius:4px;font-weight:500;font-size:.68rem;min-width:52px;text-align:center;font-family:'DM Mono',monospace}
.GET{background:color-mix(in srgb,var(--accent2) 15%,transparent);color:var(--accent2)}
.POST{background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent)}
.PUT{background:color-mix(in srgb,var(--warning) 15%,transparent);color:var(--warning)}
.DEL{background:color-mix(in srgb,var(--danger) 15%,transparent);color:var(--danger)}
code{background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:2px 7px;font-size:.78rem;color:var(--accent);font-family:'DM Mono',monospace}
</style></head><body>
${adminNav(s,'settings')}
<div id="toast"></div>
<main>
  <div class="pg-title">${t(lang,'settings_title')}</div>

  <form method="POST" action="/admin/settings">
    <!-- Branding -->
    <div class="sec">
      <div class="section-title">${t(lang,'settings_branding')}</div>
      <div class="card card-accent"><div class="card-body">
        <label class="field-label">${t(lang,'settings_company_name')}</label>
        <input type="text" name="companyName" value="${(s.companyName||'').replace(/"/g,'&quot;')}" placeholder="${t(lang,'settings_company_placeholder')}">
      </div></div>
    </div>

    <!-- Appearance -->
    <div class="sec">
      <div class="section-title">${t(lang,'settings_appearance')}</div>
      <div class="card card-accent"><div class="card-body">
        <div class="grid2">
          <div>
            <label class="field-label">${t(lang,'settings_theme')}</label>
            <div class="theme-row">
              <button type="button" class="t-btn${s.theme!=='light'?' on':''}" onclick="setTheme('dark',this)">${t(lang,'settings_theme_dark')}</button>
              <button type="button" class="t-btn${s.theme==='light'?' on':''}" onclick="setTheme('light',this)">${t(lang,'settings_theme_light')}</button>
            </div>
            <input type="hidden" name="theme" id="themeInput" value="${s.theme||'dark'}">
          </div>
          <div>
            <label class="field-label">${t(lang,'settings_language')}</label>
            <select name="language">${langOpts}</select>
          </div>
          <div class="full">
            <label class="field-label">${t(lang,'settings_accent_color')}</label>
            <div style="display:flex;gap:12px;align-items:center">
              <input type="color" name="accentColor" id="cp" value="${s.accentColor||'#00e5ff'}" style="width:54px;flex-shrink:0">
              <input type="text" id="hexIn" value="${s.accentColor||'#00e5ff'}" placeholder="#00e5ff" style="max-width:140px" oninput="syncHex(this)">
            </div>
            <div class="hint">${t(lang,'settings_accent_hint')}</div>
          </div>
        </div>
      </div></div>
    </div>

    <!-- Legal -->
    <div class="sec">
      <div class="section-title">${t(lang,'settings_legal')}</div>
      <div class="card card-accent"><div class="card-body">
        <div class="grid2">
          <div><label class="field-label">${t(lang,'settings_privacy_url')}</label><input type="url" name="privacyUrl" value="${s.privacyUrl||''}" placeholder="https://..."></div>
          <div><label class="field-label">${t(lang,'settings_imprint_url')}</label><input type="url" name="imprintUrl" value="${s.imprintUrl||''}" placeholder="https://..."></div>
          <div class="full"><label class="field-label">${t(lang,'settings_terms_url')}</label><input type="url" name="termsUrl" value="${s.termsUrl||''}" placeholder="https://...">
          <div class="hint">${t(lang,'settings_legal_hint')}</div></div>
        </div>
      </div></div>
    </div>

    <button class="btn-primary" type="submit" style="width:100%;padding:13px;justify-content:center">${t(lang,'settings_save')}</button>
  </form>

  <!-- Logo -->
  <div class="sec" style="margin-top:28px">
    <div class="section-title">${t(lang,'settings_logo')}</div>
    <div class="card card-accent"><div class="card-body">
      <p class="hint" style="margin-bottom:12px">${t(lang,'settings_logo_hint')}</p>
      ${logoPreview}
      <form method="POST" action="/admin/settings/upload/logo" enctype="multipart/form-data">
        <div class="upload-row">
          <input type="file" name="file" accept="image/png,image/svg+xml,image/jpeg,image/gif,image/webp" style="font-size:.78rem;color:var(--muted);background:none;border:none;padding:0;width:auto">
          <button class="btn-primary" type="submit">${t(lang,'settings_upload_logo')}</button>
        </div>
      </form>
    </div></div>
  </div>

  <!-- Favicon -->
  <div class="sec">
    <div class="section-title">${t(lang,'settings_favicon')}</div>
    <div class="card card-accent"><div class="card-body">
      <p class="hint" style="margin-bottom:12px">${t(lang,'settings_favicon_hint')}</p>
      ${faviconPreview}
      <form method="POST" action="/admin/settings/upload/favicon" enctype="multipart/form-data">
        <div class="upload-row">
          <input type="file" name="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml" style="font-size:.78rem;color:var(--muted);background:none;border:none;padding:0;width:auto">
          <button class="btn-primary" type="submit">${t(lang,'settings_upload_favicon')}</button>
        </div>
      </form>
    </div></div>
  </div>

  <!-- API -->
  <div class="sec">
    <div class="section-title">${t(lang,'settings_api')}</div>
    <div class="card"><div class="card-body">
      <p style="font-size:.8rem;color:var(--muted);margin-bottom:16px">${t(lang,'settings_api_auth')}: <code>Authorization: Bearer ••••••••</code></p>
      <div style="display:flex;flex-direction:column;gap:9px">
        <div style="display:flex;gap:10px;align-items:baseline;font-size:.78rem"><span class="meth GET">GET</span><span>/api/links</span><span style="color:var(--muted)">— ${t(lang,'api_list')}</span></div>
        <div style="display:flex;gap:10px;align-items:baseline;font-size:.78rem"><span class="meth POST">POST</span><span>/api/links</span><span style="color:var(--muted)">— ${t(lang,'api_create')}</span></div>
        <div style="display:flex;gap:10px;align-items:baseline;font-size:.78rem"><span class="meth PUT">PUT</span><span>/api/links/:slug</span><span style="color:var(--muted)">— ${t(lang,'api_update')}</span></div>
        <div style="display:flex;gap:10px;align-items:baseline;font-size:.78rem"><span class="meth DEL">DELETE</span><span>/api/links/:slug</span><span style="color:var(--muted)">— ${t(lang,'api_delete')}</span></div>
      </div>
    </div></div>
  </div>
</main>
<script>
function setTheme(v,btn){document.getElementById('themeInput').value=v;document.querySelectorAll('.t-btn').forEach(b=>b.classList.remove('on'));btn.classList.add('on')}
const cp=document.getElementById('cp'),hx=document.getElementById('hexIn');
cp.addEventListener('input',()=>hx.value=cp.value);
function syncHex(el){if(/^#[0-9a-fA-F]{6}$/.test(el.value))cp.value=el.value}
function showToast(type,msg){const w=document.getElementById('toast');const el=document.createElement('div');el.className='toast-item toast-'+type;el.textContent=msg;w.appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300)},3200)}
${toastJS}</script>
</body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// REST API
// ════════════════════════════════════════════════════════════════════════════
const api = express.Router();
api.use(apiAuth);
api.get('/links', (req, res) => {
  const db = loadDB();
  res.json({ count: Object.keys(db.links).length, links: Object.entries(db.links).map(([slug,d])=>({slug,...d,shortUrl:`${BASE_URL}/${slug}`})) });
});
api.post('/links', (req, res) => {
  const { slug, target } = req.body;
  if (!target) return res.status(400).json({ error: '`target` is required' });
  const db = loadDB();
  const key = slug?.trim() || nanoid(7);
  if (db.links[key]) return res.status(409).json({ error: `Slug "${key}" already exists` });
  db.links[key] = { target: target.trim(), created: new Date().toISOString(), hits: 0 };
  saveDB(db);
  res.status(201).json({ slug: key, target: target.trim(), shortUrl: `${BASE_URL}/${key}` });
});
api.put('/links/:slug', (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: '`target` is required' });
  const db = loadDB();
  if (!db.links[req.params.slug]) return res.status(404).json({ error: 'Not found' });
  db.links[req.params.slug].target = target.trim(); saveDB(db);
  res.json({ slug: req.params.slug, target: target.trim() });
});
api.delete('/links/:slug', (req, res) => {
  const db = loadDB();
  if (!db.links[req.params.slug]) return res.status(404).json({ error: 'Not found' });
  delete db.links[req.params.slug]; saveDB(db);
  res.json({ message: `Slug "${req.params.slug}" deleted` });
});
app.use('/api', api);
app.get('/api/settings', apiAuth, (req, res) => {
  const s = loadSettings();
  res.json({ companyName: s.companyName, theme: s.theme, language: s.language, accentColor: s.accentColor });
});

// ── Redirect ──────────────────────────────────────────────────────────────────
const RESERVED = new Set(['admin','login','logout','api','uploads']);
app.get('/:slug', (req, res) => {
  if (RESERVED.has(req.params.slug)) return res.status(404).send('Not found');
  const db = loadDB();
  const link = db.links[req.params.slug];
  if (!link) { const s = loadSettings(); return res.status(404).send(notFoundPage(s, req.params.slug)); }
  db.links[req.params.slug].hits++;
  saveDB(db);
  res.redirect(302, link.target);
});
app.get('/', (req, res) => res.redirect('/admin'));

function notFoundPage(s, slug) {
  const lang = s.language||'de';
  const css = getCSS(s);
  return `<!DOCTYPE html><html lang="${lang}"><head>
<meta charset="UTF-8"><title>404 · ${s.companyName||'Lynkivo'}</title>
${faviconTag(s)}${fonts()}${baseCSS(css)}
<style>body{display:flex;align-items:center;justify-content:center;text-align:center;background-image:radial-gradient(ellipse 60% 40% at 50% 20%,var(--glow) 0%,transparent 65%)}
.n{font-family:'Syne',sans-serif;font-weight:800;font-size:8rem;line-height:1;color:var(--accent);opacity:.9}
.m{color:var(--muted);margin:8px 0 24px;font-size:.9rem}</style></head><body>
<div><div class="n">404</div><div class="m">/${slug} — ${t(lang,'not_found_text')}</div>
<a href="/" class="btn-ghost" style="display:inline-block">${t(lang,'not_found_back')}</a></div>
</body></html>`;
}

// ── Start ─────────────────────────────────────────────────────────────────────
// Bind to 0.0.0.0 so Docker port-mapping works correctly
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n⚡ Lynkivo läuft auf http://0.0.0.0:${PORT}`);
  console.log(`   Base URL:  ${BASE_URL}`);
  console.log(`   Admin:     ${BASE_URL}/admin\n`);
});