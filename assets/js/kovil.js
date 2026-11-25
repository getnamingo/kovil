(() => {
    'use strict';

    const root = document.documentElement;
    const tabSelector = '[data-tab]';
    const collapseSelector = '[data-collapse]';
    const dialogOpeners = new WeakMap();
    const targetById = (hash) => hash?.startsWith('#') ? document.getElementById(hash.slice(1)) : null;
    const getTarget = (element, key) => targetById(element.dataset[key] || element.getAttribute('href'));

    function updateColorMode() {
        const dark = root.dataset.theme === 'dark';
        document.querySelectorAll('[data-color-mode]').forEach(button => {
            const label = dark ? button.dataset.lightLabel : button.dataset.darkLabel;
            button.setAttribute('aria-label', label);
            button.title = label;
            button.firstElementChild.className = dark ? 'ti ti-sun' : 'ti ti-moon';
        });
        document.querySelectorAll('img[data-logo-light], img[data-logo-dark]').forEach(logo => {
            const source = dark ? logo.dataset.logoDark || logo.dataset.logoLight : logo.dataset.logoLight || logo.dataset.logoDark;
            if (source && logo.getAttribute('src') !== source) logo.src = source;
        });
    }
    document.addEventListener('kovil:theme', updateColorMode);
    updateColorMode();

    const dropdowns = [...document.querySelectorAll('details.dropdown')];
    function closeDropdown(dropdown, restoreFocus = false) {
        dropdown.open = false;
        if (restoreFocus) dropdown.querySelector('summary').focus();
    }
    function positionDropdown(dropdown) {
        const panel = dropdown.querySelector('.dropdown-panel');
        panel.style.translate = '';
        const { left, right } = panel.getBoundingClientRect();
        const edge = root.clientWidth - 8;
        const offset = Math.max(8 - left, Math.min(0, edge - right));
        if (offset) panel.style.translate = offset + 'px';
    }
    dropdowns.forEach(dropdown => dropdown.addEventListener('toggle', () => {
        if (!dropdown.open) return;
        dropdowns.filter(other => other !== dropdown && other.open).forEach(other => closeDropdown(other));
        positionDropdown(dropdown);
    }));
    window.addEventListener('resize', () => dropdowns.filter(dropdown => dropdown.open).forEach(positionDropdown));

    function showDialog(dialog, opener = document.activeElement) {
        if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
        dialogOpeners.set(dialog, opener);
        dialog.showModal();
    }
    function closeDialog(dialog) {
        if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
    }
    document.querySelectorAll('dialog').forEach(dialog => {
        dialog.addEventListener('close', () => {
            const notifications = dialog.querySelector('.dialog-notifications');
            const tray = document.querySelector('.toast-container');
            if (notifications && tray) tray.append(...notifications.children);
            const opener = dialogOpeners.get(dialog);
            if (opener?.isConnected) opener.focus();
        });
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const { left, top, right, bottom } = dialog.getBoundingClientRect();
            if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
        });
    });

    function tabGroup(trigger) {
        return trigger.closest('[role="tablist"], .nav, .list-group');
    }
    function selectTab(trigger, updateHash = true) {
        if (!trigger) return;
        if (!trigger.matches(tabSelector)) {
            const panel = getTarget(trigger, 'tab');
            trigger = [...document.querySelectorAll(tabSelector)].find(tab => getTarget(tab, 'tab') === panel);
        }
        const panel = trigger && getTarget(trigger, 'tab');
        const group = trigger && tabGroup(trigger);
        if (!panel || !group) return;
        group.querySelectorAll(tabSelector).forEach(tab => {
            const selected = trigger === tab;
            tab.classList.toggle('active', selected);
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
            const item = getTarget(tab, 'tab');
            if (item) {
                item.classList.toggle('active', selected);
                item.classList.toggle('show', selected);
                item.hidden = !selected;
            }
        });
        if (updateHash) {
            history.replaceState(history.state, '', '#' + panel.id);
            trigger.dispatchEvent(new CustomEvent('kovil:tab-shown', { bubbles: true }));
        }
    }
    function selectHash() {
        const id = location.hash;
        const trigger = [...document.querySelectorAll(tabSelector)].find(tab => getTarget(tab, 'tab')?.id === id.slice(1));
        if (trigger) selectTab(trigger, false);
    }
    const tabs = [...document.querySelectorAll(tabSelector)];
    const tabGroups = new Set(tabs.map(tabGroup));
    tabGroups.forEach(group => {
        if (!group) return;
        const items = [...group.querySelectorAll(tabSelector)];
        selectTab(items.find(tab => tab.classList.contains('active')) || items[0], false);
    });
    selectHash();
    window.addEventListener('hashchange', selectHash);

    function updateCollapseButtons(panel, visible) {
        document.querySelectorAll(collapseSelector).forEach(trigger => {
            if (getTarget(trigger, 'collapse') !== panel) return;
            trigger.classList.toggle('collapsed', !visible);
            trigger.setAttribute('aria-expanded', String(visible));
        });
    }
    function setExpanded(panel, visible) {
        if (!panel) return;
        const group = targetById(panel.dataset.collapseGroup);
        if (visible && group) {
            group.querySelectorAll('[data-collapse-group].show').forEach(other => {
                if (other !== panel && other.dataset.collapseGroup === panel.dataset.collapseGroup) setExpanded(other, false);
            });
        }
        panel.classList.toggle('show', visible);
        panel.hidden = !visible;
        updateCollapseButtons(panel, visible);
        panel.dispatchEvent(new CustomEvent(visible ? 'kovil:expanded' : 'kovil:collapsed', { bubbles: true }));
        if (visible) panel.querySelectorAll('.accordion-body').forEach(body => body.dispatchEvent(new Event('kovil:expanded')));
    }
    document.querySelectorAll(collapseSelector).forEach(trigger => {
        const panel = getTarget(trigger, 'collapse');
        if (panel) updateCollapseButtons(panel, panel.classList.contains('show'));
    });

    document.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const dialogButton = target.closest('[data-open-dialog]');
        const tab = target.closest(tabSelector);
        const collapse = target.closest(collapseSelector);
        const dropdown = target.closest('details.dropdown');
        dropdowns.filter(item => item !== dropdown && item.open).forEach(item => closeDropdown(item));

        if (dialogButton) {
            event.preventDefault();
            showDialog(getTarget(dialogButton, 'openDialog'), dialogButton);
        } else if (target.closest('[data-close-dialog]')) {
            closeDialog(target.closest('dialog'));
        } else if (tab) {
            event.preventDefault();
            selectTab(tab);
        } else if (collapse) {
            event.preventDefault();
            const panel = getTarget(collapse, 'collapse');
            setExpanded(panel, !panel?.classList.contains('show'));
        } else if (target.closest('[data-color-mode]')) {
            window.setKovilTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
        } else if (target.closest('[data-password-toggle]')) {
            const button = target.closest('[data-password-toggle]');
            const input = button.closest('.input-group')?.querySelector('input');
            if (!input) return;
            const reveal = input.type === 'password';
            input.type = reveal ? 'text' : 'password';
            button.firstElementChild.className = reveal ? 'ti ti-eye-off' : 'ti ti-eye';
            button.setAttribute('aria-label', reveal ? button.dataset.hide : button.dataset.show);
        } else if (target.closest('[data-reset-color-mode]')) {
            window.setKovilTheme(null);
            if (dropdown) closeDropdown(dropdown, true);
        } else if (target.closest('[data-locale]')) {
            const { locale } = target.closest('[data-locale]').dataset;
            const secure = location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = 'fossbilling_locale=' + encodeURIComponent(locale) + '; max-age=31536000; path=/; SameSite=Lax' + secure;
            location.reload();
        } else if (target.closest('[data-currency]') && dropdown?.classList.contains('dropdown')) {
            const button = target.closest('[data-currency]');
            button.disabled = true;
            changeCurrency(button.dataset.currency, () => { button.disabled = false; });
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
            const dropdown = dropdowns.find(item => item.open);
            if (dropdown) closeDropdown(dropdown, dropdown.contains(document.activeElement));
        }
        const tab = event.target.closest?.(tabSelector);
        if (!tab) return;
        const group = tabGroup(tab);
        if (!group) return;
        const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        const items = [...group.querySelectorAll(tabSelector)].filter(item => !item.disabled && item.getClientRects().length);
        const current = items.indexOf(tab);
        const backwards = event.key === 'ArrowUp' || event.key === (root.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
            : (current + (backwards ? -1 : 1) + items.length) % items.length;
        if (!items[next]) return;
        event.preventDefault();
        selectTab(items[next]);
        items[next].focus();
    });

    const billing = window.FOSSBilling ||= {};
    billing.message = function (message, type = 'info') {
        const tray = document.querySelector('.toast-container');
        const dialog = document.querySelector('dialog[open]');
        let container = dialog?.querySelector('.dialog-notifications') || tray;
        if (dialog && container === tray) {
            container = document.createElement('div');
            container.className = 'dialog-notifications';
            container.setAttribute('aria-live', 'polite');
            dialog.append(container);
        }
        if (!container) {
            console[type === 'error' ? 'error' : 'info'](message);
            return;
        }
        const item = document.createElement('div');
        item.className = 'notification tone-' + ({ error: 'danger', success: 'success', warning: 'warning' }[type] || 'info');
        const content = document.createElement('span');
        content.textContent = typeof message === 'string' ? message : message?.message || String(message);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn-close';
        close.setAttribute('aria-label', tray?.dataset.closeLabel || 'Close');
        close.addEventListener('click', () => item.remove());
        item.append(content, close);
        container.append(item);
        window.setTimeout(() => {
            if (!item.contains(document.activeElement)) item.remove();
        }, 7000);
    };

    window.flashMessage = function ({ message = '', reload = false, type = 'info' } = {}) {
        if (!message && reload === false) return;
        if (reload) {
            try { sessionStorage.setItem('kovil-flash', JSON.stringify({ message, type })); } catch { /* Navigation still works. */ }
            if (typeof reload === 'string') location.assign(reload);
            else location.reload();
        } else {
            billing.message(message, type);
        }
    };
    try {
        const saved = sessionStorage.getItem('kovil-flash');
        if (saved) {
            sessionStorage.removeItem('kovil-flash');
            window.flashMessage(JSON.parse(saved));
        }
    } catch { /* Storage is optional. */ }

    function changeCurrency(currency, onError = () => {}) {
        billing.api.guest.post('cart/set_currency', { currency }, () => location.reload(), error => {
            onError();
            billing.message(error?.message || error?.code || String(error), 'error');
        });
    }
    document.querySelectorAll('select.currency_selector').forEach(select => {
        select.addEventListener('change', () => changeCurrency(select.value));
    });

    function initPhoneInputs() {
        const create = window.intlTelInput;
        if (typeof create !== 'function') return;
        const countries = create.getAllCountries();
        const supported = new Set(countries.map(country => country.iso2));
        document.querySelectorAll('.js-phone-input').forEach(input => {
            const form = input.form;
            const code = form?.querySelector('[name="phone_cc"], [name$="[phone_cc]"]');
            if (!code || create.getInstance(input)) return;
            const initialCode = code.value.trim();
            const select = form.querySelector('select[name="country"], select[name$="[country]"]');
            const preferred = (select?.value || input.dataset.initialCountry || '').toLowerCase();
            const matching = countries.find(country => country.iso2 === preferred && country.dialCode === initialCode);
            const initialCountry = matching?.iso2 || countries.find(country => country.dialCode === initialCode)?.iso2
                || (supported.has(preferred) ? preferred : '');
            const phone = create(input, { initialCountry, separateDialCode: true });
            function sync() {
                const dialCode = phone.getSelectedCountry().dialCode || code.value;
                code.value = input.value.trim() || initialCode ? dialCode : '';
                if (input.value.trim().startsWith('+') && dialCode) {
                    const international = phone.getNumber();
                    if (international.startsWith('+' + dialCode)) input.value = international.slice(dialCode.length + 1).trim();
                }
            }
            select?.addEventListener('change', () => {
                const country = select.value.toLowerCase();
                if (supported.has(country)) {
                    phone.setSelectedCountry(country);
                    sync();
                }
            });
            input.addEventListener('countrychange', sync);
            input.addEventListener('input', sync);
            form.addEventListener('submit', sync, true);
            sync();
        });
    }
    initPhoneInputs();

    document.querySelectorAll('table.table').forEach(table => {
        let region = table.parentElement.closest('.table-responsive');
        if (!region) {
            region = document.createElement('div');
            region.className = 'table-responsive';
            table.before(region);
            region.append(table);
            table.classList.remove('table-responsive');
        }
        if (!region.hasAttribute('tabindex')) region.tabIndex = 0;
        if (!region.hasAttribute('role')) region.setAttribute('role', 'region');
        if (!region.hasAttribute('aria-label') && !region.hasAttribute('aria-labelledby')) {
            const heading = region.closest('.card')?.querySelector('.card-title');
            region.setAttribute('aria-label', table.caption?.textContent.trim() || heading?.textContent.trim()
                || document.body.dataset.tableLabel || 'Scrollable table');
        }
    });

    const consent = document.getElementById('cookie-consent-block');
    if (consent) {
        let accepted;
        try { accepted = localStorage.getItem('cookie-consent') === '1'; } catch { /* Consent still works for this page. */ }
        if (!accepted) consent.hidden = false;
        consent.querySelector('[data-accept-consent]').addEventListener('click', () => {
            try { localStorage.setItem('cookie-consent', '1'); } catch { /* Consent remains optional. */ }
            consent.hidden = true;
        });
    }

    window.Kovil = { showDialog, closeDialog, selectTab, setExpanded };
})();
