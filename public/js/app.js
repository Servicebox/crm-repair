// Main application
class App {
    constructor() {
        this.currentPage = 'orders';
        this.statuses = [];
        this.sources = [];
        this.masters = [];
        this.customFields = [];
        this.kanban = null;
        this.statsPeriod = 'week';
        this.init();
    }

    async init() {
        const token = api.getToken();
        if (!token) {
            await this.checkNeedRegistration();
            this.showAuthPage();
            return;
        }
        try {
            await api.getMe();
            this.showApp();
            await this.loadInitialData();
        } catch (error) {
            this.showAuthPage();
        }
    }

    async checkNeedRegistration() {
        try {
            const { needsRegistration } = await api.checkAuth();
            const authBtn = document.getElementById('auth-btn');
            if (needsRegistration) {
                authBtn.textContent = 'Зарегистрироваться';
                authBtn.dataset.mode = 'register';
            } else {
                authBtn.textContent = 'Войти';
                authBtn.dataset.mode = 'login';
            }
        } catch (error) {
            console.error('Check auth error:', error);
        }
    }

    showAuthPage() {
        document.getElementById('auth-page').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
        this.setupAuthHandlers();
    }

    showApp() {
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        this.setupAppHandlers();
    }

    setupAuthHandlers() {
        const form = document.getElementById('auth-form');
        const authBtn = document.getElementById('auth-btn');
        const errorEl = document.getElementById('auth-error');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const mode = authBtn.dataset.mode || 'login';
            errorEl.classList.add('hidden');
            authBtn.disabled = true;
            authBtn.textContent = 'Загрузка...';
            try {
                if (mode === 'register') await api.register(username, password);
                else await api.login(username, password);
                this.showApp();
                await this.loadInitialData();
            } catch (error) {
                errorEl.textContent = error.message;
                errorEl.classList.remove('hidden');
                authBtn.disabled = false;
                authBtn.textContent = mode === 'register' ? 'Зарегистрироваться' : 'Войти';
            }
        });
    }

    setupAppHandlers() {
        document.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const page = el.dataset.page;
                this.navigateTo(page);
                history.pushState({ page }, '', `/${page}`);
            });
        });
        document.getElementById('btn-stats').addEventListener('click', () => {
            this.navigateTo('stats');
            history.pushState({ page: 'stats' }, '', '/stats');
        });
        document.getElementById('btn-settings').addEventListener('click', () => {
            this.navigateTo('settings');
            this.renderSettingsUsers();
            this.renderCustomFieldsSettings();
            history.pushState({ page: 'settings' }, '', '/settings');
        });
        window.addEventListener('popstate', (event) => {
            this.navigateTo(event.state?.page || 'orders');
        });
        document.getElementById('btn-logout').addEventListener('click', () => this.logout());
        document.getElementById('btn-logout-settings').addEventListener('click', () => this.logout());
        document.getElementById('btn-add-order').addEventListener('click', () => this.openOrderModal());
        this.setupModalHandlers();
        this.setupSearchHandlers();
        this.setupSettingsHandlers();
        document.querySelectorAll('#stats-period .period-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('#stats-period .period-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.statsPeriod = tab.dataset.period;
                this.loadStats();
            });
        });
    }

    setupModalHandlers() {
        const orderModal = document.getElementById('modal-order');
        const closeOrderModal = () => orderModal.classList.remove('active');
        document.getElementById('modal-order-close').addEventListener('click', closeOrderModal);
        document.getElementById('modal-order-cancel').addEventListener('click', closeOrderModal);
        orderModal.addEventListener('click', (e) => { if (e.target === orderModal) closeOrderModal(); });
        document.getElementById('modal-order-save').addEventListener('click', () => this.saveOrder());
        document.getElementById('modal-order-delete').addEventListener('click', () => this.deleteOrder());
        document.getElementById('modal-order-copy').addEventListener('click', () => this.copyOrderToClipboard());

        const phoneInput = document.getElementById('order-phone');
        const phoneError = document.getElementById('phone-error');
        let phoneDebounceTimer;
        phoneInput.addEventListener('input', (e) => {
            let value = phoneInput.value;
            if (e.inputType === 'deleteContentBackward') return;
            let digits = value.replace(/\D/g, '');
            if (digits.startsWith('7') || digits.startsWith('8')) digits = digits.substring(1);
            digits = digits.substring(0, 10);
            let formatted = '+7';
            if (digits.length > 0) formatted += digits;
            phoneInput.value = formatted;
            phoneInput.classList.remove('error');
            phoneError.classList.add('hidden');
            clearTimeout(phoneDebounceTimer);
            if (digits.length === 10) {
                phoneDebounceTimer = setTimeout(() => {
                    const orderId = document.getElementById('order-id').value;
                    this.loadPhoneHistory(formatted, orderId);
                }, 500);
            }
        });
        phoneInput.addEventListener('blur', () => {
            const phone = phoneInput.value.trim();
            if (phone && phone.length < 12) {
                phoneInput.classList.add('error');
                phoneError.classList.remove('hidden');
            }
        });

        const recordingInput = document.getElementById('order-recording');
        const recordingPlayer = document.getElementById('recording-player');
        const recordingAudio = document.getElementById('recording-audio');
        recordingInput.addEventListener('input', () => {
            const url = recordingInput.value.trim();
            if (url) {
                recordingAudio.src = url;
                recordingPlayer.classList.remove('hidden');
            } else {
                recordingAudio.src = '';
                recordingPlayer.classList.add('hidden');
            }
        });

        const closeModal = document.getElementById('modal-close-order');
        const closeCloseModal = () => closeModal.classList.remove('active');
        document.getElementById('modal-close-order-close').addEventListener('click', closeCloseModal);
        document.getElementById('modal-close-order-cancel').addEventListener('click', closeCloseModal);
        closeModal.addEventListener('click', (e) => { if (e.target === closeModal) closeCloseModal(); });
        document.getElementById('close-order-amount').addEventListener('input', (e) => {
            const amount = parseFloat(e.target.value) || 0;
            document.getElementById('close-order-my-share').textContent = this.formatMoney(amount / 2);
            document.getElementById('close-order-master-share').textContent = this.formatMoney(amount / 2);
        });
        document.getElementById('modal-close-order-confirm').addEventListener('click', () => this.confirmCloseOrder());

        const masterModal = document.getElementById('modal-master');
        const closeMasterModal = () => masterModal.classList.remove('active');
        document.getElementById('modal-master-close').addEventListener('click', closeMasterModal);
        document.getElementById('modal-master-cancel').addEventListener('click', closeMasterModal);
        masterModal.addEventListener('click', (e) => { if (e.target === masterModal) closeMasterModal(); });
        document.getElementById('modal-master-confirm').addEventListener('click', () => this.confirmAssignMaster());

        this.setupCustomFieldModal();
    }

    setupSearchHandlers() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const searchContainer = document.getElementById('search-container');
        const mobileSearchBtn = document.getElementById('btn-search');
        const searchCloseBtn = document.getElementById('search-close-btn');
        let debounceTimer;

        if (mobileSearchBtn) {
            mobileSearchBtn.addEventListener('click', () => {
                searchContainer.classList.add('active');
                searchInput.focus();
            });
        }
        if (searchCloseBtn) {
            searchCloseBtn.addEventListener('click', () => {
                searchContainer.classList.remove('active');
                searchInput.value = '';
                searchResults.classList.add('hidden');
            });
        }
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchContainer.classList.remove('active');
                searchInput.value = '';
                searchResults.classList.add('hidden');
            }
        });
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = searchInput.value.trim();
            if (query.length < 2) {
                searchResults.classList.add('hidden');
                return;
            }
            debounceTimer = setTimeout(async () => {
                try {
                    const orders = await api.searchOrders(query);
                    if (orders.length === 0) {
                        searchResults.innerHTML = '<div class="search-result-item">Ничего не найдено</div>';
                    } else {
                        searchResults.innerHTML = orders.map(o => `
                            <div class="search-result-item" data-order-id="${o.id}">
                                <div class="search-result-address">${o.address || 'Без адреса'}</div>
                                <div class="search-result-info">
                                    <span>${o.client_name || ''}</span>
                                    <span>${o.device_type || ''}</span>
                                </div>
                            </div>
                        `).join('');
                    }
                    searchResults.classList.remove('hidden');
                } catch (error) {
                    console.error('Search error:', error);
                }
            }, 300);
        });
        searchResults.addEventListener('click', async (e) => {
            const item = e.target.closest('.search-result-item');
            if (item && item.dataset.orderId) {
                const order = await api.getOrder(item.dataset.orderId);
                this.openOrderModal(order);
                searchResults.classList.add('hidden');
                searchInput.value = '';
                searchContainer.classList.remove('active');
            }
        });
        searchInput.addEventListener('blur', () => setTimeout(() => searchResults.classList.add('hidden'), 200));
    }

    setupSettingsHandlers() {
        document.getElementById('btn-save-source').addEventListener('click', async () => {
            const name = document.getElementById('new-source-name').value.trim();
            if (!name) return;
            try {
                await api.createSource(name);
                document.getElementById('new-source-name').value = '';
                await this.loadSources();
                this.renderSettingsSources();
                this.showToast('Источник добавлен', 'success');
            } catch (error) {
                this.showToast(error.message, 'error');
            }
        });
        document.getElementById('btn-add-user').addEventListener('click', async () => {
            const loginInput = document.getElementById('new-user-login');
            const passInput = document.getElementById('new-user-pass');
            const roleSelect = document.getElementById('new-user-role');
            const username = loginInput.value.trim();
            const password = passInput.value;
            const role = roleSelect.value;
            if (!username || !password) {
                this.showToast('Введите логин и пароль', 'error');
                return;
            }
            try {
                await api.createUser(username, password, role);
                loginInput.value = '';
                passInput.value = '';
                this.renderSettingsUsers();
                this.showToast('Пользователь создан', 'success');
            } catch (error) {
                this.showToast(error.message, 'error');
            }
        });
        document.getElementById('btn-change-pass').addEventListener('click', async () => {
            const current = document.getElementById('change-pass-current').value;
            const newPass = document.getElementById('change-pass-new').value;
            if (!current || !newPass) {
                this.showToast('Заполните все поля', 'error');
                return;
            }
            try {
                await api.changePassword(current, newPass);
                document.getElementById('change-pass-current').value = '';
                document.getElementById('change-pass-new').value = '';
                this.showToast('Пароль изменён', 'success');
            } catch (error) {
                this.showToast(error.message, 'error');
            }
        });
        document.getElementById('btn-add-custom-field').addEventListener('click', () => this.openCustomFieldModal());
    }

    async loadInitialData() {
        try {
            const [statuses, sources, masters, customFields] = await Promise.all([
                api.getStatuses(),
                api.getSources(),
                api.getMasters(),
                api.getCustomFields()
            ]);
            this.statuses = statuses;
            this.sources = sources;
            this.masters = masters;
            this.customFields = customFields;
            this.renderSourcesSelect();
            this.renderMastersSelect();
            await this.loadOrders();
        } catch (error) {
            console.error('Load initial data error:', error);
            this.showToast('Ошибка загрузки данных', 'error');
        }
    }

    async loadOrders() {
        const kanbanEl = document.getElementById('kanban');
        kanbanEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        try {
            const orders = await api.getOrders();
            if (!this.kanban) {
                this.kanban = new Kanban(kanbanEl, {
                    onOrderClick: (order) => this.openOrderModal(order),
                    onOrderMove: (orderId, statusId) => this.moveOrder(orderId, statusId),
                    onOrderClose: (orderId) => this.openCloseOrderModal(orderId)
                });
            }
            this.kanban.setStatuses(this.statuses);
            this.kanban.setOrders(orders);
        } catch (error) {
            console.error('Load orders error:', error);
            this.showToast('Ошибка загрузки заказов', 'error');
        }
    }

    async loadSources() {
        this.sources = await api.getSources();
        this.renderSourcesSelect();
    }

    async loadMasters() {
        this.masters = await api.getMasters();
        this.renderMastersSelect();
    }

    renderSourcesSelect() {
        const select = document.getElementById('order-source');
        select.innerHTML = '<option value="">Не указано</option>' + this.sources.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    renderMastersSelect() {
        const select = document.getElementById('order-master');
        if (!select) return;
        select.innerHTML = '<option value="">Не назначен</option>' +
            this.masters.map(m => `<option value="${m.id}">@${m.telegram_nick}</option>`).join('');
    }

    renderSettingsSources() {
        const container = document.getElementById('settings-sources');
        container.innerHTML = this.sources.map(source => `
            <div class="chip">
                ${source.name}
                <button class="chip-delete" data-source-id="${source.id}" title="Удалить">×</button>
            </div>
        `).join('');
        container.querySelectorAll('.chip-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Удалить источник?')) {
                    try {
                        await api.deleteSource(btn.dataset.sourceId);
                        await this.loadSources();
                        this.renderSettingsSources();
                        this.showToast('Источник удалён', 'success');
                    } catch (error) {
                        this.showToast(error.message, 'error');
                    }
                }
            });
        });
    }

    async renderSettingsUsers() {
        const container = document.getElementById('settings-users');
        if (!container) return;
        container.innerHTML = '<div class="loading-small">Загрузка...</div>';
        try {
            const users = await api.getUsers();
            if (users.length === 0) {
                container.innerHTML = '<div class="text-muted">Нет пользователей</div>';
                return;
            }
            container.innerHTML = users.map(user => `
                <div class="chip" style="justify-content: space-between; width: 100%;">
                    <span>${user.username} <span class="text-muted">(${user.role === 'admin' ? 'Админ' : user.role === 'master' ? 'Мастер' : 'Менеджер'})</span></span>
                    <button class="chip-delete" data-user-id="${user.id}" title="Удалить">×</button>
                </div>
            `).join('');
            container.querySelectorAll('.chip-delete').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Удалить пользователя?')) {
                        try {
                            await api.deleteUser(btn.dataset.userId);
                            this.renderSettingsUsers();
                            this.showToast('Пользователь удалён', 'success');
                        } catch (error) {
                            this.showToast(error.message, 'error');
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Render users error:', error);
            container.innerHTML = '<div class="text-error">Ошибка загрузки</div>';
        }
    }

    async renderCustomFieldsSettings() {
        const container = document.getElementById('custom-fields-list');
        if (!container) return;
        if (!this.customFields.length) {
            container.innerHTML = '<div class="text-muted">Нет дополнительных полей</div>';
            return;
        }
        container.innerHTML = this.customFields.map(field => `
            <div class="chip" style="justify-content: space-between; width: 100%;">
                <span><strong>${field.name}</strong> (${field.field_key}) - ${field.field_type} ${field.required ? 'обяз.' : ''}</span>
                <button class="chip-delete" data-field-id="${field.id}" title="Удалить">×</button>
            </div>
        `).join('');
        container.querySelectorAll('.chip-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Удалить поле? Все значения в заказах будут удалены.')) {
                    try {
                        await api.deleteCustomField(btn.dataset.fieldId);
                        this.customFields = await api.getCustomFields();
                        this.renderCustomFieldsSettings();
                        this.showToast('Поле удалено', 'success');
                    } catch (error) {
                        this.showToast(error.message, 'error');
                    }
                }
            });
        });
    }

    async moveOrder(orderId, statusId) {
        try {
            const order = await api.updateOrderStatus(orderId, statusId);
            this.kanban.updateOrder(order);
            this.showToast('Статус обновлён', 'success');
            this.loadMasters();
        } catch (error) {
            if (error.message && error.message.includes('мастера')) {
                this.openMasterModal(orderId, statusId);
            } else {
                this.showToast(error.message, 'error');
            }
        }
    }

    openMasterModal(orderId, statusId) {
        document.getElementById('master-order-id').value = orderId;
        document.getElementById('master-status-id').value = statusId;
        const masterSelect = document.getElementById('master-select');
        if (masterSelect) {
            masterSelect.innerHTML = '<option value="">Выберите мастера</option>' +
                this.masters.map(m => `<option value="${m.id}">@${m.telegram_nick}</option>`).join('');
        }
        document.getElementById('modal-master').classList.add('active');
    }

    async confirmAssignMaster() {
        const orderId = document.getElementById('master-order-id').value;
        const statusId = document.getElementById('master-status-id').value;
        const masterId = document.getElementById('master-select').value;
        if (!masterId) {
            this.showToast('Выберите мастера', 'error');
            return;
        }
        try {
            const order = await api.updateOrderStatus(orderId, parseInt(statusId), parseInt(masterId));
            this.kanban.updateOrder(order);
            document.getElementById('modal-master').classList.remove('active');
            this.showToast('Мастер назначен', 'success');
            this.loadMasters();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    openOrderModal(order = null) {
        const modal = document.getElementById('modal-order');
        const title = document.getElementById('modal-order-title');
        const deleteBtn = document.getElementById('modal-order-delete');
        const phoneInput = document.getElementById('order-phone');
        const phoneError = document.getElementById('phone-error');
        const phoneHistory = document.getElementById('phone-history');
        const recordingPlayer = document.getElementById('recording-player');
        const recordingAudio = document.getElementById('recording-audio');

        phoneInput.classList.remove('error');
        phoneError.classList.add('hidden');
        phoneHistory.classList.add('hidden');
        recordingPlayer.classList.add('hidden');
        recordingAudio.src = '';

        if (order) {
            const orderNum = order.order_number ? ` #${order.order_number}` : '';
            title.textContent = `Заказ${orderNum}`;
            deleteBtn.classList.remove('hidden');
            document.getElementById('order-id').value = order.id;
            document.getElementById('order-client').value = order.client_name || '';
            document.getElementById('order-phone').value = order.phone || '';
            document.getElementById('order-device-type').value = order.device_type || '';
            document.getElementById('order-device-model').value = order.device_model || '';
            document.getElementById('order-condition').value = order.condition || '';
            document.getElementById('order-accessories').value = order.accessories || '';
            document.getElementById('order-address').value = order.address || '';
            document.getElementById('order-metro').value = order.metro || '';
            document.getElementById('order-time').value = order.scheduled_time || '';
            document.getElementById('order-problem').value = order.problem || '';
            document.getElementById('order-comment').value = order.comment || '';
            document.getElementById('order-source').value = order.source_id || '';
            document.getElementById('order-master').value = order.master_id || '';
            document.getElementById('order-recording').value = order.recording_url || '';
            if (order.recording_url) {
                recordingAudio.src = order.recording_url;
                recordingPlayer.classList.remove('hidden');
            }
            if (order.phone) this.loadPhoneHistory(order.phone, order.id);
        } else {
            title.textContent = 'Новый заказ';
            deleteBtn.classList.add('hidden');
            document.getElementById('order-id').value = '';
            document.getElementById('order-form').reset();
            document.getElementById('order-client').value = '';
            document.getElementById('order-phone').value = '';
            document.getElementById('order-device-type').value = '';
            document.getElementById('order-device-model').value = '';
            document.getElementById('order-condition').value = '';
            document.getElementById('order-accessories').value = '';
            document.getElementById('order-address').value = '';
            document.getElementById('order-metro').value = '';
            document.getElementById('order-time').value = '';
            document.getElementById('order-problem').value = '';
            document.getElementById('order-comment').value = '';
            document.getElementById('order-source').value = '';
            document.getElementById('order-master').value = '';
            document.getElementById('order-recording').value = '';
        }
        this.renderCustomFieldsInModal(order?.custom_fields || {});
        modal.classList.add('active');
        document.getElementById('order-client').focus();
    }

    renderCustomFieldsInModal(values = {}) {
        const container = document.getElementById('order-custom-fields');
        container.innerHTML = '';
        for (const field of this.customFields) {
            const val = values[field.field_key] || '';
            const requiredAttr = field.required ? 'required' : '';
            let inputHtml = '';
            if (field.field_type === 'select') {
                let options = [];
                try { options = JSON.parse(field.options); } catch (e) { options = []; }
                inputHtml = `<select id="cf_${field.field_key}" class="form-select" data-field-key="${field.field_key}" ${requiredAttr}>
                    <option value="">-- Выберите --</option>
                    ${options.map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>`;
            } else if (field.field_type === 'date') {
                inputHtml = `<input type="date" id="cf_${field.field_key}" class="form-input" value="${val}" ${requiredAttr}>`;
            } else if (field.field_type === 'number') {
                inputHtml = `<input type="number" id="cf_${field.field_key}" class="form-input" value="${val}" ${requiredAttr}>`;
            } else {
                inputHtml = `<input type="text" id="cf_${field.field_key}" class="form-input" value="${val}" ${requiredAttr}>`;
            }
            container.innerHTML += `
                <div class="form-group">
                    <label class="form-label">${field.name} ${field.required ? '<span style="color: var(--danger);">*</span>' : ''}</label>
                    ${inputHtml}
                </div>
            `;
        }
    }

    validatePhone(phone) {
        if (!phone) return true;
        return /^\+7\d{10}$/.test(phone);
    }

    async loadPhoneHistory(phone, excludeOrderId = null) {
        const phoneHistory = document.getElementById('phone-history');
        const phoneHistoryList = document.getElementById('phone-history-list');
        if (!phone || !this.validatePhone(phone)) {
            phoneHistory.classList.add('hidden');
            return;
        }
        try {
            const orders = await api.getOrdersByPhone(phone);
            const filtered = excludeOrderId ? orders.filter(o => o.id != excludeOrderId) : orders;
            if (filtered.length === 0) {
                phoneHistory.classList.add('hidden');
                return;
            }
            phoneHistoryList.innerHTML = filtered.slice(0, 5).map(o => `
                <div class="phone-history-item" data-order-id="${o.id}">
                    <div class="phone-history-item-header">
                        <span class="phone-history-item-number">#${o.order_number || o.id}</span>
                        <span class="phone-history-item-date">${this.formatDate(o.created_at)}</span>
                    </div>
                    <div class="phone-history-item-address">${o.address || 'Без адреса'}</div>
                    <span class="phone-history-item-status" style="background: ${o.status_color}22; color: ${o.status_color}">${o.status_name}</span>
                </div>
            `).join('');
            phoneHistory.classList.remove('hidden');
            phoneHistoryList.querySelectorAll('.phone-history-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const order = await api.getOrder(item.dataset.orderId);
                    document.getElementById('modal-order').classList.remove('active');
                    setTimeout(() => this.openOrderModal(order), 100);
                });
            });
        } catch (error) {
            console.error('Load phone history error:', error);
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    async saveOrder() {
        const orderId = document.getElementById('order-id').value;
        const phoneInput = document.getElementById('order-phone');
        const phoneError = document.getElementById('phone-error');
        const phone = phoneInput.value.trim();

        if (phone && !this.validatePhone(phone)) {
            phoneInput.classList.add('error');
            phoneError.classList.remove('hidden');
            this.showToast('Телефон должен быть в формате +7XXXXXXXXXX', 'error');
            return;
        }

        const data = {
            client_name: document.getElementById('order-client').value.trim(),
            phone: phone,
            device_type: document.getElementById('order-device-type').value,
            device_model: document.getElementById('order-device-model').value.trim(),
            condition: document.getElementById('order-condition').value.trim(),
            accessories: document.getElementById('order-accessories').value.trim(),
            address: document.getElementById('order-address').value.trim(),
            metro: document.getElementById('order-metro').value.trim(),
            scheduled_time: document.getElementById('order-time').value.trim(),
            problem: document.getElementById('order-problem').value.trim(),
            comment: document.getElementById('order-comment').value.trim(),
            source_id: document.getElementById('order-source').value || null,
            master_id: document.getElementById('order-master').value || null,
            recording_url: document.getElementById('order-recording').value.trim(),
            custom_fields: {}
        };

        for (const field of this.customFields) {
            const el = document.getElementById(`cf_${field.field_key}`);
            if (el) {
                const val = el.value.trim();
                if (field.required && !val) {
                    this.showToast(`Поле "${field.name}" обязательно`, 'error');
                    return;
                }
                if (val) data.custom_fields[field.field_key] = val;
            }
        }

        try {
            let order;
            if (orderId) {
                order = await api.updateOrder(orderId, data);
                this.kanban.updateOrder(order);
                this.showToast('Заказ обновлён', 'success');
            } else {
                order = await api.createOrder(data);
                this.kanban.addOrder(order);
                this.showToast('Заказ создан', 'success');
            }
            document.getElementById('modal-order').classList.remove('active');
            this.loadMasters();
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async deleteOrder() {
        const orderId = document.getElementById('order-id').value;
        if (!orderId || !confirm('Удалить заказ?')) return;
        try {
            await api.deleteOrder(orderId);
            this.kanban.removeOrder(parseInt(orderId));
            document.getElementById('modal-order').classList.remove('active');
            this.showToast('Заказ удалён', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    async copyOrderToClipboard() {
        const orderId = document.getElementById('order-id').value;
        if (!orderId) {
            this.showToast('Сначала сохраните заказ', 'error');
            return;
        }
        try {
            const order = await api.getOrder(orderId);
            let text = '';
            if (order.order_number) text += `Заказ #${order.order_number}\n`;
            if (order.client_name) text += `Клиент: ${order.client_name}\n`;
            if (order.phone) text += `Телефон: ${order.phone}\n`;
            if (order.device_type) text += `Устройство: ${order.device_type} ${order.device_model || ''}\n`;
            if (order.condition) text += `Состояние: ${order.condition}\n`;
            if (order.accessories) text += `Комплектация: ${order.accessories}\n`;
            if (order.address) text += `Адрес: ${order.address}\n`;
            if (order.metro) text += `Метро: ${order.metro}\n`;
            if (order.problem) text += `Проблема: ${order.problem}\n`;
            if (order.comment) text += `Комментарий: ${order.comment}\n`;
            if (order.scheduled_time) text += `Время: ${order.scheduled_time}\n`;
            if (order.master_nick) text += `Мастер: @${order.master_nick}\n`;
            if (order.source_name) text += `Источник: ${order.source_name}\n`;
            if (order.recording_url) text += `Запись: ${order.recording_url}\n`;
            await navigator.clipboard.writeText(text.trim());
            this.showToast('Скопировано', 'success');
        } catch (error) {
            this.showToast('Ошибка копирования', 'error');
        }
    }

    openCloseOrderModal(orderId) {
        document.getElementById('close-order-id').value = orderId;
        document.getElementById('close-order-amount').value = '';
        document.getElementById('close-order-my-share').textContent = '0 ₽';
        document.getElementById('close-order-master-share').textContent = '0 ₽';
        document.getElementById('modal-close-order').classList.add('active');
        document.getElementById('close-order-amount').focus();
    }

    async confirmCloseOrder() {
        const orderId = document.getElementById('close-order-id').value;
        const amount = parseFloat(document.getElementById('close-order-amount').value) || 0;
        if (amount <= 0) {
            this.showToast('Укажите сумму заказа', 'error');
            return;
        }
        try {
            const order = await api.closeOrder(orderId, amount);
            this.kanban.updateOrder(order);
            document.getElementById('modal-close-order').classList.remove('active');
            this.showToast(`Заказ закрыт! Ваша доля: ${this.formatMoney(amount / 2)}`, 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    navigateTo(page) {
        this.currentPage = page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        const fab = document.getElementById('btn-add-order');
        fab.style.display = page === 'orders' ? 'flex' : 'none';
        if (page === 'stats') this.loadStats();
        else if (page === 'settings') {
            this.renderSettingsSources();
            this.renderSettingsUsers();
            this.renderCustomFieldsSettings();
        }
    }

    async loadStats() {
        try {
            const [overview, masters, sources] = await Promise.all([
                api.getStatsOverview(),
                api.getStatsMasters(this.statsPeriod),
                api.getStatsSources(this.statsPeriod)
            ]);
            const periodData = this.statsPeriod === 'day' ? overview.today :
                this.statsPeriod === 'week' ? overview.week :
                    this.statsPeriod === 'month' ? overview.month : overview.allTime;
            const statsContainer = document.getElementById('stats-overview');
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-card-header"><span>Заработано</span><span>💰</span></div>
                    <div class="stat-card-value">${this.formatMoney(periodData.my_earnings)}</div>
                    <div class="stat-card-label">Ваша доля (50%)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header"><span>Общая сумма</span><span>📊</span></div>
                    <div class="stat-card-value">${this.formatMoney(periodData.total)}</div>
                    <div class="stat-card-label">${periodData.orders} заказов</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header"><span>Активные заказы</span><span>📋</span></div>
                    <div class="stat-card-value">${overview.activeOrders}</div>
                    <div class="stat-card-label">В работе</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header"><span>Средний чек</span><span>🧾</span></div>
                    <div class="stat-card-value">${this.formatMoney(overview.allTime.avg_check)}</div>
                    <div class="stat-card-label">За всё время</div>
                </div>
            `;
            const mastersContainer = document.getElementById('stats-masters');
            if (masters.length === 0) {
                mastersContainer.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет данных</td></tr>';
            } else {
                mastersContainer.innerHTML = masters.map(m => `
                    <tr>
                        <td><strong>@${m.telegram_nick}</strong></td>
                        <td>${m.orders_count}</td>
                        <td>${this.formatMoney(m.total_amount)}</td>
                        <td style="color: var(--accent);">${this.formatMoney(m.total_earned)}</td>
                        <td>${this.formatMoney(m.avg_check)}</td>
                    </tr>
                `).join('');
            }
            const sourcesContainer = document.getElementById('stats-sources');
            if (sources.length === 0) {
                sourcesContainer.innerHTML = '<tr><td colspan="4" style="text-align: center;">Нет данных</td></tr>';
            } else {
                sourcesContainer.innerHTML = sources.map(s => `
                    <tr>
                        <td><strong>${s.name}</strong></td>
                        <td>${s.orders_count}</td>
                        <td>${this.formatMoney(s.total_amount)}</td>
                        <td>${this.formatMoney(s.avg_check)}</td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('Load stats error:', error);
            this.showToast('Ошибка загрузки статистики', 'error');
        }
    }

    setupCustomFieldModal() {
        const modal = document.getElementById('modal-custom-field');
        const closeModal = () => modal.classList.remove('active');
        document.getElementById('modal-custom-field-close').addEventListener('click', closeModal);
        document.getElementById('modal-custom-field-cancel').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        document.getElementById('custom-field-type').addEventListener('change', () => {
            const optionsGroup = document.getElementById('custom-field-options-group');
            optionsGroup.style.display = document.getElementById('custom-field-type').value === 'select' ? 'block' : 'none';
        });
        document.getElementById('modal-custom-field-save').addEventListener('click', async () => {
            const name = document.getElementById('custom-field-name').value.trim();
            const key = document.getElementById('custom-field-key').value.trim();
            const type = document.getElementById('custom-field-type').value;
            const required = document.getElementById('custom-field-required').checked;
            let options = null;
            if (type === 'select') {
                const opts = document.getElementById('custom-field-options').value;
                options = opts.split(',').map(s => s.trim()).filter(s => s);
            }
            if (!name || !key) {
                this.showToast('Заполните название и ключ', 'error');
                return;
            }
            try {
                await api.createCustomField({ name, field_key: key, field_type: type, options, required });
                this.customFields = await api.getCustomFields();
                this.renderCustomFieldsSettings();
                closeModal();
                this.showToast('Поле добавлено', 'success');
            } catch (error) {
                this.showToast(error.message, 'error');
            }
        });
    }

    openCustomFieldModal() {
        document.getElementById('custom-field-name').value = '';
        document.getElementById('custom-field-key').value = '';
        document.getElementById('custom-field-type').value = 'text';
        document.getElementById('custom-field-options').value = '';
        document.getElementById('custom-field-required').checked = false;
        document.getElementById('custom-field-options-group').style.display = 'none';
        document.getElementById('modal-custom-field').classList.add('active');
    }

    logout() {
        api.setToken(null);
        window.location.reload();
    }

    formatMoney(amount) {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount || 0);
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW registration failed:', err));
    });
}