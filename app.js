
const AppState = {
    theme: 'light',
    rainbow: false,
    customAccentColor: '#6c63ff',
    customBgColor: '',
    customBgImage: '',
    sfxVolume: 70,
    sfxType: 'pop',
    musicVolume: 50,
    cookiesAccepted: null,
    carouselIndex: 0,
    carouselAutoPlay: null,
    menuOpen: false,
    settingsOpen: false,
    modalOpen: false,
    musicPlaying: false,
    youtubeUrl: '',
};


const SFX_PRESETS = {
    pop: {
        label: 'Pop',
        click: { freq: 800, type: 'sine', dur: 0.08, vol: 0.3 },
        open: { freq: 523, endFreq: 784, type: 'sine', dur: 0.2, vol: 0.2 },
        close: { freq: 784, endFreq: 392, type: 'sine', dur: 0.15, vol: 0.2 },
    },
    clicky: {
        label: 'Clicky',
        click: { freq: 1200, type: 'square', dur: 0.04, vol: 0.15 },
        open: { freq: 600, endFreq: 1000, type: 'square', dur: 0.1, vol: 0.12 },
        close: { freq: 1000, endFreq: 400, type: 'square', dur: 0.08, vol: 0.12 },
    },
    soft: {
        label: 'Soft',
        click: { freq: 440, type: 'sine', dur: 0.15, vol: 0.12 },
        open: { freq: 350, endFreq: 520, type: 'sine', dur: 0.35, vol: 0.1 },
        close: { freq: 520, endFreq: 280, type: 'sine', dur: 0.3, vol: 0.1 },
    },
    bubbly: {
        label: 'Bubbly',
        click: {
            freq: 600, type: 'sine', dur: 0.12, vol: 0.25,
            modFreq: 30, modGain: 100
        },
        open: {
            freq: 400, endFreq: 900, type: 'sine', dur: 0.25, vol: 0.18,
            modFreq: 20, modGain: 80
        },
        close: {
            freq: 700, endFreq: 300, type: 'sine', dur: 0.2, vol: 0.18,
            modFreq: 25, modGain: 60
        },
    },
};


let audioCtx = null;
let sfxGainNode = null;
let ytPlayer = null;
let ytApiReady = false;
let ytPendingVideoId = null;

function ensureAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        sfxGainNode = audioCtx.createGain();
        sfxGainNode.gain.value = AppState.sfxVolume / 100;
        sfxGainNode.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSFX(action) {
    if (!audioCtx || AppState.sfxVolume === 0) return;
    const preset = SFX_PRESETS[AppState.sfxType] || SFX_PRESETS.pop;
    const cfg = preset[action];
    if (!cfg) return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.freq, t);
    if (cfg.endFreq) {
        osc.frequency.exponentialRampToValueAtTime(cfg.endFreq, t + cfg.dur * 0.8);
    }


    if (cfg.modFreq) {
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = cfg.modFreq;
        lfoGain.gain.value = cfg.modGain;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + cfg.dur);
    }

    gain.gain.setValueAtTime(cfg.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.dur);

    osc.connect(gain);
    gain.connect(sfxGainNode);
    osc.start(t);
    osc.stop(t + cfg.dur);
}


function loadYouTubeAPI() {
    if (document.getElementById('yt-api-script')) return;
    const tag = document.createElement('script');
    tag.id = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
}


window.onYouTubeIframeAPIReady = function () {
    ytApiReady = true;
    if (ytPendingVideoId) {
        loadYouTubeVideo(ytPendingVideoId);
        ytPendingVideoId = null;
    }
};

