import { 
    fetchProductsAPI, 
    sendSaleAPI, 
    createProductAPI, 
    updateProductAPI,
    deleteProductAPI 
} from './api.js';

// Elementos Principales del POS
const barcodeInput = document.querySelector('#barcode-input');
const productsList = document.querySelector('#products-list');
const ticketItemsContainer = document.querySelector('#ticket-items');
const ticketTotal = document.querySelector('#ticket-total');
const btnFinishSale = document.querySelector('#btn-finish-sale');
const paymentMethodSelect = document.querySelector('#payment-method');

// Elementos del Modal ABM
const productModal = document.querySelector('#product-modal');
const btnOpenProductModal = document.querySelector('#btn-open-product-modal');
const btnCloseModal = document.querySelector('#btn-close-modal');
const btnCancelModal = document.querySelector('#btn-cancel-modal');
const productForm = document.querySelector('#product-form');

const inputProductId = document.querySelector('#product-id');
const inputProductName = document.querySelector('#product-name');
const inputProductBarcode = document.querySelector('#product-barcode');
const inputProductImage = document.querySelector('#product-image');
const inputProductPrice = document.querySelector('#product-price');
const inputProductStock = document.querySelector('#product-stock');
const btnDeleteProduct = document.querySelector('#btn-delete-product');
const modalTitle = document.querySelector('#modal-title');

let currentCart = [];
let allProducts = [];

function formatCurrency(val) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
}

function ensureFocus() {
    // Solo enfoca el buscador si el modal NO está abierto
    const isModalActive = productModal && productModal.classList.contains('active');
    if (!isModalActive && barcodeInput && document.activeElement !== paymentMethodSelect) {
        barcodeInput.focus();
    }
}

// Cargar catálogo al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    ensureFocus();
});

// Re-enfocar automáticamente al hacer clic en zonas vacías de la pantalla
document.addEventListener('click', (e) => {
    const isModalActive = productModal && productModal.classList.contains('active');
    if (!isModalActive && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        ensureFocus();
    }
});

async function loadProducts() {
    allProducts = await fetchProductsAPI();
    renderProductsGrid(allProducts);
}

