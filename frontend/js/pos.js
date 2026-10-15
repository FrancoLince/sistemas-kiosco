import { 
    fetchProductsAPI, 
    fetchCategoriesAPI,
    fetchReplenishmentAPI,
    sendSaleAPI, 
    createProductAPI, 
    updateProductAPI,
    deleteProductAPI,
    fetchDailyReportAPI 
} from './api.js';

// Elementos Principales del POS
const barcodeInput = document.querySelector('#barcode-input');
const productsList = document.querySelector('#products-list');
const categoryChips = document.querySelector('#category-chips');
const ticketItemsContainer = document.querySelector('#ticket-items');
const ticketTotal = document.querySelector('#ticket-total');
const btnFinishSale = document.querySelector('#btn-finish-sale');
const paymentMethodSelect = document.querySelector('#payment-method');

// Elementos del Modal ABM Productos
const productModal = document.querySelector('#product-modal');
const btnOpenProductModal = document.querySelector('#btn-open-product-modal');
const btnCloseModal = document.querySelector('#btn-close-modal');
const btnCancelModal = document.querySelector('#btn-cancel-modal');
const productForm = document.querySelector('#product-form');

const inputProductId = document.querySelector('#product-id');
const inputProductName = document.querySelector('#product-name');
const inputProductBarcode = document.querySelector('#product-barcode');
const inputProductCategory = document.querySelector('#product-category');
const inputProductImage = document.querySelector('#product-image');
const inputProductCostPrice = document.querySelector('#product-cost-price');
const inputProductPrice = document.querySelector('#product-price');
const inputProductStock = document.querySelector('#product-stock');
const inputProductMinStock = document.querySelector('#product-min-stock');
const btnDeleteProduct = document.querySelector('#btn-delete-product');
const modalTitle = document.querySelector('#modal-title');

// Elementos del Modal Historial / Reposición
const historyModal = document.querySelector('#history-modal');
const btnOpenHistoryModal = document.querySelector('#btn-open-history-modal');
const btnCloseHistoryModal = document.querySelector('#btn-close-history-modal');
const salesHistoryList = document.querySelector('#sales-history-list');
const replenishmentList = document.querySelector('#replenishment-list');
const tabSalesBtn = document.querySelector('#tab-sales-btn');
const tabReplenishBtn = document.querySelector('#tab-replenish-btn');

const reportGrandTotal = document.querySelector('#report-grand-total');
const reportNetProfit = document.querySelector('#report-net-profit');
const reportCashTotal = document.querySelector('#report-cash-total');
const reportMpTotal = document.querySelector('#report-mp-total');

let currentCart = [];
let allProducts = [];
let allCategories = [];
let selectedCategoryId = 'all';

function formatCurrency(val) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
}

function ensureFocus() {
    const isProductModalActive = productModal && productModal.classList.contains('active');
    const isHistoryModalActive = historyModal && historyModal.classList.contains('active');
    
    if (!isProductModalActive && !isHistoryModalActive && barcodeInput && document.activeElement !== paymentMethodSelect) {
        barcodeInput.focus();
    }
}

// Cargar catálogo y categorías al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    await loadProducts();
    ensureFocus();
});

document.addEventListener('click', (e) => {
    const isProductModalActive = productModal && productModal.classList.contains('active');
    const isHistoryModalActive = historyModal && historyModal.classList.contains('active');
    
    if (!isProductModalActive && !isHistoryModalActive && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        ensureFocus();
    }
});

