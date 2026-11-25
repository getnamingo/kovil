(() => {
    const root = document.documentElement;
    const defaultTheme = root.dataset.theme;
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const key = 'kovil-color-mode';
    let preference;
    try { preference = localStorage.getItem(key); } catch { /* The page still uses its default. */ }

    function apply() {
        const mode = preference || defaultTheme;
        root.dataset.theme = mode === 'dark' || (mode !== 'light' && system.matches) ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]').content = root.dataset.theme === 'dark' ? '#151a16' : '#f7f8f3';
        document.dispatchEvent(new Event('kovil:theme'));
    }

    window.setKovilTheme = (mode) => {
        preference = mode;
        try {
            if (mode) localStorage.setItem(key, mode);
            else localStorage.removeItem(key);
        } catch { /* Keep the selection for this page. */ }
        apply();
    };
    system.addEventListener('change', apply);
    apply();
})();
