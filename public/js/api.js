const API_URL = '/api';

class Api {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        if (token) localStorage.setItem('token', token);
        else localStorage.removeItem('token');
    }

    getToken() { return this.token; }

    async request(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ошибка сервера');
        return data;
    }

    // Auth
    async checkAuth() { return this.request('/auth/check'); }
    async login(username, password) {
        const data = await this.request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        this.setToken(data.token);
        return data;
    }
    async register(username, password) {
        const data = await this.request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
        this.setToken(data.token);
        return data;
    }
    async getMe() { return this.request('/auth/me'); }
    async getUsers() { return this.request('/auth/users'); }
    async createUser(username, password, role = 'manager') {
        return this.request('/auth/users', { method: 'POST', body: JSON.stringify({ username, password, role }) });
    }
    async deleteUser(id) { return this.request(`/auth/users/${id}`, { method: 'DELETE' }); }
    async changePassword(currentPassword, newPassword) {
        return this.request('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) });
    }

    // Orders
    async getOrders() { return this.request('/orders'); }
    async getOrder(id) { return this.request(`/orders/${id}`); }
    async createOrder(data) { return this.request('/orders', { method: 'POST', body: JSON.stringify(data) }); }
    async updateOrder(id, data) { return this.request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
    async updateOrderStatus(id, statusId, masterId = null) {
        const body = { status_id: statusId };
        if (masterId) body.master_id = masterId;
        return this.request(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify(body) });
    }
    async closeOrder(id, amount) { return this.request(`/orders/${id}/close`, { method: 'PUT', body: JSON.stringify({ amount }) }); }
    async deleteOrder(id) { return this.request(`/orders/${id}`, { method: 'DELETE' }); }
    async searchOrders(query) { return this.request(`/orders/search?q=${encodeURIComponent(query)}`); }
    async getOrdersByPhone(phone) { return this.request(`/orders/by-phone/${encodeURIComponent(phone)}`); }

    // Masters
    async getMasters() { return this.request('/masters'); }

    // Sources
    async getSources() { return this.request('/sources'); }
    async createSource(name) { return this.request('/sources', { method: 'POST', body: JSON.stringify({ name }) }); }
    async deleteSource(id) { return this.request(`/sources/${id}`, { method: 'DELETE' }); }

    // Statuses
    async getStatuses() { return this.request('/statuses'); }

    // Stats
    async getStatsOverview() { return this.request('/stats/overview'); }
    async getStatsMasters(period = 'all') { return this.request(`/stats/masters?period=${period}`); }
    async getStatsSources(period = 'all') { return this.request(`/stats/sources?period=${period}`); }

    // Custom Fields
    async getCustomFields() { return this.request('/custom-fields'); }
    async createCustomField(field) { return this.request('/custom-fields', { method: 'POST', body: JSON.stringify(field) }); }
    async deleteCustomField(id) { return this.request(`/custom-fields/${id}`, { method: 'DELETE' }); }
}

const api = new Api();