async function loadCategories() {
    allCategories = await fetchCategoriesAPI();
    
    // Poblar select dentro del modal de producto
    if (inputProductCategory) {
        inputProductCategory.innerHTML = `<option value="">Sin Categoría</option>` + 
            allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // Poblar chips en el catálogo principal
    if (categoryChips) {
        categoryChips.innerHTML = `<button class="chip ${selectedCategoryId === 'all' ? 'active' : ''}" data-cat-id="all">Todos</button>` +
            allCategories.map(c => `<button class="chip ${selectedCategoryId == c.id ? 'active' : ''}" data-cat-id="${c.id}">${c.name}</button>`).join('');
        
        categoryChips.querySelectorAll('.chip').forEach(btn => {
            btn.addEventListener('click', () => {
                categoryChips.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedCategoryId = btn.dataset.catId;
                applyFilters();
            });
        });
    }
}

async function loadProducts() {
    const cachedProducts = localStorage.getItem('pos_products_cache');
    if (cachedProducts) {
        allProducts = JSON.parse(cachedProducts);
        applyFilters();
    }

    try {
        const freshProducts = await fetchProductsAPI();
        if (freshProducts && Array.isArray(freshProducts)) {
            allProducts = freshProducts;
            localStorage.setItem('pos_products_cache', JSON.stringify(allProducts));
            applyFilters();
        }
    } catch (err) {
        console.error('Error al actualizar productos desde la API:', err);
    }
}

function applyFilters() {
    const query = barcodeInput ? barcodeInput.value.trim().toLowerCase() : '';

    const filtered = allProducts.filter(p => {
        // Filtro por categoría
        const matchesCategory = selectedCategoryId === 'all' || p.category_id == selectedCategoryId;

        // Filtro por texto
        let matchesText = true;
        if (query && !/^\d+[xX\*]$/.test(query)) {
            const words = p.name.toLowerCase().split(' ');
            const matchesName = words.some(w => w.startsWith(query));
            const matchesBarcode = p.barcode && p.barcode.includes(query);
            matchesText = matchesName || matchesBarcode;
        }

        return matchesCategory && matchesText;
    });

    renderProductsGrid(filtered);
}

function renderProductsGrid(productsToRender = allProducts) {
    if (!productsList) return;
    if (productsToRender.length === 0) {
        productsList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No se encontraron productos</p>`;
        return;
    }

    productsList.innerHTML = productsToRender.map(p => {
        const imageHtml = p.image_url 
            ? `<img src="${p.image_url}" alt="${p.name}" class="product-card-img" loading="lazy" onerror="this.style.display='none'">` 
            : '';

        const isLowStock = p.stock <= (p.min_stock || 5);
        const stockBadge = isLowStock 
            ? `<span class="badge-low-stock">⚠️ Reponer (${p.stock})</span>` 
            : `<small>Stock: ${p.stock}</small>`;

        return `
            <div class="product-card" onclick="addToCartById(${p.id})">
                <button class="btn-edit-card" onclick="event.stopPropagation(); openModalById(${p.id})" title="Editar o borrar">✏️</button>
                <div class="product-card-img-wrapper">
                    ${imageHtml}
                </div>
                <div class="product-card-info">
                    <h3>${p.name}</h3>
                    <p class="price">${formatCurrency(p.price)}</p>
                    ${stockBadge}
                </div>
            </div>
        `;
    }).join('');
}

// Búsqueda en tiempo real + Escáner + Multiplicador
if (barcodeInput) {
    barcodeInput.addEventListener('input', applyFilters);

    barcodeInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const rawValue = barcodeInput.value.trim();

            if (!rawValue) {
                finishSale();
                return;
            }

            let quantity = 1;
            let codeOrName = rawValue;

            const multiplierMatch = rawValue.match(/^(\d+)[xX\*](.+)$/);
            if (multiplierMatch) {
                quantity = parseInt(multiplierMatch[1], 10);
                codeOrName = multiplierMatch[2].trim();
            }

            const product = allProducts.find(p => p.barcode === codeOrName) ||
                            allProducts.find(p => p.name.toLowerCase() === codeOrName.toLowerCase());

            if (product) {
                addToCart(product, quantity);
                barcodeInput.value = '';
                applyFilters();
            } else {
                alert('Producto no encontrado');
                barcodeInput.value = '';
                applyFilters();
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

if (btnFinishSale) btnFinishSale.addEventListener('click', finishSale);

// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
        e.preventDefault();
        ensureFocus();
    }
    if (e.key === 'F4') {
        e.preventDefault();
        paymentMethodSelect.focus();
    }
    if (e.key === 'Escape') {
        if (productModal && productModal.classList.contains('active')) {
            closeModal();
            return;
        }
        if (historyModal && historyModal.classList.contains('active')) {
            closeHistoryModal();
            return;
        }
        if (currentCart.length > 0 && confirm('¿Deseás vaciar el ticket actual?')) {
            currentCart = [];
            renderTicket();
            barcodeInput.value = '';
            applyFilters();
        }
        ensureFocus();
    }
});

// Lógica Modal ABM Productos
function openModal(product = null) {
    if (product) {
        modalTitle.textContent = 'Editar Producto';
        inputProductId.value = product.id;
        inputProductName.value = product.name;
        inputProductBarcode.value = product.barcode || '';
        if (inputProductCategory) inputProductCategory.value = product.category_id || '';
        if (inputProductImage) inputProductImage.value = product.image_url || '';
        if (inputProductCostPrice) inputProductCostPrice.value = product.cost_price || 0;
        inputProductPrice.value = product.price;
        inputProductStock.value = product.stock;
        if (inputProductMinStock) inputProductMinStock.value = product.min_stock || 5;
        if (btnDeleteProduct) btnDeleteProduct.style.display = 'inline-flex';
    } else {
        modalTitle.textContent = 'Agregar Nuevo Producto';
        productForm.reset();
        inputProductId.value = '';
        if (inputProductMinStock) inputProductMinStock.value = 5;
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

if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = inputProductId.value;
        const payload = {
            name: inputProductName.value.trim(),
            barcode: inputProductBarcode.value.trim() || null,
            category_id: inputProductCategory && inputProductCategory.value ? parseInt(inputProductCategory.value, 10) : null,
            image_url: inputProductImage ? inputProductImage.value.trim() || null : null,
            cost_price: inputProductCostPrice ? parseFloat(inputProductCostPrice.value) || 0.0 : 0.0,
            price: parseFloat(inputProductPrice.value),
            stock: parseInt(inputProductStock.value, 10) || 0,
            min_stock: inputProductMinStock ? parseInt(inputProductMinStock.value, 10) || 5 : 5
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

// Lógica Modal Historial / Reposición
if (btnOpenHistoryModal) {
    btnOpenHistoryModal.addEventListener('click', async () => {
        historyModal.classList.add('active');
        await loadSalesHistory();
    });
}

function closeHistoryModal() {
    if (historyModal) historyModal.classList.remove('active');
    ensureFocus();
}

if (btnCloseHistoryModal) btnCloseHistoryModal.addEventListener('click', closeHistoryModal);

if (tabSalesBtn && tabReplenishBtn) {
    tabSalesBtn.addEventListener('click', () => {
        tabSalesBtn.classList.add('active');
        tabReplenishBtn.classList.remove('active');
        if (salesHistoryList) salesHistoryList.style.display = 'flex';
        if (replenishmentList) replenishmentList.style.display = 'none';
    });

    tabReplenishBtn.addEventListener('click', async () => {
        tabReplenishBtn.classList.add('active');
        tabSalesBtn.classList.remove('active');
        if (salesHistoryList) salesHistoryList.style.display = 'none';
        if (replenishmentList) replenishmentList.style.display = 'flex';
        await loadReplenishmentList();
    });
}

async function loadSalesHistory() {
    if (!salesHistoryList) return;
    salesHistoryList.innerHTML = `<p style="text-align:center; color: var(--text-muted);">Cargando ventas...</p>`;
    
    try {
        const reportResponse = await fetchDailyReportAPI();
        const reportData = reportResponse.data || reportResponse;
        
        if (!reportData || !reportData.sales_history || reportData.sales_history.length === 0) {
            salesHistoryList.innerHTML = `<p style="text-align:center; color: var(--text-muted);">No hay ventas registradas hoy.</p>`;
            if (reportGrandTotal) reportGrandTotal.textContent = formatCurrency(0);
            if (reportNetProfit) reportNetProfit.textContent = formatCurrency(0);
            if (reportCashTotal) reportCashTotal.textContent = formatCurrency(0);
            if (reportMpTotal) reportMpTotal.textContent = formatCurrency(0);
            return;
        }

        const totals = reportData.by_payment_method || {};
        if (reportGrandTotal) reportGrandTotal.textContent = formatCurrency(reportData.grand_total || 0);
        if (reportNetProfit) reportNetProfit.textContent = formatCurrency(reportData.net_profit || 0);
        if (reportCashTotal) reportCashTotal.textContent = formatCurrency(totals.efectivo || 0);
        if (reportMpTotal) reportMpTotal.textContent = formatCurrency((totals.transferencia || 0) + (totals.tarjeta || 0));

        salesHistoryList.innerHTML = reportData.sales_history.map(sale => {
            const date = new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const itemsList = sale.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');

            return `
                <div style="background: var(--bg-subtle); padding: 10px 14px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>#${sale.id} (${date}) - <span style="text-transform: capitalize;">${sale.payment_method}</span></strong>
                        <p style="font-size: 0.8rem; color: var(--text-muted);">${itemsList}</p>
                    </div>
                    <strong style="color: var(--color-success); font-size: 1rem;">${formatCurrency(sale.total)}</strong>
                </div>
            `;
        }).join('');

    } catch (err) {
        salesHistoryList.innerHTML = `<p style="text-align:center; color: var(--color-danger);">Error al cargar reporte: ${err.message}</p>`;
    }
}

async function loadReplenishmentList() {
    if (!replenishmentList) return;
    replenishmentList.innerHTML = `<p style="text-align:center; color: var(--text-muted);">Cargando lista de reposición...</p>`;

    try {
        const items = await fetchReplenishmentAPI();
        if (!items || items.length === 0) {
            replenishmentList.innerHTML = `<p style="text-align:center; color: var(--color-success); font-weight: 600;">🎉 ¡Excelente! Todo el stock está al día.</p>`;
            return;
        }

        replenishmentList.innerHTML = items.map(item => `
            <div style="background: var(--bg-subtle); padding: 10px 14px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${item.name}</strong>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">Stock actual: ${item.stock} | Mínimo: ${item.min_stock}</p>
                </div>
                <span style="background: #fef3c7; color: #b45309; padding: 4px 8px; border-radius: var(--radius-sm); font-weight: 700; font-size: 0.85rem;">
                    Comprar: +${item.needed > 0 ? item.needed : 1}
                </span>
            </div>
        `).join('');
    } catch (err) {
        replenishmentList.innerHTML = `<p style="text-align:center; color: var(--color-danger);">Error al cargar reposición: ${err.message}</p>`;
    }
}

// Exponer funciones globales
window.addToCartById = addToCartById;
window.openModalById = openModalById;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
