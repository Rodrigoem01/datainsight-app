// Detectar URL automáticamente (Local o Producción)
const API_URL = window.location.origin; // "http://localhost:8000" o "https://tuhost.onrender.com"

// --- AUTHENTICATION ---
async function login(username, password) {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            throw new Error('Credenciales inválidas');
        }

        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('role', data.role);
        window.location.href = '/dashboard.html';
    } catch (error) {
        const errorDiv = document.getElementById('errorMsg');
        let msg = error.message;
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
            msg = '⏳ El servidor se está despertando... Espera 30 seg y prueba de nuevo.';
        }
        errorDiv.textContent = msg;
        errorDiv.classList.remove('hidden');
    }
}

function isAuthenticated() {
    return !!localStorage.getItem('token');
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
}

// --- DASHBOARD & FILES ---
// --- DASHBOARD & FILES ---
async function uploadFile(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    // Elementos de UI
    const statusDiv = document.getElementById('headerUploadStatus');
    const statusText = document.getElementById('uploadProgressText');
    const uploadFormStatus = document.getElementById('uploadStatus');

    // Mostrar estado
    if (statusDiv) {
        statusDiv.classList.remove('hidden');
        statusText.textContent = "Iniciando carga...";
    }
    if (uploadFormStatus) uploadFormStatus.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');

    // Usar XHR para progreso
    const xhr = new XMLHttpRequest();

    xhr.open('POST', `${API_URL}/files/upload`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            if (statusText) statusText.textContent = `Cargando: ${percentComplete}%`;
        }
    };

    xhr.onload = function () {
        if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            if (statusText) statusText.textContent = "¡Procesando...";

            setTimeout(() => {
                if (statusDiv) statusDiv.classList.add('hidden');
                if (uploadFormStatus) uploadFormStatus.classList.add('hidden');

                if (result.data) {
                    updateDashboard(result.data, result.columns);
                }
            }, 500);

        } else {
            if (statusText) statusText.textContent = "Error";
            alert('Error al subir archivo: ' + xhr.statusText);
            if (statusDiv) statusDiv.classList.add('hidden');
        }
    };

    xhr.onerror = function () {
        if (statusText) statusText.textContent = "Error Red";
        alert('Error de red.');
        if (statusDiv) statusDiv.classList.add('hidden');
    };

    xhr.send(formData);
}

// Variables globales para manejo de datos de la tabla
let currentTableData = [];
let currentTableColumns = [];
let sortCol = null;
let sortAsc = true;

function updateDashboard(data, columns) {
    if (!data || data.length === 0) return;

    // Guardar estado global
    currentTableData = data;
    currentTableColumns = columns;

    // Resetear ordenamiento al cargar nuevos datos
    sortCol = null;
    sortAsc = true;

    renderTable();
    updateKPIs(data, columns);
    updateMap(data, columns);
    renderEditorTable();
}