function extractYouTubeId(url) {
    if (!url) return null;

    let m = url.match(/[?&]v=([^&#]+)/);
    if (m) return m[1];

    m = url.match(/youtu\.be\/([^?&#]+)/);
    if (m) return m[1];

    m = url.match(/embed\/([^?&#]+)/);
    if (m) return m[1];
    return null;
}

function loadYouTubeVideo(videoId) {
    if (!ytApiReady) {
        ytPendingVideoId = videoId;
        loadYouTubeAPI();
        return;
    }

    const container = document.getElementById('yt-iframe-container');
    container.innerHTML = '<div id="yt-player"></div>';

    ytPlayer = new YT.Player('yt-player', {
        height: '1',
        width: '1',
        videoId: videoId,
        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
        },
        events: {
            onReady: onYTPlayerReady,
            onStateChange: onYTStateChange,
        },
    });
}

function onYTPlayerReady() {
    ytPlayer.setVolume(AppState.musicVolume);
    updatePlayerTitle();
}

function onYTStateChange(event) {
    const state = event.data;
    if (state === YT.PlayerState.PLAYING) {
        AppState.musicPlaying = true;
        updatePlayPauseIcon(true);
        startYTProgressUpdate();
    } else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
        AppState.musicPlaying = false;
        updatePlayPauseIcon(false);
        stopYTProgressUpdate();
    }
}

function updatePlayerTitle() {
    if (!ytPlayer) return;
    try {
        const data = ytPlayer.getVideoData();
        if (data && data.title) {
            DOM.playerTitle.textContent = data.title;
            DOM.playerArtist.textContent = data.author || 'YouTube';
        }
    } catch (e) { }
}

let ytProgressRAF = null;
function startYTProgressUpdate() {
    function update() {
        if (!ytPlayer || !AppState.musicPlaying) return;
        try {
            const cur = ytPlayer.getCurrentTime() || 0;
            const dur = ytPlayer.getDuration() || 1;
            const pct = (cur / dur) * 100;
            DOM.playerProgressFill.style.width = pct + '%';
            DOM.playerCurrentTime.textContent = formatTime(cur);
            DOM.playerTotalTime.textContent = formatTime(dur);
        } catch (e) { }
        ytProgressRAF = requestAnimationFrame(update);
    }
    ytProgressRAF = requestAnimationFrame(update);
}

function stopYTProgressUpdate() {
    if (ytProgressRAF) cancelAnimationFrame(ytProgressRAF);
    ytProgressRAF = null;
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + s.toString().padStart(2, '0');
}

function updatePlayPauseIcon(playing) {
    if (!DOM.playerPlayBtn) return;
    if (playing) {
        DOM.playerPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    } else {
        DOM.playerPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    }
}


const DOM = {};
function cacheDOMElements() {
    DOM.welcomeScreen = document.getElementById('welcome-screen');
    DOM.menuToggle = document.getElementById('menu-toggle');
    DOM.menuOverlay = document.getElementById('menu-overlay');
    DOM.sideMenu = document.getElementById('side-menu');
    DOM.settingsPanel = document.getElementById('settings-panel');
    DOM.settingsBackBtn = document.getElementById('settings-back-btn');
    DOM.modalOverlay = document.getElementById('modal-overlay');
    DOM.modalTitle = document.getElementById('modal-title');
    DOM.modalBody = document.getElementById('modal-body');
    DOM.modalLink = document.getElementById('modal-link');
    DOM.modalClose = document.getElementById('modal-close');
    DOM.cookieBanner = document.getElementById('cookie-banner');
    DOM.carouselTrack = document.getElementById('carousel-track');
    DOM.carouselPrev = document.getElementById('carousel-prev');
    DOM.carouselNext = document.getElementById('carousel-next');
    DOM.carouselDots = document.getElementById('carousel-dots');
    DOM.themeLightBtn = document.getElementById('theme-light');
    DOM.themeDarkBtn = document.getElementById('theme-dark');
    DOM.rainbowToggle = document.getElementById('rainbow-toggle');
    DOM.accentColorPicker = document.getElementById('accent-color-picker');
    DOM.bgColorPicker = document.getElementById('bg-color-picker');
    DOM.bgImageInput = document.getElementById('bg-image-input');
    DOM.bgApplyBtn = document.getElementById('bg-apply-btn');
    DOM.bgResetBtn = document.getElementById('bg-reset-btn');
    DOM.sfxSlider = document.getElementById('sfx-volume');
    DOM.sfxValue = document.getElementById('sfx-value');
    DOM.sfxTypeSelect = document.getElementById('sfx-type');
    DOM.musicSlider = document.getElementById('music-volume');
    DOM.musicValue = document.getElementById('music-value');
    DOM.sections = document.querySelectorAll('.content-section');
    DOM.musicPlayer = document.getElementById('music-player');
    DOM.playerPlayBtn = document.getElementById('player-play-btn');
    DOM.playerPrevBtn = document.getElementById('player-prev-btn');
    DOM.playerNextBtn = document.getElementById('player-next-btn');
    DOM.playerTitle = document.getElementById('player-track-title');
    DOM.playerArtist = document.getElementById('player-track-artist');
    DOM.playerProgressFill = document.getElementById('player-progress-fill');
    DOM.playerProgressBar = document.getElementById('player-progress-bar');
    DOM.playerCurrentTime = document.getElementById('player-current-time');
    DOM.playerTotalTime = document.getElementById('player-total-time');
    DOM.playerVolumeSlider = document.getElementById('player-volume');
    DOM.playerUrlInput = document.getElementById('player-url-input');
    DOM.playerUrlLoadBtn = document.getElementById('player-url-load-btn');
    DOM.contactForm = document.getElementById('contact-form');
}


function initWelcomeScreen() {
    document.body.style.overflow = 'hidden';
    const dismiss = () => {
        DOM.welcomeScreen.classList.add('fade-out');
        document.body.style.overflow = '';
        setTimeout(() => { DOM.welcomeScreen.style.display = 'none'; }, 600);
    };
    window.addEventListener('wheel', dismiss, { once: true, passive: true });
    window.addEventListener('touchmove', dismiss, { once: true, passive: true });
    DOM.welcomeScreen.addEventListener('click', dismiss);
    setTimeout(() => {
        if (!DOM.welcomeScreen.classList.contains('fade-out')) dismiss();
    }, 5000);
}


function initMenu() {
    DOM.menuToggle.addEventListener('click', toggleMenu);
    DOM.menuOverlay.addEventListener('click', closeMenu);
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            closeMenu();
            if (action === 'settings') openSettings();
            else if (action === 'cookies') showCookieBanner();
            else if (action === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function toggleMenu() {
    AppState.menuOpen = !AppState.menuOpen;
    DOM.menuToggle.classList.toggle('active', AppState.menuOpen);
    DOM.sideMenu.classList.toggle('active', AppState.menuOpen);
    DOM.menuOverlay.classList.toggle('active', AppState.menuOpen);
    playSFX('click');
}

function closeMenu() {
    AppState.menuOpen = false;
    DOM.menuToggle.classList.remove('active');
    DOM.sideMenu.classList.remove('active');
    DOM.menuOverlay.classList.remove('active');
}


function openSettings() { AppState.settingsOpen = true; DOM.settingsPanel.classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeSettings() { AppState.settingsOpen = false; DOM.settingsPanel.classList.remove('active'); document.body.style.overflow = ''; }

function initSettings() {
    DOM.settingsBackBtn.addEventListener('click', closeSettings);
    DOM.themeLightBtn.addEventListener('click', () => setTheme('light'));
    DOM.themeDarkBtn.addEventListener('click', () => setTheme('dark'));

    DOM.rainbowToggle.addEventListener('change', (e) => {
        AppState.rainbow = e.target.checked;
        document.documentElement.setAttribute('data-rainbow', AppState.rainbow);
        saveSettings();
    });

    DOM.accentColorPicker.addEventListener('input', (e) => {
        AppState.customAccentColor = e.target.value;
        document.documentElement.style.setProperty('--accent-color', e.target.value);
        document.documentElement.style.setProperty('--accent-light', hexToRGBA(e.target.value, 0.12));
        saveSettings();
    });

    DOM.bgColorPicker.addEventListener('input', (e) => {
        AppState.customBgColor = e.target.value;
        applyCustomBackground();
        saveSettings();
    });

    DOM.bgApplyBtn.addEventListener('click', () => {
        AppState.customBgImage = DOM.bgImageInput.value.trim();
        applyCustomBackground();
        saveSettings();
    });

    DOM.bgImageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { DOM.bgApplyBtn.click(); }
    });

    DOM.bgResetBtn.addEventListener('click', () => {
        AppState.customBgColor = '';
        AppState.customBgImage = '';
        DOM.bgColorPicker.value = '#f5f5f7';
        DOM.bgImageInput.value = '';
        document.body.classList.remove('custom-bg');
        document.body.style.background = '';
        saveSettings();
    });


    DOM.sfxSlider.addEventListener('input', (e) => {
        AppState.sfxVolume = parseInt(e.target.value);
        DOM.sfxValue.textContent = AppState.sfxVolume + '%';
        if (sfxGainNode) sfxGainNode.gain.value = AppState.sfxVolume / 100;
        saveSettings();
    });

    DOM.sfxTypeSelect.addEventListener('change', (e) => {
        AppState.sfxType = e.target.value;
        playSFX('click');
        saveSettings();
    });


    DOM.musicSlider.addEventListener('input', (e) => {
        AppState.musicVolume = parseInt(e.target.value);
        DOM.musicValue.textContent = AppState.musicVolume + '%';
        if (ytPlayer) try { ytPlayer.setVolume(AppState.musicVolume); } catch (err) { }
        if (DOM.playerVolumeSlider) DOM.playerVolumeSlider.value = AppState.musicVolume;
        saveSettings();
    });
}

function applyCustomBackground() {
    if (AppState.customBgImage) {
        document.body.classList.add('custom-bg');
        document.body.style.background = `url('${AppState.customBgImage}') center/cover fixed`;
    } else if (AppState.customBgColor) {
        document.body.classList.add('custom-bg');
        document.body.style.background = AppState.customBgColor;
    } else {
        document.body.classList.remove('custom-bg');
        document.body.style.background = '';
    }
}

function setTheme(theme) {
    AppState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    DOM.themeLightBtn.classList.toggle('active', theme === 'light');
    DOM.themeDarkBtn.classList.toggle('active', theme === 'dark');

    const twitterTimeline = document.querySelector('.twitter-timeline');
    if (twitterTimeline) {
        twitterTimeline.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    }
    saveSettings();
}


function initMusicPlayer() {
    DOM.musicPlayer.classList.add('visible');
    loadYouTubeAPI();

    DOM.playerPlayBtn.addEventListener('click', () => {
        ensureAudioCtx();
        if (!ytPlayer) {

            if (DOM.playerUrlInput) DOM.playerUrlInput.focus();
            return;
        }
        try {
            const state = ytPlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) {
                ytPlayer.pauseVideo();
            } else {
                ytPlayer.playVideo();
            }
        } catch (e) { }
    });


    DOM.playerPrevBtn.addEventListener('click', () => {
        if (!ytPlayer) return;
        try {
            const t = ytPlayer.getCurrentTime();
            ytPlayer.seekTo(Math.max(0, t - 10), true);
        } catch (e) { }
    });

    DOM.playerNextBtn.addEventListener('click', () => {
        if (!ytPlayer) return;
        try {
            const t = ytPlayer.getCurrentTime();
            ytPlayer.seekTo(t + 10, true);
        } catch (e) { }
    });


    DOM.playerVolumeSlider.addEventListener('input', (e) => {
        AppState.musicVolume = parseInt(e.target.value);
        if (ytPlayer) try { ytPlayer.setVolume(AppState.musicVolume); } catch (err) { }
        DOM.musicSlider.value = AppState.musicVolume;
        DOM.musicValue.textContent = AppState.musicVolume + '%';
        saveSettings();
    });


    DOM.playerProgressBar.addEventListener('click', (e) => {
        if (!ytPlayer) return;
        try {
            const rect = DOM.playerProgressBar.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const dur = ytPlayer.getDuration();
            ytPlayer.seekTo(pct * dur, true);
        } catch (err) { }
    });


    DOM.playerUrlLoadBtn.addEventListener('click', loadUrlFromInput);
    DOM.playerUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadUrlFromInput();
    });


    if (AppState.youtubeUrl) {
        DOM.playerUrlInput.value = AppState.youtubeUrl;
        const vid = extractYouTubeId(AppState.youtubeUrl);
        if (vid) loadYouTubeVideo(vid);
    }
}

function loadUrlFromInput() {
    const url = DOM.playerUrlInput.value.trim();
    if (!url) return;
    const vid = extractYouTubeId(url);
    if (!vid) {
        DOM.playerTitle.textContent = 'Invalid URL';
        DOM.playerArtist.textContent = 'YouTube URLをペースト';
        return;
    }
    AppState.youtubeUrl = url;
    saveSettings();
    DOM.playerTitle.textContent = '読み込み中...';
    DOM.playerArtist.textContent = '';
    loadYouTubeVideo(vid);
}


function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    DOM.sections.forEach(section => observer.observe(section));
}


const projects = [
    {
        emoji: '🎮', title: 'AISU!Taiko',
        description: 'AIが普及していくこの社会で、簡易的に作成された太鼓の達人のAI演奏ツール',
        tags: ['Python', 'AI', 'Open Source'],
        link: '#',
        fullDescription: 'AISU!Taikoは、AIが普及していくこの社会で、簡易的に作成された太鼓の達人のAI演奏ツールです、⚠このツールは学習目的で作成されているもので、商標目的で改変したものを作らないでください'
    },
    {
        emoji: '🤖', title: 'Project MAG',
        description: 'discordの荒らし対策bot',
        tags: ['python', 'bot'],
        link: '#',
        fullDescription: 'Project magはワード検知やid検知などの基本的な機能で完結している荒らし対策botです、誤検知が少なく、セーフユーザーの設定も可能、また、過去のメッセージから検知、処罰の変更が可能で、設定ファイルは共有可能です'
    },
    {
        emoji: '🎮', title: 'MCBE Json UI Editor',
        description: '視覚的にUIの配置を変更できるツール',
        tags: ['Python', 'ui', 'minecraft'],
        link: '#',
        fullDescription: 'MCBE Json UI Editorは、json形式のUIファイルを視覚的にマウスカーソルで移動させる事によってリアルタイムで簡単に編集することが可能なツールです、⚠このツールは作成段階で使用は推奨されていません、今後のアップデートに期待してください！'
    },
];

function initCarousel() {
    renderProjectCards();
    renderCarouselDots();
    updateCarousel();
    DOM.carouselPrev.addEventListener('click', () => { prevProject(); resetAutoPlay(); playSFX('click'); });
    DOM.carouselNext.addEventListener('click', () => { nextProject(); resetAutoPlay(); playSFX('click'); });
    startAutoPlay();
}

function renderProjectCards() {
    DOM.carouselTrack.innerHTML = projects.map((p, i) => `
    <div class="project-card">
      <div class="project-card-inner" data-project-index="${i}">
        <div>
          <div class="project-emoji">${p.emoji}</div>
          <h3 class="project-title">${p.title}</h3>
          <p class="project-desc">${p.description}</p>
        </div>
        <div class="project-tags">${p.tags.map(t => `<span class="project-tag">${t}</span>`).join('')}</div>
      </div>
    </div>`).join('');

    document.querySelectorAll('.project-card-inner').forEach(card => {
        card.addEventListener('click', () => {
            openModal(projects[parseInt(card.dataset.projectIndex)]);
            playSFX('open');
        });
    });
}

function renderCarouselDots() {
    DOM.carouselDots.innerHTML = projects.map((_, i) =>
        `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Project ${i + 1}"></button>`
    ).join('');
    DOM.carouselDots.querySelectorAll('.carousel-dot').forEach(dot => {
        dot.addEventListener('click', () => { AppState.carouselIndex = parseInt(dot.dataset.index); updateCarousel(); resetAutoPlay(); });
    });
}

function updateCarousel() {
    DOM.carouselTrack.style.transform = `translateX(${-AppState.carouselIndex * 100}%)`;
    DOM.carouselDots.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === AppState.carouselIndex));
}

function nextProject() { AppState.carouselIndex = (AppState.carouselIndex + 1) % projects.length; updateCarousel(); }
function prevProject() { AppState.carouselIndex = (AppState.carouselIndex - 1 + projects.length) % projects.length; updateCarousel(); }
function startAutoPlay() { AppState.carouselAutoPlay = setInterval(nextProject, 4000); }
function resetAutoPlay() { clearInterval(AppState.carouselAutoPlay); startAutoPlay(); }


function openModal(data) {
    AppState.modalOpen = true;
    DOM.modalTitle.textContent = data.title;
    DOM.modalBody.textContent = data.fullDescription;
    DOM.modalLink.href = data.link || '#';
    DOM.modalLink.textContent = (!data.link || data.link === '#') ? 'Coming Soon' : 'リンクを開く →';
    DOM.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    playSFX('open');
}

function closeModal() {
    AppState.modalOpen = false;
    DOM.modalOverlay.classList.remove('active');
    if (!AppState.settingsOpen) document.body.style.overflow = '';
    playSFX('close');
}

function initModal() {
    DOM.modalClose.addEventListener('click', closeModal);
    DOM.modalOverlay.addEventListener('click', (e) => { if (e.target === DOM.modalOverlay) closeModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (AppState.modalOpen) closeModal();
            else if (AppState.settingsOpen) closeSettings();
            else if (AppState.menuOpen) closeMenu();
        }
    });
}


function initAboutCard() {
    const card = document.querySelector('.about-card');
    if (card) {
        card.addEventListener('click', () => {
            openModal({
                title: 'About Me',
                fullDescription: 'こんにちは、アロンです。\n\nWeb開発、ツール作成、その他創作活動、そしてオープンソースプロジェクトに情熱を持っています。\n\nスキル:\n• フロントエンド: HTML, CSS, JavaScript\n• バックエンド: Node.js, Python\n\nプロジェクトに関するお問い合わせは、以下からどうぞ。',
                link: '#',
            });
        });
    }
}


function initSNSCards() {
    document.querySelectorAll('.sns-card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const url = card.dataset.url;
            const name = card.querySelector('.sns-name')?.textContent || '';
            const handle = card.querySelector('.sns-handle')?.textContent || '';
            const desc = card.querySelector('.sns-card-desc')?.textContent || '';
            openModal({
                title: name, link: url || '#',
                fullDescription: `${desc}\n\nハンドル: ${handle}\n\nリンクボタンからプロフィールページに移動できます。`,
            });
        });
    });
}


