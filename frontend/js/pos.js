import { fetchProductsAPI, sendSaleAPI } from './api.js';

const barcodeInput = document.querySelector('#barcode-input');
const productsList = document.querySelector('#products-list');
const ticketItemsContainer = document.querySelector('#ticket-items');
const ticketTotal = document.querySelector('#ticket-total');
const btnFinishSale = document.querySelector('#btn-finish-sale');
const paymentMethodSelect = document.querySelector('#payment-method');

let currentCart = [];
let allProducts = [];

function formatCurrency(val) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
}

// Cargar catálogo al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    if (barcodeInput) barcodeInput.focus();
});

async function loadProducts() {
    allProducts = await fetchProductsAPI();
    renderProductsGrid();
}

function renderProductsGrid() {
    if (!productsList) return;
    productsList.innerHTML = allProducts.map(p => `
        <div class="product-card" onclick="addToCartById(${p.id})" style="cursor: pointer;">
            <h3>${p.name}</h3>
            <p class="price">${formatCurrency(p.price)}</p>
            <small>Stock: ${p.stock}</small>
        </div>
    `).join('');
}

// Búsqueda por scanner de código de barras
if (barcodeInput) {
    barcodeInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = barcodeInput.value.trim();
            if (!code) return;

            const product = allProducts.find(p => p.barcode === code);
            if (product) {
                addToCart(product);
                barcodeInput.value = '';
            } else {
                alert('Producto no encontrado con ese código');
                barcodeInput.value = '';
            }
        }
    });
}

function addToCartById(id) {
    const product = allProducts.find(p => p.id === id);
    if (product) addToCart(product);
}

function addToCart(product) {
    const existing = currentCart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        currentCart.push({ ...product, quantity: 1 });
    }
    renderTicket();
}

function renderTicket() {
    if (!ticketItemsContainer) return;
    ticketItemsContainer.innerHTML = currentCart.map((item, index) => `
        <div class="ticket-row">
            <div>
                <strong>${item.name}</strong>
                <small>${item.quantity} x ${formatCurrency(item.price)}</small>
            </div>
            <span>${formatCurrency(item.price * item.quantity)}</span>
            <button onclick="removeFromCart(${index})" class="btn-remove">&times;</button>
        </div>
    `).join('');

    const total = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (ticketTotal) ticketTotal.textContent = formatCurrency(total);
}

function removeFromCart(index) {
    currentCart.splice(index, 1);
    renderTicket();
}

if (btnFinishSale) {
    btnFinishSale.addEventListener('click', async () => {
        if (currentCart.length === 0) {
            alert('Agregá al menos un producto al ticket.');
            return;
        }

        const payload = {
            payment_method: paymentMethodSelect.value,
            items: currentCart
        };

        const response = await sendSaleAPI(payload);
        if (response.success) {
            alert('¡Venta realizada con éxito!');
            currentCart = [];
            renderTicket();
            await loadProducts(); // Recargar stock actualizado
        } else {
            alert('Error al registrar la venta: ' + response.error);
        }
    });
}

// Exponer funciones al scope global para listeners inline
window.addToCartById = addToCartById;
window.removeFromCart = removeFromCart;