function renderTable() {
    const tableBody = document.querySelector('#dataTable tbody');
    const tableHead = document.querySelector('#dataTable thead tr');
    const rowCountSpan = document.getElementById('rowCount');

    // 1. Renderizar Headers con funcionalidad de ordenamiento
    tableHead.innerHTML = '';
    currentTableColumns.forEach(col => {
        const th = document.createElement('th');
        th.className = "py-3 px-6 cursor-pointer hover:bg-gray-600 select-none transition-colors";
        th.onclick = () => toggleSort(col);

        // Icono de ordenamiento
        let icon = '';
        if (sortCol === col) {
            icon = sortAsc ? ' ▲' : ' ▼';
        } else {
            icon = ' <span class="text-gray-600 text-[10px]">▼</span>'; // Indicador sutil
        }

        th.innerHTML = `${col}${icon}`;
        tableHead.appendChild(th);
    });

    // 2. Ordenar Datos
    let displayData = [...currentTableData];

    if (sortCol) {
        displayData.sort((a, b) => {
            let valA = a[sortCol];
            let valB = b[sortCol];

            // Detección numérica simple
            const numA = parseFloat(valA);
            const numB = parseFloat(valB);

            if (!isNaN(numA) && !isNaN(numB)) {
                valA = numA;
                valB = numB;
            } else {
                // Manejo de strings nulos
                valA = valA ? valA.toString().toLowerCase() : '';
                valB = valB ? valB.toString().toLowerCase() : '';
            }

            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });
    }

    // 3. Renderizar Filas (Top 50 para visualización ágil)
    const LIMIT = 50;
    tableBody.innerHTML = '';

    displayData.slice(0, LIMIT).forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-700 hover:bg-gray-700/50";
        currentTableColumns.forEach(col => {
            const td = document.createElement('td');
            td.className = "py-4 px-6";

            let cellValue = row[col];

            // FORMATEO DE FECHA: Eliminar hora si es fecha
            if (col.toLowerCase().includes('date') || col.toLowerCase().includes('fecha')) {
                const dateObj = new Date(cellValue);
                if (!isNaN(dateObj)) {
                    cellValue = dateObj.toLocaleDateString(); // Solo fecha
                }
            } else if (cellValue === null || cellValue === undefined) {
                cellValue = '-';
            }

            td.textContent = cellValue;
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });

    if (rowCountSpan) {
        rowCountSpan.textContent = `Mostrando ${Math.min(LIMIT, displayData.length)} de ${displayData.length} registros (Ordenado por: ${sortCol || 'Original'})`;
    }
}

function toggleSort(col) {
    if (sortCol === col) {
        sortAsc = !sortAsc; // Cambiar dirección
    } else {
        sortCol = col;
        sortAsc = true; // Nuevo orden ascendente por defecto
    }
    renderTable();
}

// --- ACTUALIZACIÓN DE KPIs ---
function updateKPIs(data, columns) {
    // Detectar columnas clave (Case Insensitive)
    const lowerCols = columns.map(c => c.toLowerCase());

    // Función helper para encontrar columna
    const findCol = (options) => {
        const found = columns.find(col => options.includes(col.toLowerCase()));
        return found || options[0]; // Retorna la encontrada o la primera opción por defecto
    };

    let salesCol = findCol(['amount', 'sales', 'ventas', 'total', 'importe']);
    let profitCol = findCol(['profit', 'ganancia', 'margen']);
    let productCol = findCol(['product', 'product name', 'producto', 'nombre producto']);
    let regionCol = findCol(['region', 'zona', 'area']);
    let qtyCol = findCol(['quantity', 'cantidad', 'unidades']);

    let totalSales = 0;
    let totalProfit = 0;
    let productMap = new Map();
    let regionMap = new Map();

    data.forEach(row => {
        // Sales & Profit
        let sales = parseFloat(row[salesCol]) || 0;
        let profit = parseFloat(row[profitCol]) || 0;
        totalSales += sales;
        totalProfit += profit;

        // Top Product (por cantidad vendida)
        let prod = row[productCol];
        let qty = parseFloat(row[qtyCol]) || 1;
        if (prod) {
            productMap.set(prod, (productMap.get(prod) || 0) + qty);
        }

        // Top Region (por ventas)
        let reg = row[regionCol];
        if (reg) {
            regionMap.set(reg, (regionMap.get(reg) || 0) + sales);
        }
    });

    // Encontrar Top Product
    let topProduct = '-';
    let topProductQty = 0;
    for (const [prod, qty] of productMap.entries()) {
        if (qty > topProductQty) {
            topProduct = prod;
            topProductQty = qty;
        }
    }

    // Encontrar Top Region
    let topRegion = '-';
    let topRegionSales = 0;
    for (const [reg, sales] of regionMap.entries()) {
        if (sales > topRegionSales) {
            topRegion = reg;
            topRegionSales = sales;
        }
    }

    // Actualizar DOM
    // Formateador de moneda
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    document.getElementById('kpi-sales').textContent = formatter.format(totalSales);
    document.getElementById('kpi-profit').textContent = formatter.format(totalProfit);

    const prodEl = document.getElementById('kpi-product');
    prodEl.textContent = topProduct;
    prodEl.title = topProduct; // Tooltip para nombres largos
    document.getElementById('kpi-product-stat').textContent = `${topProductQty} unidades vendidas`;

    document.getElementById('kpi-region').textContent = topRegion;
    document.getElementById('kpi-region-stat').textContent = `${formatter.format(topRegionSales)} en ventas`;
}