function initContactForm() {
    if (DOM.contactForm) {
        DOM.contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            playSFX('open');
            openModal({
                title: '送信完了 ✉️',
                fullDescription: 'メッセージが送信されました！\n\nお問い合わせいただきありがとうございます。\n内容を確認次第、ご返信いたします。\n\n※ 現在はデモのため、実際にはメールは送信されません。',
                link: '#',
            });
            DOM.contactForm.reset();
        });
    }
}


function initCookieBanner() {
    if (!localStorage.getItem('cookiesAccepted')) {
        setTimeout(showCookieBanner, 2000);
    }
    document.getElementById('cookie-accept')?.addEventListener('click', () => {
        localStorage.setItem('cookiesAccepted', 'true');
        hideCookieBanner();
    });
    document.getElementById('cookie-decline')?.addEventListener('click', () => {
        localStorage.setItem('cookiesAccepted', 'false');
        hideCookieBanner();
    });
}
function showCookieBanner() { DOM.cookieBanner.classList.add('show'); }
function hideCookieBanner() { DOM.cookieBanner.classList.remove('show'); }


function saveSettings() {
    localStorage.setItem('siteSettings', JSON.stringify({
        theme: AppState.theme,
        rainbow: AppState.rainbow,
        customAccentColor: AppState.customAccentColor,
        customBgColor: AppState.customBgColor,
        customBgImage: AppState.customBgImage,
        sfxVolume: AppState.sfxVolume,
        sfxType: AppState.sfxType,
        musicVolume: AppState.musicVolume,
        youtubeUrl: AppState.youtubeUrl,
    }));
}

