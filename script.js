/* =============================================================
   TIME CAPSULE — PRIVATE EDITION
   Browser-native cryptography. No backend or network requests.
   Existing v1 storage format is preserved for compatibility.
   ============================================================= */

'use strict';

const PBKDF2_ITERATIONS = 210_000;
const STORAGE_KEY = 'tc_capsules_v1';
const DEMO_ID = 'demo_capsule_001';

// ── Utility ──────────────────────────────────────────────────
function randomBytes(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toB64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromB64(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function sha256Hex(data) {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function escHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function showToast(message, duration = 2800) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Cryptography ─────────────────────────────────────────────
async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, hash: 'SHA-256', iterations: PBKDF2_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptMessage(message, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(message)
  );
  const encoded = toB64(ciphertext);
  return {
    ciphertext: encoded,
    salt: toB64(salt),
    iv: toB64(iv),
    fingerprint: await sha256Hex(encoded)
  };
}

async function decryptMessage(encrypted, password) {
  const salt = fromB64(encrypted.salt);
  const iv = fromB64(encrypted.iv);
  const ciphertext = fromB64(encrypted.ciphertext);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ── Local storage ────────────────────────────────────────────
function loadCapsules() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveCapsules(capsules) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capsules));
}

// ── Demo capsule ─────────────────────────────────────────────
async function seedDemo() {
  const capsules = loadCapsules();
  if (capsules.some(capsule => capsule.id === DEMO_ID)) return;

  const encrypted = await encryptMessage(
    'Hello, future me!\n\nThis is a demonstration of Time Capsule. This message was encrypted in your browser using AES-256-GCM before being saved to LocalStorage.\n\nDemo password: demo1234\n\nYour words are waiting for you.',
    'demo1234'
  );

  capsules.unshift({
    id: DEMO_ID,
    title: 'Demo Capsule — Open Me',
    unlockAt: new Date(Date.now() - 1000).toISOString(),
    createdAt: new Date().toISOString(),
    isDemo: true,
    ...encrypted
  });
  saveCapsules(capsules);
}

