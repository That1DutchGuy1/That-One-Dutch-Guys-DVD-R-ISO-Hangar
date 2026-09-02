// Opt out of bfcache so sessionStorage works cleanly on back/forward nav.
window.addEventListener('beforeunload', () => {});

// =========================================
// MUSIC
// =========================================
let isAudioInitialized = false;
let hubTheme = null;
let isMusicPlaying = false;

function startMusic() {
    if (isAudioInitialized) return;
    isAudioInitialized = true;

    hubTheme = new Audio('./hub-theme.wav');
    hubTheme.loop = true;
    hubTheme.play().catch(() => {});
    isMusicPlaying = true;

    updateMusicToggleBtn();

    const btn = document.getElementById('music-toggle');
    if (btn) {
        btn.addEventListener('click', () => {
            if (!hubTheme) return;
            if (isMusicPlaying) {
                hubTheme.pause();
                isMusicPlaying = false;
            } else {
                hubTheme.play().catch(() => {});
                isMusicPlaying = true;
            }
            updateMusicToggleBtn();
        });
    }
}

function updateMusicToggleBtn() {
    const btn = document.getElementById('music-toggle');
    if (!btn) return;
    if (isMusicPlaying) {
        btn.textContent = '🔊 MUSIC ON';
        btn.classList.remove('music-off');
        btn.setAttribute('aria-label', 'Music is on — click to turn off');
    } else {
        btn.textContent = '🔇 MUSIC OFF';
        btn.classList.add('music-off');
        btn.setAttribute('aria-label', 'Music is off — click to turn on');
    }
}

// Start music on the first user interaction (required by browsers).
document.addEventListener('click', () => startMusic(), { once: true });
document.addEventListener('keydown', () => startMusic(), { once: true });

// =========================================
// ABOUT / README + WIKI VIEW
// =========================================
const aboutToggleBtn  = document.getElementById('about-toggle');
const readmeContentEl = document.getElementById('readme-content');
const wikiContentEl   = document.getElementById('wiki-content');
const docTitleLabel   = document.getElementById('doc-title-label');
const arrowLeft       = document.getElementById('doc-arrow-left');
const arrowRight      = document.getElementById('doc-arrow-right');

let aboutIsOpen     = false;
let readmeHasLoaded = false;
let wikiHasLoaded   = false;
let currentDoc      = 'readme'; // 'readme' | 'wiki'

function setAboutOpen(open) {
    aboutIsOpen = open;
    document.body.classList.toggle('about-active', open);

    if (aboutToggleBtn) {
        aboutToggleBtn.textContent = open ? '✖️ CLOSE' : '📖 ABOUT';
        aboutToggleBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
    }

    if (open) {
        showDoc('readme');
        if (!readmeHasLoaded) loadReadme();
    }
}

function showDoc(doc) {
    currentDoc = doc;

    if (doc === 'readme') {
        readmeContentEl.style.display = '';
        wikiContentEl.style.display   = 'none';
        if (docTitleLabel) docTitleLabel.textContent = '📖 README.md';
        if (arrowLeft)  arrowLeft.classList.add('arrow-inactive');
        if (arrowRight) arrowRight.classList.remove('arrow-inactive');
    } else {
        readmeContentEl.style.display = 'none';
        wikiContentEl.style.display   = '';
        if (docTitleLabel) docTitleLabel.textContent = '📚 Wiki.md';
        if (arrowLeft)  arrowLeft.classList.remove('arrow-inactive');
        if (arrowRight) arrowRight.classList.add('arrow-inactive');
        if (!wikiHasLoaded) loadWiki();
    }
}

function loadReadme() {
    fetch('README.md')
        .then(res => {
            if (!res.ok) throw new Error('status ' + res.status);
            return res.text();
        })
        .then(markdown => {
            readmeContentEl.innerHTML = marked.parse(markdown);
            readmeHasLoaded = true;
        })
        .catch(err => {
            readmeContentEl.innerHTML =
                '<p>Could not load README.md (' + err.message + '). ' +
                'Make sure README.md sits in the same folder as index.html, ' +
                'and that you\'re viewing this over a local/real server rather ' +
                'than opening the file directly.</p>';
        });
}