function renderProductsGrid(productsToRender = allProducts) {
    if (!productsList) return;
    if (productsToRender.length === 0) {
        productsList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No se encontraron productos</p>`;
        return;
    }

    productsList.innerHTML = productsToRender.map(p => {
        const imageHtml = p.image_url 
            ? `<img src="${p.image_url}" alt="${p.name}" class="product-card-img" onerror="this.style.display='none'">` 
            : '';

        return `
            <div class="product-card" onclick="addToCartById(${p.id})">
                <div class="product-actions" onclick="event.stopPropagation();">
                    <button class="btn-edit-card" onclick="openModalById(${p.id})" title="Editar o borrar">✏️</button>
                </div>
                ${imageHtml}
                <h3>${p.name}</h3>
                <p class="price">${formatCurrency(p.price)}</p>
                <small>Stock: ${p.stock}</small>
            </div>
        `;
    }).join('');
}

// Búsqueda en tiempo real + Escáner + Multiplicador (3* o 3x)
// Búsqueda en tiempo real + Escáner + Multiplicador (3* o 3x)
if (barcodeInput) {
    barcodeInput.addEventListener('input', () => {
        const query = barcodeInput.value.trim().toLowerCase();
        
        // No filtrar si está ingresando multiplicador como "2*" o "5x"
        if (/^\d+[xX\*]$/.test(query)) return;

        if (!query) {
            renderProductsGrid(allProducts);
            return;
        }

        // Filtro inteligente: busca si alguna palabra del producto EMPIEZA con lo que tipeas
        const filtered = allProducts.filter(p => {
            const words = p.name.toLowerCase().split(' ');
            const matchesName = words.some(w => w.startsWith(query));
            const matchesBarcode = p.barcode && p.barcode.includes(query);
            return matchesName || matchesBarcode;
        });

        renderProductsGrid(filtered);
    });

    barcodeInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const rawValue = barcodeInput.value.trim();

            if (!rawValue) {
                // Si presiona Enter con el buscador vacío, ejecuta el cobro directo
                finishSale();
                return;
            }

            let quantity = 1;
            let codeOrName = rawValue;

            // Soporte para patrones como "3*779123456" o "3xalfajor"
            const multiplierMatch = rawValue.match(/^(\d+)[xX\*](.+)$/);
            if (multiplierMatch) {
                quantity = parseInt(multiplierMatch[1], 10);
                codeOrName = multiplierMatch[2].trim();
            }

            // Buscar por código exacto o por nombre
            const product = allProducts.find(p => p.barcode === codeOrName) ||
                            allProducts.find(p => p.name.toLowerCase() === codeOrName.toLowerCase());

            if (product) {
                addToCart(product, quantity);
                barcodeInput.value = '';
                renderProductsGrid(allProducts);
            } else {
                alert('Producto no encontrado');
                barcodeInput.value = '';
                renderProductsGrid(allProducts);
            }
        }
    });
}

function addToCartById(id) {
    const product = allProducts.find(p => p.id === id);
    if (product) addToCart(product, 1);
}

function addToCart(product, qty = 1) {
    const existing = currentCart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += qty;
    } else {
        currentCart.push({ ...product, quantity: qty });
    }
    renderTicket();
    ensureFocus();
}

function updateQuantity(index, delta) {
    currentCart[index].quantity += delta;
    if (currentCart[index].quantity <= 0) {
        currentCart.splice(index, 1);
    }
    renderTicket();
    ensureFocus();
}

function removeFromCart(index) {
    currentCart.splice(index, 1);
    renderTicket();
    ensureFocus();
}

function renderTicket() {
    if (!ticketItemsContainer) return;
    ticketItemsContainer.innerHTML = currentCart.map((item, index) => `
        <div class="ticket-row">
            <div>
                <strong>${item.name}</strong>
                <small>${formatCurrency(item.price)} c/u</small>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
                <button onclick="updateQuantity(${index}, -1)" class="btn-remove" style="width:24px; height:24px;">-</button>
                <strong style="font-size: 0.9rem;">${item.quantity}</strong>
                <button onclick="updateQuantity(${index}, 1)" class="btn-remove" style="width:24px; height:24px; background:var(--bg-subtle); color:var(--text-heading);">+</button>
            </div>
            <span style="margin-left: 10px;">${formatCurrency(item.price * item.quantity)}</span>
            <button onclick="removeFromCart(${index})" class="btn-remove">&times;</button>
        </div>
    `).join('');

    const total = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (ticketTotal) ticketTotal.textContent = formatCurrency(total);
}

async function finishSale() {
    if (currentCart.length === 0) {
        alert('El ticket está vacío.');
        ensureFocus();
        return;
    }

    const payload = {
        payment_method: paymentMethodSelect.value,
        items: currentCart
    };

    btnFinishSale.disabled = true;
    btnFinishSale.textContent = 'Procesando...';

    const response = await sendSaleAPI(payload);

    btnFinishSale.disabled = false;
    btnFinishSale.textContent = 'COBRAR (Enter)';

    if (response.success) {
        alert('¡Venta realizada con éxito!');
        currentCart = [];
        renderTicket();
        barcodeInput.value = '';
        await loadProducts();
    } else {
        alert('Error al registrar la venta: ' + (response.error || 'Error en el servidor'));
    }
    ensureFocus();
}

if (btnFinishSale) {
    btnFinishSale.addEventListener('click', finishSale);
}

// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // F2: Enfocar buscador
    if (e.key === 'F2') {
        e.preventDefault();
        ensureFocus();
    }
    // F4: Cambiar medio de pago
    if (e.key === 'F4') {
        e.preventDefault();
        paymentMethodSelect.focus();
    }
    // Escape: Limpiar ticket actual o cerrar modal
    if (e.key === 'Escape') {
        if (productModal && productModal.classList.contains('active')) {
            closeModal();
            return;
        }
        if (currentCart.length > 0 && confirm('¿Deseás vaciar el ticket actual?')) {
            currentCart = [];
            renderTicket();
            barcodeInput.value = '';
            renderProductsGrid(allProducts);
        }
        ensureFocus();
    }
});

// Lógica para Abrir y Cerrar Modal ABM
function openModal(product = null) {
    if (product) {
        modalTitle.textContent = 'Editar Producto';
        inputProductId.value = product.id;
        inputProductName.value = product.name;
        inputProductBarcode.value = product.barcode || '';
        if (inputProductImage) inputProductImage.value = product.image_url || '';
        inputProductPrice.value = product.price;
        inputProductStock.value = product.stock;
        if (btnDeleteProduct) btnDeleteProduct.style.display = 'inline-flex';
    } else {
        modalTitle.textContent = 'Agregar Nuevo Producto';
        productForm.reset();
        inputProductId.value = '';
        if (btnDeleteProduct) btnDeleteProduct.style.display = 'none';
    }
    productModal.classList.add('active');
    setTimeout(() => inputProductName.focus(), 100);
}

function openModalById(id) {
    const product = allProducts.find(p => p.id === id);
    if (product) openModal(product);
}

function closeModal() {
    productModal.classList.remove('active');
    productForm.reset();
    ensureFocus();
}

if (btnOpenProductModal) btnOpenProductModal.addEventListener('click', () => openModal());
if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

// Evento Eliminar Producto
if (btnDeleteProduct) {
    btnDeleteProduct.addEventListener('click', async () => {
        const id = inputProductId.value;
        if (!id) return;

        if (confirm(`¿Estás seguro de que querés eliminar "${inputProductName.value}"?`)) {
            try {
                const res = await deleteProductAPI(id);
                if (res.success) {
                    alert('Producto eliminado con éxito');
                    closeModal();
                    await loadProducts();
                } else {
                    alert('Error: ' + res.error);
                }
            } catch (err) {
                alert('Error al eliminar: ' + err.message);
            }
        }
    });
}

// Guardar o Actualizar Producto
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = inputProductId.value;
        const payload = {
            name: inputProductName.value.trim(),
            barcode: inputProductBarcode.value.trim() || null,
            image_url: inputProductImage ? inputProductImage.value.trim() || null : null,
            price: parseFloat(inputProductPrice.value),
            stock: parseInt(inputProductStock.value, 10) || 0
        };

        try {
            let response;
            if (id) {
                response = await updateProductAPI(id, payload);
            } else {
                response = await createProductAPI(payload);
            }

            if (response.success || response.product) {
                alert(id ? 'Producto actualizado con éxito' : 'Producto creado con éxito');
                closeModal();
                await loadProducts();
            } else {
                alert('Error al guardar el producto: ' + (response.error || 'Error desconocido'));
            }
        } catch (err) {
            alert('Error al comunicar con el servidor: ' + err.message);
        }
    });
}

// Exponer funciones globales
window.addToCartById = addToCartById;
window.openModalById = openModalById;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