// ── Date formatting ──────────────────────────────────────────
function formatCountdown(unlockAt) {
  const diff = new Date(unlockAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function updateCounts(capsules = loadCapsules()) {
  const total = capsules.length;
  const locked = capsules.filter(capsule => new Date(capsule.unlockAt).getTime() > Date.now()).length;
  for (const id of ['totalCount', 'heroTotal']) {
    const node = document.getElementById(id);
    if (node) node.textContent = total;
  }
  for (const id of ['lockedCount', 'heroLocked']) {
    const node = document.getElementById(id);
    if (node) node.textContent = locked;
  }
}

// ── Capsule card rendering ───────────────────────────────────
function buildCardHTML(capsule) {
  const unlockTime = new Date(capsule.unlockAt).getTime();
  const isReady = unlockTime <= Date.now();
  const dateLabel = formatDate(capsule.unlockAt);
  const badge = capsule.isDemo
    ? '<span class="capsule-badge badge-demo">Demo</span>'
    : isReady
      ? '<span class="capsule-badge badge-ready">Ready</span>'
      : '<span class="capsule-badge badge-locked">Locked</span>';
  const fingerprint = capsule.fingerprint
    ? `<div class="capsule-fp">SHA-256 · ${escHtml(capsule.fingerprint.slice(0, 32))}…</div>`
    : '';
  const countdown = isReady
    ? `<div class="capsule-status">Available since ${escHtml(dateLabel)}</div>`
    : `<div class="capsule-countdown" data-countdown>${escHtml(formatCountdown(capsule.unlockAt) || 'Less than a minute')}</div>
       <div class="capsule-meta">Unlocks ${escHtml(dateLabel)}</div>`;
  const openButton = isReady
    ? `<button class="card-btn card-btn-open" type="button" data-id="${escHtml(capsule.id)}" data-action="open">Open capsule</button>`
    : `<button class="card-btn" type="button" disabled>Locked</button>`;

  return `
    <article class="capsule-card spotlight-card${capsule.isDemo ? ' is-demo' : ''}${isReady ? ' is-unlockable' : ''}"
      data-id="${escHtml(capsule.id)}"${isReady ? '' : ` data-unlock-at="${unlockTime}"`}>
      <div class="capsule-head">
        <span class="capsule-icon" id="icon_${escHtml(capsule.id)}" aria-hidden="true">${isReady ? '🔓' : '🔒'}</span>
        ${badge}
      </div>
      <h3 class="capsule-title">${escHtml(capsule.title)}</h3>
      ${countdown}
      ${fingerprint}
      <div class="capsule-actions">
        ${openButton}
        <button class="card-btn card-btn-delete" type="button" data-id="${escHtml(capsule.id)}" data-action="delete">Delete</button>
      </div>
    </article>`;
}

function renderCapsules() {
  const capsules = loadCapsules();
  const grid = document.getElementById('capsuleGrid');
  updateCounts(capsules);

  if (!capsules.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">⧗</div>
        <h3 class="empty-title">Your timeline starts here</h3>
        <p class="empty-body">Seal your first message. It will wait here until the moment you choose.</p>
      </div>`;
    return;
  }
  grid.innerHTML = capsules.map(buildCardHTML).join('');
}

// Update countdown text in-place. Cards are rebuilt only when a capsule
// crosses its unlock boundary or when the user changes stored data.
function updateCountdowns() {
  let changedState = false;
  document.querySelectorAll('.capsule-card[data-unlock-at]').forEach(card => {
    const unlockAt = Number(card.dataset.unlockAt);
    const countdown = card.querySelector('[data-countdown]');
    if (unlockAt <= Date.now()) {
      changedState = true;
      return;
    }
    if (countdown) {
      const text = formatCountdown(unlockAt);
      if (text && countdown.textContent !== text) countdown.textContent = text;
    }
  });
  if (changedState) renderCapsules();
}

// ── Modal helpers ────────────────────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('is-open');
  if (!document.querySelector('.modal-overlay.is-open')) document.body.style.overflow = '';
}

function setDefaultUnlockDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60);
  const localValue = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const minValue = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  document.getElementById('unlockDate').min = minValue;
  document.getElementById('unlockDate').value = localValue;
}

function openCreateModal() {
  document.getElementById('createForm').reset();
  setDefaultUnlockDate();
  document.getElementById('createError').textContent = '';
  openModal('createModal');
  document.getElementById('capsuleTitle').focus();
}

// ── Create flow ──────────────────────────────────────────────
document.getElementById('openCreateBtn').addEventListener('click', openCreateModal);
document.getElementById('navCreateBtn').addEventListener('click', openCreateModal);
document.getElementById('closingCreateBtn').addEventListener('click', openCreateModal);
document.getElementById('drawerCreateBtn').addEventListener('click', () => {
  closeDrawer();
  openCreateModal();
});
document.getElementById('closeCreateBtn').addEventListener('click', () => closeModal('createModal'));
document.getElementById('createModal').addEventListener('click', event => {
  if (event.target === event.currentTarget) closeModal('createModal');
});

document.getElementById('createForm').addEventListener('submit', async event => {
  event.preventDefault();
  const title = document.getElementById('capsuleTitle').value.trim();
  const message = document.getElementById('capsuleMessage').value;
  const unlockValue = document.getElementById('unlockDate').value;
  const password = document.getElementById('capsulePassword').value;
  const confirmation = document.getElementById('capsulePasswordConfirm').value;
  const error = document.getElementById('createError');
  const button = document.getElementById('createSubmitBtn');
  error.textContent = '';

  if (!title || !message.trim() || !unlockValue || !password) {
    error.textContent = 'Please complete every field.';
    return;
  }
  if (password !== confirmation) {
    error.textContent = 'The passwords do not match.';
    return;
  }
  if (password.length < 6) {
    error.textContent = 'Use a password with at least 6 characters.';
    return;
  }
  const unlockAt = new Date(unlockValue);
  if (!Number.isFinite(unlockAt.getTime()) || unlockAt.getTime() <= Date.now()) {
    error.textContent = 'Choose a future date and time.';
    return;
  }

  button.disabled = true;
  document.getElementById('createBtnText').textContent = 'Encrypting…';
  try {
    const encrypted = await encryptMessage(message, password);
    const capsule = {
      id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      unlockAt: unlockAt.toISOString(),
      createdAt: new Date().toISOString(),
      ...encrypted
    };
    const capsules = loadCapsules();
    capsules.unshift(capsule);
    saveCapsules(capsules);
    closeModal('createModal');
    renderCapsules();
    showToast('Capsule sealed and encrypted');
    document.getElementById('capsuleGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (errorObject) {
    error.textContent = `Encryption failed: ${errorObject.message || 'Unknown error'}`;
  } finally {
    button.disabled = false;
    document.getElementById('createBtnText').textContent = '🔒 Seal capsule';
  }
});

// ── Unlock flow ──────────────────────────────────────────────
let pendingUnlockId = null;

function startUnlock(id) {
  const capsule = loadCapsules().find(item => item.id === id);
  if (!capsule) return;
  if (new Date(capsule.unlockAt).getTime() > Date.now()) {
    showToast('This capsule is still locked.');
    return;
  }
  pendingUnlockId = id;
  document.getElementById('unlockModalTitle').textContent = capsule.title;
  document.getElementById('unlockPassword').value = '';
  document.getElementById('unlockError').textContent = '';
  openModal('unlockModal');
  document.getElementById('unlockPassword').focus();
}

document.getElementById('closeUnlockBtn').addEventListener('click', () => closeModal('unlockModal'));
document.getElementById('unlockModal').addEventListener('click', event => {
  if (event.target === event.currentTarget) closeModal('unlockModal');
});

async function submitUnlock() {
  const password = document.getElementById('unlockPassword').value;
  const error = document.getElementById('unlockError');
  const button = document.getElementById('unlockSubmitBtn');
  error.textContent = '';
  if (!password) {
    error.textContent = 'Enter the capsule password.';
    return;
  }
  const capsule = loadCapsules().find(item => item.id === pendingUnlockId);
  if (!capsule) {
    error.textContent = 'Capsule not found.';
    return;
  }
  button.disabled = true;
  document.getElementById('unlockBtnText').textContent = 'Decrypting…';
  try {
    const message = await decryptMessage(capsule, password);
    const fingerprint = await sha256Hex(capsule.ciphertext);
    const matches = fingerprint === capsule.fingerprint;
    closeModal('unlockModal');
    document.getElementById('revealTitle').textContent = capsule.title;
    document.getElementById('revealMeta').textContent = `Sealed ${formatDate(capsule.createdAt)} · Opened ${formatDate(new Date())}`;
    document.getElementById('revealMessage').textContent = message;
    document.getElementById('revealFingerprint').textContent = `SHA-256 fingerprint · ${fingerprint} · ${matches ? 'Fingerprint matches' : 'Fingerprint mismatch'}`;
    openModal('revealModal');
    const icon = document.getElementById(`icon_${pendingUnlockId}`);
    if (icon) {
      icon.textContent = '🔓';
      icon.classList.remove('lock-anim');
      void icon.offsetWidth;
      icon.classList.add('lock-anim');
    }
    showToast('Capsule opened successfully');
  } catch {
    error.textContent = 'Incorrect password or corrupted capsule.';
  } finally {
    button.disabled = false;
    document.getElementById('unlockBtnText').textContent = 'Open capsule';
  }
}

document.getElementById('unlockSubmitBtn').addEventListener('click', submitUnlock);
document.getElementById('unlockPassword').addEventListener('keydown', event => {
  if (event.key === 'Enter') submitUnlock();
});
document.getElementById('closeRevealBtn').addEventListener('click', () => closeModal('revealModal'));
document.getElementById('revealModal').addEventListener('click', event => {
  if (event.target === event.currentTarget) closeModal('revealModal');
});

// ── Delete flow ──────────────────────────────────────────────
let pendingDeleteId = null;
function startDelete(id) {
  const capsule = loadCapsules().find(item => item.id === id);
  if (!capsule) return;
  pendingDeleteId = id;
  document.getElementById('deleteModalNote').textContent = `“${capsule.title}” and its encrypted contents will be permanently deleted. This cannot be undone.`;
  openModal('deleteModal');
}

document.getElementById('closeDeleteBtn').addEventListener('click', () => closeModal('deleteModal'));
document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteModal'));
document.getElementById('deleteModal').addEventListener('click', event => {
  if (event.target === event.currentTarget) closeModal('deleteModal');
});
document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  const capsules = loadCapsules().filter(item => item.id !== pendingDeleteId);
  saveCapsules(capsules);
  closeModal('deleteModal');
  renderCapsules();
  showToast('Capsule deleted');
});

document.getElementById('capsuleGrid').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'open') startUnlock(button.dataset.id);
  if (button.dataset.action === 'delete') startDelete(button.dataset.id);
});

// ── Mobile navigation ────────────────────────────────────────
const navHamburger = document.getElementById('navHamburger');
const navDrawer = document.getElementById('navDrawer');
function closeDrawer() {
  navHamburger.setAttribute('aria-expanded', 'false');
  navDrawer.classList.remove('is-open');
  navDrawer.setAttribute('aria-hidden', 'true');
}
navHamburger.addEventListener('click', () => {
  const opening = navHamburger.getAttribute('aria-expanded') !== 'true';
  navHamburger.setAttribute('aria-expanded', String(opening));
  navDrawer.classList.toggle('is-open', opening);
  navDrawer.setAttribute('aria-hidden', String(!opening));
});
navDrawer.querySelectorAll('a').forEach(link => link.addEventListener('click', closeDrawer));

// ── Reveal-on-scroll ─────────────────────────────────────────
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(node => observer.observe(node));
} else {
  document.querySelectorAll('.reveal').forEach(node => node.classList.add('is-visible'));
}

// ── Ambient LightTunnel / LineWaves canvas ────────────────────
function initCosmos() {
  const canvas = document.getElementById('cosmosCanvas');
  const ctx = canvas && canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, raf = 0, t = 0;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(true);
  };
  const draw = (staticFrame = false) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * .52, cy = h * .34;
    // Fine perspective rays: an understated tunnel rather than a heavy particle field.
    const rays = 34;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + (staticFrame ? 0 : t * .000035);
      const inner = 32 + (i % 4) * 8;
      const reach = Math.max(w, h) * (.48 + (i % 5) * .045);
      const x1 = cx + Math.cos(a) * inner, y1 = cy + Math.sin(a) * inner;
      const x2 = cx + Math.cos(a) * reach, y2 = cy + Math.sin(a) * reach;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, 'rgba(249,115,22,0)');
      grad.addColorStop(.55, i % 3 === 0 ? 'rgba(249,115,22,.055)' : 'rgba(220,38,38,.035)');
      grad.addColorStop(1, 'rgba(249,115,22,0)');
      ctx.strokeStyle = grad; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Horizontal interference waves, low contrast and slowly evolving.
    for (let row = 0; row < 8; row++) {
      const base = h * (.18 + row * .105);
      ctx.beginPath();
      for (let x = 0; x <= w + 8; x += 8) {
        const wave = Math.sin(x * .004 + row * .68 + (staticFrame ? 0 : t * .00042)) * (7 + row * 1.25);
        const cross = Math.sin(x * .0018 - row * .5) * 5;
        const y = base + wave + cross;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = row % 2 ? 'rgba(220,38,38,.035)' : 'rgba(249,115,22,.045)';
      ctx.lineWidth = .8; ctx.stroke();
    }
    if (!staticFrame && !document.hidden && !reduced) { t += 1; raf = requestAnimationFrame(() => draw(false)); }
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });
  if (!reduced) draw(false);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduced) draw(false);
  });
}

// ── Active section navigation ─────────────────────────────────
function initNavigationState() {
  const links = [...document.querySelectorAll('.nav-link')];
  if (!('IntersectionObserver' in window) || !links.length) return;
  const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
  sections.forEach(section => observer.observe(section));
}

// ── Keyboard and timer ───────────────────────────────────────
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    ['createModal', 'unlockModal', 'revealModal', 'deleteModal'].forEach(closeModal);
    closeDrawer();
  }
});

(async function init() {
  try {
    if (!window.crypto?.subtle) {
      showToast('Web Crypto is unavailable. Open this site over HTTPS or localhost.', 6000);
      return;
    }
    await seedDemo();
    renderCapsules();
    initCosmos();
    initNavigationState();
    updateCountdowns();
    window.setInterval(updateCountdowns, 1000);
  } catch (error) {
    console.error('Time Capsule initialization failed:', error);
    showToast('Could not initialize Time Capsule. Check browser storage settings.', 6000);
  }
})();