function loadWiki() {
    wikiContentEl.innerHTML = '<p class="readme-loading">loading wiki.md ...</p>';
    fetch('Wiki.md')
        .then(res => {
            if (!res.ok) throw new Error('status ' + res.status);
            return res.text();
        })
        .then(markdown => {
            wikiContentEl.innerHTML = marked.parse(markdown);
            wikiHasLoaded = true;
        })
        .catch(err => {
            wikiContentEl.innerHTML =
                '<p>Could not load Wiki.md (' + err.message + '). ' +
                'Make sure Wiki.md sits in the same folder as index.html, ' +
                'and that you\'re viewing this over a local/real server rather ' +
                'than opening the file directly.</p>';
        });
}

if (aboutToggleBtn) {
    aboutToggleBtn.addEventListener('click', () => setAboutOpen(!aboutIsOpen));
}

if (arrowRight) {
    arrowRight.addEventListener('click', () => {
        if (currentDoc !== 'wiki') showDoc('wiki');
    });
}

if (arrowLeft) {
    arrowLeft.addEventListener('click', () => {
        if (currentDoc !== 'readme') showDoc('readme');
    });
}

// =========================================
// LOGO SMOOTH SPIN ANIMATION
// =========================================
const logo = document.querySelector('.main-logo');
let animationFrameId;
let currentRotation = 0;
let isHovered = false;

if (logo) {
    const logoParent = logo.closest('a');

    function spin() {
        if (!isHovered) return;
        currentRotation += 3;
        logo.style.transform = `rotate(${currentRotation}deg)`;
        animationFrameId = requestAnimationFrame(spin);
    }

    logoParent.addEventListener('mouseenter', () => {
        isHovered = true;
        logo.style.transition = 'none';
        animationFrameId = requestAnimationFrame(spin);
    });

    logoParent.addEventListener('mouseleave', () => {
        isHovered = false;
        cancelAnimationFrame(animationFrameId);
        logo.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        const remainder = currentRotation % 360;
        currentRotation = currentRotation + (360 - remainder);
        logo.style.transform = `rotate(${currentRotation}deg)`;
    });
}

// =========================================
// GAMEPAD / CONTROLLER NAVIGATION
// D-Pad = move, Right Stick = scroll,
// Cross (X) = select/activate, Circle (O) = back/close.
// =========================================
initGamepadNav();