// --- MAPA DINÁMICO (LEAFLET) ---
let mapInstance = null;
let markers = [];

function updateMap(data, columns) {
    let regionCol = columns.find(col => ['Region', 'Zona'].includes(col)) || 'Region';
    let salesCol = columns.find(col => ['Sales', 'Ventas'].includes(col)) || 'Sales';

    // Agrupar ventas por región
    let regionSales = {};
    data.forEach(row => {
        let reg = row[regionCol];
        let sales = parseFloat(row[salesCol]) || 0;
        if (reg) {
            regionSales[reg] = (regionSales[reg] || 0) + sales;
        }
    });

    // Coordenadas aproximadas para regiones de EE.UU.
    const regionCoords = {
        'North': [46.0, -100.0], // Dakota/Minnesota area
        'South': [33.0, -90.0],  // Mississippi area
        'East': [40.0, -75.0],   // East Coast
        'West': [38.0, -115.0],  // Nevada/California area
        'Central': [39.0, -98.0] // Kansas
    };

    // Inicializar mapa si no existe
    if (!mapInstance) {
        mapInstance = L.map('usMap').setView([39.8283, -98.5795], 4); // Centro de USA
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(mapInstance);
    }

    // Limpiar marcadores anteriores
    markers.forEach(m => mapInstance.removeLayer(m));
    markers = [];

    // Añadir nuevos marcadores
    for (const [region, sales] of Object.entries(regionSales)) {
        const coords = regionCoords[region] || regionCoords['Central']; // Default a Central si no coincide

        // Calcular tamaño del círculo basado en ventas relativas (logarítmico para suavizar)
        const radius = Math.log(sales) * 5000;

        const marker = L.circle(coords, {
            color: '#10B981', // Green
            fillColor: '#10B981',
            fillOpacity: 0.5,
            radius: radius
        }).addTo(mapInstance);

        marker.bindPopup(`<b>Región: ${region}</b><br>Ventas: $${sales.toLocaleString()}`);
        markers.push(marker);
    }
}




// --- PROFILE MANAGEMENT ---
function openProfileModal() {
    document.getElementById('profileModal').classList.remove('hidden');
    updateSidebarNav('nav-profile');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.add('hidden');
    document.getElementById('profileForm').reset();

    // Restore sidebar state based on visible section
    if (!document.getElementById('dashboardSection').classList.contains('hidden')) {
        updateSidebarNav('nav-dashboard');
    } else if (!document.getElementById('userSection').classList.contains('hidden')) {
        updateSidebarNav('nav-users');
    } else if (!document.getElementById('reportsSection').classList.contains('hidden')) {
        updateSidebarNav('nav-reports');
    }
}

async function updateProfile(currentPassword, newUsername, newPassword) {
    if (!currentPassword) {
        alert("La contraseña actual es requerida");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_username: newUsername || null,
                new_password: newPassword || null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Error al actualizar perfil');
        }

        // alert(data.message); // Metodo silencioso
        closeProfileModal();

        // Si cambió el usuario o password, es buena práctica actualizar el token o pedir login de nuevo
        if (data.access_token) {
            localStorage.setItem('token', data.access_token);
        }

    } catch (error) {
        alert(error.message);
    }
}

