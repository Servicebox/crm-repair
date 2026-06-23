// Kanban board functionality
class Kanban {
    constructor(container, options = {}) {
        this.container = container;
        this.statuses = [];
        this.orders = [];
        this.onOrderClick = options.onOrderClick || (() => { });
        this.onOrderMove = options.onOrderMove || (() => { });
        this.onOrderClose = options.onOrderClose || (() => { });
    }

    setStatuses(statuses) { this.statuses = statuses; }
    setOrders(orders) { this.orders = orders; this.render(); }

    render() {
        this.container.innerHTML = '';
        this.renderMobileTabs();
        this.statuses.forEach((status, idx) => {
            const column = this.createColumn(status);
            if (idx === 0) column.classList.add('active');
            this.container.appendChild(column);
        });
    }

    renderMobileTabs() {
        const tabsContainer = document.getElementById('mobile-kanban-tabs');
        if (!tabsContainer) return;
        tabsContainer.innerHTML = '';
        this.statuses.forEach((status, idx) => {
            const tab = document.createElement('button');
            tab.className = `mobile-tab ${idx === 0 ? 'active' : ''}`;
            tab.textContent = status.name;
            tab.onclick = () => {
                tabsContainer.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.container.querySelectorAll('.kanban-column').forEach(c => {
                    c.classList.toggle('active', c.dataset.statusId == status.id);
                });
            };
            tabsContainer.appendChild(tab);
        });
    }

    createColumn(status) {
        const statusOrders = this.orders.filter(o => o.status_id === status.id);
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.statusId = status.id;
        column.innerHTML = `
            <div class="kanban-column-header">
                <div class="kanban-column-title"><span class="kanban-column-dot" style="background: ${status.color}"></span>${status.name}</div>
                <span class="kanban-column-count">${statusOrders.length}</span>
            </div>
            <div class="kanban-column-body" data-status-id="${status.id}"></div>
        `;
        const body = column.querySelector('.kanban-column-body');
        statusOrders.forEach(order => body.appendChild(this.createOrderCard(order)));
        body.addEventListener('dragover', e => { e.preventDefault(); body.classList.add('drag-over'); });
        body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
        body.addEventListener('drop', e => {
            e.preventDefault();
            body.classList.remove('drag-over');
            const orderId = e.dataTransfer.getData('text/plain');
            const newStatusId = parseInt(body.dataset.statusId);
            const completed = this.statuses.find(s => s.name === 'Завершён');
            if (completed && newStatusId === completed.id) this.onOrderClose(orderId);
            else this.onOrderMove(orderId, newStatusId);
        });
        return column;
    }

    createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.draggable = true;
        card.dataset.orderId = order.id;
        const timeAgo = this.getTimeAgo(order.created_at);
        const status = this.statuses.find(s => s.id === order.status_id);
        card.innerHTML = `
            <div class="order-card-header">
                <div>${order.order_number ? `<div class="order-card-number">#${order.order_number}</div>` : ''}<div class="order-card-address">${order.address || 'Без адреса'}</div>${order.metro ? `<div class="order-card-metro">м. ${order.metro}</div>` : ''}</div>
                <div class="order-card-time">${order.scheduled_time || timeAgo}</div>
            </div>
            ${order.problem ? `<div class="order-card-problem">${order.problem}</div>` : ''}
            <div class="order-card-footer">
                <div style="display:flex;gap:8px;">${order.source_name ? `<span class="order-card-source">${order.source_name}</span>` : ''}${order.master_nick ? `<span class="order-card-master">@${order.master_nick}</span>` : ''}</div>
                <div style="display:flex;gap:8px;">${order.amount ? `<span class="order-card-amount">${this.formatMoney(order.amount)}</span>` : ''}<button class="status-change-btn"><span class="status-dot" style="background: ${status?.color || '#666'}"></span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></button></div>
            </div>
        `;
        card.querySelector('.status-change-btn').onclick = (e) => { e.stopPropagation(); this.openStatusSheet(order); };
        card.onclick = (e) => { if (!e.target.closest('.status-change-btn')) this.onOrderClick(order); };
        card.ondragstart = (e) => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', order.id); e.dataTransfer.effectAllowed = 'move'; };
        card.ondragend = () => card.classList.remove('dragging');
        return card;
    }

    getTimeAgo(dateString) {
        const date = new Date(dateString), now = new Date(), diff = now - date;
        const minutes = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
        if (minutes < 1) return 'только что';
        if (minutes < 60) return `${minutes} мин`;
        if (hours < 24) return `${hours} ч`;
        if (days < 7) return `${days} дн`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }

    formatMoney(amount) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount); }

    updateOrder(order) {
        const index = this.orders.findIndex(o => o.id === order.id);
        if (index !== -1) this.orders[index] = order;
        this.render();
    }
    addOrder(order) { this.orders.unshift(order); this.render(); }
    removeOrder(orderId) { this.orders = this.orders.filter(o => o.id !== orderId); this.render(); }

    renderStatusSheetContainer() {
        if (document.getElementById('status-sheet-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'status-sheet-overlay';
        overlay.className = 'status-sheet-overlay';
        overlay.innerHTML = `<div class="status-sheet"><div class="status-sheet-header"><div class="status-sheet-title">Изменить статус</div><button class="status-sheet-close"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="status-sheet-options" id="status-sheet-options"></div></div>`;
        document.body.appendChild(overlay);
        const closeSheet = () => { overlay.classList.remove('active'); setTimeout(() => overlay.style.visibility = 'hidden', 300); };
        overlay.querySelector('.status-sheet-close').onclick = closeSheet;
        overlay.onclick = (e) => { if (e.target === overlay) closeSheet(); };
        this.statusSheet = { overlay, optionsContainer: overlay.querySelector('#status-sheet-options'), close: closeSheet };
    }

    openStatusSheet(order) {
        if (!this.statusSheet) this.renderStatusSheetContainer();
        const { overlay, optionsContainer } = this.statusSheet;
        optionsContainer.innerHTML = this.statuses.map(s => `<div class="status-sheet-option ${s.id === order.status_id ? 'active' : ''}" data-status-id="${s.id}"><span class="status-dot" style="background: ${s.color}"></span>${s.name}${s.id === order.status_id ? '<svg style="margin-left:auto;color:var(--accent)" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>`).join('');
        optionsContainer.querySelectorAll('.status-sheet-option').forEach(opt => {
            opt.onclick = () => {
                const newStatusId = parseInt(opt.dataset.statusId);
                this.statusSheet.close();
                if (newStatusId === order.status_id) return;
                const completed = this.statuses.find(s => s.name === 'Завершён');
                if (completed && newStatusId === completed.id) this.onOrderClose(order.id);
                else this.onOrderMove(order.id, newStatusId);
            };
        });
        overlay.style.visibility = 'visible';
        overlay.offsetHeight;
        overlay.classList.add('active');
    }
}