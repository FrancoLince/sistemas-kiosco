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
        throw new Error(result.error || result.message || 'Ocurrió un error en la petición');
    }

    return result;
}

export async function fetchProductsAPI() {
    const response = await requestJson('/products');
    // Si la respuesta es un array directo devuelve response, si viene dentro de data devuelve response.data
    return Array.isArray(response) ? response : (response.data || []);
}

export async function sendSaleAPI(payload) {
    return await requestJson('/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

export async function fetchDailyReportAPI() {
    const response = await requestJson('/reports/daily-summary');
    return response.data || {};
}
export async function createProductAPI(productData) {
    return await requestJson('/products', {
        method: 'POST',
        body: JSON.stringify(productData)
    });
}

export async function updateProductAPI(id, productData) {
    return await requestJson(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(productData)
    });
}