function initGamepadNav() {
    const STICK_DEADZONE    = 0.2;
    const SCROLL_SPEED      = 18;
    const DPAD_REPEAT_DELAY = 380;
    const DPAD_REPEAT_RATE  = 130;

    let activeGamepadIndex = null;
    let rafId = null;
    let selectedEl = null;
    const btnState = {};
    let inputMode = 'pointer';

    function enterGamepadMode() {
        inputMode = 'gamepad';
        refreshSelection();
    }

    function enterPointerMode() {
        inputMode = 'pointer';
        clearSelection();
    }

    let lastPX = -1, lastPY = -1;
    window.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        if (lastPX === -1) { lastPX = e.clientX; lastPY = e.clientY; return; }
        if (Math.abs(e.clientX - lastPX) < 4 && Math.abs(e.clientY - lastPY) < 4) return;
        lastPX = e.clientX; lastPY = e.clientY;
        enterPointerMode();
    }, { passive: true });

    window.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' || e.pointerType === 'touch') enterPointerMode();
    }, { passive: true });

    // ---- Toast ----
    const toast = document.createElement('div');
    toast.className = 'gamepad-toast';
    document.body.appendChild(toast);
    let toastTimeout;

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('gamepad-toast-visible');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove('gamepad-toast-visible'), 3500);
    }

    window.addEventListener('gamepaddisconnected', e => {
        if (e.gamepad.index !== activeGamepadIndex) return;
        activeGamepadIndex = null;
        enterPointerMode();
        showToast('🎮 Controller disconnected');
    });

    rafId = requestAnimationFrame(pollGamepad);

    // ---- Context ----
    function getContext() {
        if (document.body.classList.contains('about-active')) return 'about';
        return 'hub';
    }

    function getNavigableElements() {
        const ctx = getContext();
        const about = document.getElementById('about-toggle');
        const music = document.getElementById('music-toggle');

        if (ctx === 'about') {
            return [about, music].filter(Boolean);
        }

        const els = [];
        if (about) els.push(about);
        if (music) els.push(music);
        document.querySelectorAll('.project-card').forEach(el => els.push(el));
        return els;
    }

    function getScrollTarget() {
        if (getContext() === 'about') return document.getElementById('readme-view');
        return null;
    }

    // ---- Selection handling ----
    function clearSelection() {
        if (selectedEl) selectedEl.classList.remove('gamepad-selected');
        selectedEl = null;
    }

    function refreshSelection() {
        if (inputMode !== 'gamepad') return;
        const list = getNavigableElements();
        if (!list.length) { clearSelection(); return; }
        if (!selectedEl || !list.includes(selectedEl)) select(list[0]);
    }

    function select(el) {
        if (!el || selectedEl === el) return;
        if (selectedEl) selectedEl.classList.remove('gamepad-selected');
        selectedEl = el;
        selectedEl.classList.add('gamepad-selected');
        const r = selectedEl.getBoundingClientRect();
        const margin = 20;
        if (r.bottom > window.innerHeight - margin)
            window.scrollBy({ top: r.bottom - window.innerHeight + margin, behavior: 'smooth' });
        else if (r.top < margin)
            window.scrollBy({ top: r.top - margin, behavior: 'smooth' });
    }

    // ---- Spatial navigation ----
    function moveSelection(direction) {
        enterGamepadMode();
        const list = getNavigableElements();
        if (!list.length) return;
        if (!selectedEl || !list.includes(selectedEl)) { select(list[0]); return; }

        const curRect = selectedEl.getBoundingClientRect();
        const cx = curRect.left + curRect.width  / 2;
        const cy = curRect.top  + curRect.height / 2;

        let best = null, bestScore = Infinity;
        list.forEach(el => {
            if (el === selectedEl) return;
            const r  = el.getBoundingClientRect();
            const ex = r.left + r.width  / 2;
            const ey = r.top  + r.height / 2;
            const dx = ex - cx, dy = ey - cy;

            let inDir = false, score = 0;
            if (direction === 'up')    { inDir = dy < -1; score = Math.abs(dy) + Math.abs(dx) * 1.5; }
            if (direction === 'down')  { inDir = dy >  1; score = Math.abs(dy) + Math.abs(dx) * 1.5; }
            if (direction === 'left')  { inDir = dx < -1; score = Math.abs(dx) + Math.abs(dy) * 1.5; }
            if (direction === 'right') { inDir = dx >  1; score = Math.abs(dx) + Math.abs(dy) * 1.5; }

            if (inDir && score < bestScore) { bestScore = score; best = el; }
        });
        if (best) select(best);
    }

    function activateSelection() {
        enterGamepadMode();
        if (!selectedEl) return;
        if (selectedEl.classList.contains('project-card')) {
            const link = selectedEl.querySelector('.play-button');
            if (link) { link.click(); return; }
        }
        selectedEl.click();
    }

    function goBack() {
        enterGamepadMode();
        if (getContext() === 'about') {
            const btn = document.getElementById('about-toggle');
            if (btn) btn.click();
        }
    }

    function docNavLeft() {
        enterGamepadMode();
        if (getContext() !== 'about') return;
        if (currentDoc !== 'readme') {
            showDoc('readme');
            showToast('📖 README.md');
        }
    }

    function docNavRight() {
        enterGamepadMode();
        if (getContext() !== 'about') return;
        if (currentDoc !== 'wiki') {
            showDoc('wiki');
            showToast('📚 Wiki.md');
        }
    }

    // ---- Non-standard mapping detection ----
    function buildInputMap(gp) {
        const isStandard = gp.mapping === 'standard';
        if (isStandard) {
            return {
                confirm:  () => isButtonPressed(gp, 0),
                back:     () => isButtonPressed(gp, 1),
                l1:       () => isButtonPressed(gp, 4),
                r1:       () => isButtonPressed(gp, 5),
                dUp:      () => isButtonPressed(gp, 12),
                dDown:    () => isButtonPressed(gp, 13),
                dLeft:    () => isButtonPressed(gp, 14),
                dRight:   () => isButtonPressed(gp, 15),
                rsX: () => gp.axes[2] ?? 0,
                rsY: () => gp.axes[3] ?? 0,
                isDpad: index => index >= 12 && index <= 15,
            };
        }
        // Raw DS4 on Linux
        return {
            confirm:  () => isButtonPressed(gp, 1),
            back:     () => isButtonPressed(gp, 2),
            l1:       () => isButtonPressed(gp, 4),
            r1:       () => isButtonPressed(gp, 5),
            dUp:      () => (gp.axes[7] ?? 0) < -0.5,
            dDown:    () => (gp.axes[7] ?? 0) >  0.5,
            dLeft:    () => (gp.axes[6] ?? 0) < -0.5,
            dRight:   () => (gp.axes[6] ?? 0) >  0.5,
            rsX: () => gp.axes[2] ?? 0,
            rsY: () => gp.axes[3] ?? 0,
            isDpad: () => false,
        };
    }

    function isButtonPressed(gp, index) {
        const btn = gp.buttons[index];
        if (!btn) return false;
        return btn.pressed || btn.value > 0.5;
    }

    function handleVirtualButton(key, isPressed, onPress, isDpadKey) {
        const now = performance.now();
        const state = btnState[key] || (btnState[key] = { down: false, downSince: 0, lastRepeat: 0 });

        if (isPressed && !state.down) {
            state.down = true;
            state.downSince = now;
            state.lastRepeat = now;
            onPress();
        } else if (isPressed && state.down) {
            if (isDpadKey) {
                const heldFor = now - state.downSince;
                if (heldFor > DPAD_REPEAT_DELAY && now - state.lastRepeat > DPAD_REPEAT_RATE) {
                    state.lastRepeat = now;
                    onPress();
                }
            }
        } else if (!isPressed && state.down) {
            state.down = false;
        }
    }

    function pollGamepad() {
        rafId = requestAnimationFrame(pollGamepad);

        const pads = navigator.getGamepads ? navigator.getGamepads() : [];

        if (activeGamepadIndex === null) {
            for (const gp of pads) {
                if (gp && gp.buttons.length >= 10 && gp.axes.length >= 4) {
                    activeGamepadIndex = gp.index;
                    showToast('🎮 Controller connected — D-Pad to move, ✕ to select, L1/R1 to flip docs');
                    enterGamepadMode();
                    break;
                }
            }
            if (activeGamepadIndex === null) return;
        }

        const gp = pads[activeGamepadIndex];
        if (!gp) { activeGamepadIndex = null; enterPointerMode(); return; }

        refreshSelection();

        const map = buildInputMap(gp);

        handleVirtualButton('confirm', map.confirm(), activateSelection, false);
        handleVirtualButton('back',    map.back(),    goBack,            false);
        handleVirtualButton('l1', map.l1(), docNavLeft,  false);
        handleVirtualButton('r1', map.r1(), docNavRight, false);
        handleVirtualButton('dUp',    map.dUp(),    () => moveSelection('up'),    true);
        handleVirtualButton('dDown',  map.dDown(),  () => moveSelection('down'),  true);
        handleVirtualButton('dLeft',  map.dLeft(),  () => moveSelection('left'),  true);
        handleVirtualButton('dRight', map.dRight(), () => moveSelection('right'), true);

        const stickX = map.rsX();
        const stickY = map.rsY();
        const anyStickActive = Math.abs(stickX) > STICK_DEADZONE || Math.abs(stickY) > STICK_DEADZONE;
        if (anyStickActive) {
            if (inputMode !== 'gamepad') enterGamepadMode();
            const dy = Math.abs(stickY) > STICK_DEADZONE ? stickY * SCROLL_SPEED : 0;
            const target = getScrollTarget();
            if (target) target.scrollBy(0, dy);
            else        window.scrollBy(0, dy);
        }
    }
}