// --- USER MANAGEMENT & NAVIGATION ---
// --- USER MANAGEMENT & NAVIGATION ---
function updateSidebarNav(activeId) {
    const ids = ['nav-dashboard', 'nav-reports', 'nav-users', 'nav-profile', 'nav-editor', 'nav-alerts'];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        // Base classes that are always present
        const baseClasses = "flex items-center p-2 rounded-lg group transition-colors";

        if (id === activeId) {
            // Active Styles
            el.className = `${baseClasses} text-blue-400 bg-gray-700/50`;
        } else {
            // Inactive Styles
            el.className = `${baseClasses} text-gray-400 hover:bg-gray-700 hover:text-white`;
        }
    });
}

function showDashboardSection() {
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('userSection').classList.add('hidden');
    document.getElementById('reportsSection').classList.add('hidden');
    document.getElementById('dataEditorSection').classList.add('hidden');
    document.getElementById('alertsSection').classList.add('hidden');
    updateSidebarNav('nav-dashboard');
}

function showUserSection() {
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('userSection').classList.remove('hidden');
    document.getElementById('reportsSection').classList.add('hidden');
    document.getElementById('dataEditorSection').classList.add('hidden');
    document.getElementById('alertsSection').classList.add('hidden');
    updateSidebarNav('nav-users');
    loadUsers();
}

function showReportsSection() {
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('userSection').classList.add('hidden');
    document.getElementById('reportsSection').classList.remove('hidden');
    document.getElementById('dataEditorSection').classList.add('hidden');
    document.getElementById('alertsSection').classList.add('hidden');
    updateSidebarNav('nav-reports');
}

function showDataEditorSection() {
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('userSection').classList.add('hidden');
    document.getElementById('reportsSection').classList.add('hidden');
    document.getElementById('dataEditorSection').classList.remove('hidden');
    document.getElementById('alertsSection').classList.add('hidden');
    updateSidebarNav('nav-editor');
    renderEditorTable();
}

function showAlertsSection() {
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('userSection').classList.add('hidden');
    document.getElementById('reportsSection').classList.add('hidden');
    document.getElementById('dataEditorSection').classList.add('hidden');
    document.getElementById('alertsSection').classList.remove('hidden');
    updateSidebarNav('nav-alerts');
}

function openUserModal() {
    document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('userModal').classList.add('hidden');
    document.getElementById('createUserForm').reset();
}