function loadSettings() {
    const raw = localStorage.getItem('siteSettings');
    if (!raw) return;
    try {
        const s = JSON.parse(raw);
        if (s.theme) setTheme(s.theme);
        if (s.rainbow !== undefined) {
            AppState.rainbow = s.rainbow;
            DOM.rainbowToggle.checked = s.rainbow;
            document.documentElement.setAttribute('data-rainbow', s.rainbow);
        }
        if (s.customAccentColor) {
            AppState.customAccentColor = s.customAccentColor;
            DOM.accentColorPicker.value = s.customAccentColor;
            document.documentElement.style.setProperty('--accent-color', s.customAccentColor);
            document.documentElement.style.setProperty('--accent-light', hexToRGBA(s.customAccentColor, 0.12));
        }
        if (s.customBgColor) { AppState.customBgColor = s.customBgColor; DOM.bgColorPicker.value = s.customBgColor; }
        if (s.customBgImage) { AppState.customBgImage = s.customBgImage; DOM.bgImageInput.value = s.customBgImage; }
        applyCustomBackground();
        if (s.sfxVolume !== undefined) { AppState.sfxVolume = s.sfxVolume; DOM.sfxSlider.value = s.sfxVolume; DOM.sfxValue.textContent = s.sfxVolume + '%'; }
        if (s.sfxType) { AppState.sfxType = s.sfxType; DOM.sfxTypeSelect.value = s.sfxType; }
        if (s.musicVolume !== undefined) {
            AppState.musicVolume = s.musicVolume;
            DOM.musicSlider.value = s.musicVolume;
            DOM.musicValue.textContent = s.musicVolume + '%';
            if (DOM.playerVolumeSlider) DOM.playerVolumeSlider.value = s.musicVolume;
        }
        if (s.youtubeUrl) { AppState.youtubeUrl = s.youtubeUrl; }
    } catch (e) { console.warn('Failed to load settings:', e); }
}


function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}


document.addEventListener('DOMContentLoaded', () => {
    cacheDOMElements();
    initWelcomeScreen();
    initMenu();
    initSettings();
    initScrollReveal();
    initCarousel();
    initModal();
    initAboutCard();
    initSNSCards();
    initContactForm();
    initCookieBanner();
    initMusicPlayer();
    loadSettings();


    document.addEventListener('click', () => { ensureAudioCtx(); }, { once: true });
    document.addEventListener('touchstart', () => { ensureAudioCtx(); }, { once: true });
});
