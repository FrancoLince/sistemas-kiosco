const API_BASE_URL = 'https://sistemas-kiosco.onrender.com/api';

async function requestJson(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(result.error || 'Ocurrió un error en la petición');
    }

    return result;
}

export async function fetchProductsAPI() {
    const response = await requestJson('/products');
    return response.data || [];
}

export async function sendSaleAPI(payload) {
    return await requestJson('/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

export async function fetchDailyReportAPI() {
    const response = await requestJson('/reports/daily');
    return response.data || [];
}