async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/auth/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error cargando usuarios');

        const users = await response.json();
        const tbody = document.getElementById('userTableBody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-700 hover:bg-gray-700/50";
            tr.innerHTML = `
                <td class="py-4 px-6">${user.id}</td>
                <td class="py-4 px-6">${user.username}</td>
                <td class="py-4 px-6"><span class="px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'}">${user.role}</span></td>
                <td class="py-4 px-6">
                    ${user.username !== 'admin' ?
                    `<button onclick="deleteUser(${user.id})" class="text-red-400 hover:text-red-300">Eliminar</button>`
                    : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        alert('Error: ' + error.message);
    }
}

async function createUser(username, password, role) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/auth/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.detail || 'Error creando usuario');

        // alert(data.message);
        closeUserModal();
        loadUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteUser(userId) {
    // if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/auth/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al eliminar');

        // alert(data.message); // Silencioso
        loadUsers();
    } catch (error) {
        alert(error.message);
    }
}

// --- REPORT GENERATION ---
async function generatePDF() {
    if (!currentTableData || currentTableData.length === 0) {
        // alert("No hay datos cargados para generar un reporte.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- ESTILOS & COLORES ---
    const primaryColor = [25, 118, 210]; // Azul corporativo
    const secondaryColor = [100, 100, 100]; // Gris

    // 1. TÍTULO Y HEADER
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.text("Reporte Ejecutivo de Ventas", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(...secondaryColor);
    doc.text(`Generado el: ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`, 14, 28);
    doc.line(14, 32, 196, 32); // Línea separadora

    // 2. RESUMEN EJECUTIVO (KPIs)
    let yPos = 45;
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Resumen Ejecutivo", 14, yPos);
    yPos += 10;

    // Obtener valores actuales del DOM
    const kpiSales = document.getElementById('kpi-sales').innerText;
    const kpiProfit = document.getElementById('kpi-profit').innerText;
    const kpiProduct = document.getElementById('kpi-product').innerText;
    const kpiRegion = document.getElementById('kpi-region').innerText;

    const kpiData = [
        ["Ventas Totales", kpiSales],
        ["Ganancia Total", kpiProfit],
        ["Producto Top", kpiProduct],
        ["Mejor Región", kpiRegion]
    ];

    doc.autoTable({
        startY: yPos,
        head: [['Métrica', 'Valor']],
        body: kpiData,
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        styles: { fontSize: 12 }
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // 3. TABLA DE DETALLE (Top 50)
    doc.setFontSize(16);
    doc.text("Detalle de Transacciones (Top 50)", 14, yPos);
    yPos += 8;

    // Preparar columnas y filas para AutoTable
    const headers = [currentTableColumns];
    const rows = currentTableData.slice(0, 50).map(row =>
        currentTableColumns.map(col => {
            let val = row[col];
            if ((col.toLowerCase().includes('date') || col.toLowerCase().includes('fecha')) && val) {
                try { val = new Date(val).toLocaleDateString(); } catch (e) { }
            }
            return val !== null && val !== undefined ? val : '-';
        })
    );

    doc.autoTable({
        startY: yPos,
        head: headers,
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40] },
        styles: { fontSize: 8 },
        margin: { top: 20 }
    });

    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount} - DataInsight System`, 105, 290, null, null, "center");
    }

    doc.save(`Reporte_Ventas_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// --- PRESENTATION MODE ---
function togglePresentationMode() {
    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('main-header');
    const status = document.getElementById('presentation-status');
    const body = document.body;

    // Toggle Sidebar Visibility
    if (sidebar.classList.contains('-translate-x-full') || sidebar.style.display === 'none') {
        // Exit Presentation Mode
        sidebar.classList.remove('-translate-x-full');
        sidebar.style.display = 'flex';
        // sidebar.classList.remove('hidden'); // If using hidden class
        if (status) status.style.display = 'none';
    } else {
        // Enter Presentation Mode
        sidebar.classList.add('-translate-x-full');
        sidebar.style.display = 'none';
        // sidebar.classList.add('hidden');
        if (status) status.style.display = 'block';
    }

    // Resize map if exists
    setTimeout(() => {
        if (mapInstance) mapInstance.invalidateSize();
    }, 300);
}

// --- DATA EDITOR ---
function renderEditorTable() {
    const tbody = document.querySelector('#editorTable tbody');
    const thead = document.querySelector('#editorTable thead tr');
    const rowCountSpan = document.getElementById('editorRowCount');

    if (!tbody || !thead) return;

    if (!currentTableData || currentTableData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100%" class="p-6 text-center text-gray-500">No hay datos cargados. Sube un archivo primero.</td></tr>';
        return;
    }

    // Headers
    thead.innerHTML = '';
    currentTableColumns.forEach(col => {
        const th = document.createElement('th');
        th.className = "py-3 px-6 bg-gray-700 font-semibold";
        th.textContent = col;
        thead.appendChild(th);
    });
    // Action Header
    const thAction = document.createElement('th');
    thAction.className = "py-3 px-6 bg-gray-700 font-semibold text-center";
    thAction.textContent = "Editar";
    thead.appendChild(thAction);

    // Rows
    tbody.innerHTML = '';
    currentTableData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-700 hover:bg-gray-700/50 transition-colors";

        currentTableColumns.forEach(col => {
            const td = document.createElement('td');
            td.className = "py-3 px-6 truncate max-w-xs";

            let val = row[col];
            // Formateo visual simple
            if ((col.toLowerCase().includes('date') || col.toLowerCase().includes('fecha')) && val) {
                try { val = new Date(val).toLocaleDateString(); } catch (e) { }
            }
            td.textContent = val !== null && val !== undefined ? val : '-';
            td.title = val; // Tooltip
            tr.appendChild(td);
        });

        // Action Cell
        const tdAction = document.createElement('td');
        tdAction.className = "py-3 px-6 text-center";
        tdAction.innerHTML = `
            <button onclick="openEditModal(${index})" class="text-blue-400 hover:text-blue-300 p-1 rounded hover:bg-blue-900/30 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            </button>
        `;
        tr.appendChild(tdAction);
        tbody.appendChild(tr);
    });

    if (rowCountSpan) rowCountSpan.textContent = `${currentTableData.length} registros`;
}

function openEditModal(index) {
    const row = currentTableData[index];
    const container = document.getElementById('editDataFields');
    document.getElementById('editRowIndex').value = index;

    container.innerHTML = '';

    currentTableColumns.forEach(col => {
        const div = document.createElement('div');

        const label = document.createElement('label');
        label.className = "block text-gray-400 text-xs font-bold mb-1 uppercase";
        label.textContent = col;

        const input = document.createElement('input');
        input.type = "text";
        input.name = col;
        input.value = row[col] !== null && row[col] !== undefined ? row[col] : '';
        input.className = "w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm";

        div.appendChild(label);
        div.appendChild(input);
        container.appendChild(div);
    });

    document.getElementById('editDataModal').classList.remove('hidden');
}

function closeEditDataModal() {
    document.getElementById('editDataModal').classList.add('hidden');
    document.getElementById('editDataForm').reset();
}

// Inicializar form listener una sola vez
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('editDataForm');
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveDataChanges();
        });
    }
});

function saveDataChanges() {
    const index = document.getElementById('editRowIndex').value;
    const form = document.getElementById('editDataForm');
    const formData = new FormData(form);

    // Actualizar registro localmente
    const updatedRow = {};
    formData.forEach((value, key) => {
        // Intentar mantener tipos numéricos si es posible
        if (!isNaN(value) && value.trim() !== '') {
            updatedRow[key] = Number(value);
        } else {
            updatedRow[key] = value;
        }
    });

    currentTableData[index] = updatedRow;

    // Actualizar toda la UI
    renderEditorTable();
    updateDashboard(currentTableData, currentTableColumns);

    closeEditDataModal();
}

// --- ALERTS ---
document.addEventListener('DOMContentLoaded', () => {
    const alertForm = document.getElementById('alertForm');
    if (alertForm) {
        alertForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const recipient = document.getElementById('alertRecipient').value;
            const subject = document.getElementById('alertSubject').value;
            const message = document.getElementById('alertMessage').value;
            const btn = alertForm.querySelector('button[type="submit"]');

            // UI Loading
            const originalBtnText = btn.innerHTML;
            btn.innerHTML = 'Enviando...';
            btn.disabled = true;

            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/alerts/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ recipient, subject, message })
                });

                const result = await response.json();

                if (!response.ok) throw new Error(result.detail || 'Error al enviar alerta');

                alert(result.message);
                alertForm.reset();

            } catch (error) {
                alert(error.message);
            } finally {
                btn.innerHTML = originalBtnText;
                btn.disabled = false;
            }
        });
    }

    // --- RBAC & INITIALIZATION ---
    // --- RBAC & INITIALIZATION ---
    const path = window.location.pathname;
    const isLoginPage = path === '/' || path.includes('index.html');

    if (isLoginPage) {
        // Si estamos en login y ya hay token, ir al dashboard
        if (isAuthenticated()) {
            window.location.href = '/dashboard.html';
        }
        return; // No hacer nada más en el login
    }

    // Para cualquier otra página (Dashboard, etc.), verificar Auth
    if (!isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    // RBAC: Ocultar menú usuarios si no es admin
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
        const navUsers = document.getElementById('nav-users');
        if (navUsers) {
            navUsers.parentElement.style.display = 'none'; // Ocultar el LI completo
        }
    }

    // CARGAR DATOS PERSISTENTES
    loadStoredData();
});

// --- DATA PERSISTENCE ---
async function loadStoredData() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${API_URL}/files/data`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                const columns = Object.keys(data[0]);
                updateDashboard(data, columns);
            }
        }
    } catch (error) {
        console.error("Error loading stored data:", error);
    }
}
