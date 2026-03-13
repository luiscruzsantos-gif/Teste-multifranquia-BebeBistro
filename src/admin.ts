import { OrderRepository, ProductRepository, ConfigRepository } from './repository';

const MASTER = '10203040Bella';

// State management
let products: any[] = [];
let configs: any[] = [];
let orders: any[] = [];
let activeTab = 'orders';
let soundEnabled = localStorage.getItem('admin_sound') === 'true';
let lastOrderCount = -1;
const orderSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// Attach functions to window for HTML access
(window as any).check = check;
(window as any).logout = logout;
(window as any).setActiveTab = setActiveTab;
(window as any).toggleSound = toggleSound;
(window as any).verDetalhes = verDetalhes;
(window as any).prepararPedido = prepararPedido;
(window as any).confirmarPedido = confirmarPedido;
(window as any).cancelarPedido = cancelarPedido;
(window as any).imprimirPedido = imprimirPedido;
(window as any).copyOrderToWhatsApp = copyOrderToWhatsApp;
(window as any).atualizarValores = atualizarValores;
(window as any).save = save;
(window as any).closeModal = closeModal;
(window as any).editProduct = editProduct;
(window as any).updateStock = updateStock;

const driveImg = (input: string) => {
    if (!input) return 'https://via.placeholder.com/100x100?text=IMG';
    const idMatch = input.match(/[-\w]{25,}/);
    const id = idMatch ? idMatch[0] : input;
    return `https://lh3.googleusercontent.com/d/${id}=w100`;
};

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('admin_sound', soundEnabled.toString());
    updateSoundUI();
    if (soundEnabled) {
        orderSound.play().catch(e => console.log("Audio unlock failed:", e));
    }
}

function updateSoundUI() {
    const on = document.getElementById('icon-sound-on');
    const off = document.getElementById('icon-sound-off');
    const btn = document.getElementById('btn-sound');
    
    if (soundEnabled) {
        on?.classList.remove('hidden');
        off?.classList.add('hidden');
        btn?.classList.add('text-brand-600', 'bg-brand-50');
        btn?.classList.remove('text-slate-400', 'bg-transparent');
    } else {
        on?.classList.add('hidden');
        off?.classList.remove('hidden');
        btn?.classList.remove('text-brand-600', 'bg-brand-50');
        btn?.classList.add('text-slate-400', 'bg-transparent');
    }
}

function check() {
    const passInput = document.getElementById('admin-pass') as HTMLInputElement;
    if (passInput?.value === MASTER) { 
        sessionStorage.setItem('auth', '1'); 
        init(); 
    } else alert('Senha incorreta!'); 
}

function logout() { 
    sessionStorage.clear(); 
    location.reload(); 
}

async function init() {
    if (sessionStorage.getItem('auth') !== '1') return;
    try {
        const loginOverlay = document.getElementById('login-overlay');
        const mainAdmin = document.getElementById('main-admin');
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (mainAdmin) mainAdmin.style.display = 'block';
        
        const unit = sessionStorage.getItem('admin_unit') || 'bc';
        products = await ProductRepository.getProducts(unit);
        configs = await ConfigRepository.getConfigs(unit);
        orders = await OrderRepository.getOrders(unit);

        render();
        renderConfigs();
        renderOrders();
        setActiveTab(activeTab);
        updateSoundUI();

        // Real-time updates
        (window as any).sb.channel('custom-all-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
                checkNewOrders();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, async () => {
                const unit = sessionStorage.getItem('admin_unit') || 'bc';
            products = await ProductRepository.getProducts(unit);
                render();
            })
            .subscribe();

        setInterval(() => {
            if (sessionStorage.getItem('auth') === '1') {
                checkNewOrders();
            }
        }, 60000); // Keep as fallback

    } catch (error) {
        console.error("Erro na inicialização do painel admin:", error);
        alert("Erro ao carregar o painel administrativo.");
    }
}

async function checkNewOrders() {
    try {
        const unit = sessionStorage.getItem('admin_unit') || 'bc';
        const newOrders = await OrderRepository.getOrders(unit);
        const activeOrders = newOrders.filter((o: any) => o.status === 'pendente');
        
        if (lastOrderCount !== -1 && activeOrders.length > lastOrderCount) {
            if (soundEnabled) orderSound.play().catch(e => console.log("Audio play failed:", e));
        }
        
        lastOrderCount = activeOrders.length;
        orders = newOrders;
        renderOrders();
    } catch (e) {
        console.error("Erro ao checar novos pedidos:", e);
    }
}

function setActiveTab(tab: string) {
    activeTab = tab;
    document.getElementById('products-view')?.classList.toggle('hidden', tab !== 'products');
    document.getElementById('configs-view')?.classList.toggle('hidden', tab !== 'configs');
    document.getElementById('orders-view')?.classList.toggle('hidden', tab !== 'orders');
    
    if (tab === 'orders') renderOrders();
    
    const pBtn = document.getElementById('tab-products');
    const oBtn = document.getElementById('tab-orders');
    const cBtn = document.getElementById('tab-configs');
    
    [pBtn, oBtn, cBtn].forEach(btn => {
        if (btn) btn.className = 'px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all';
    });

    const activeBtn = document.getElementById(`tab-${tab}`);
    if (activeBtn) {
        activeBtn.className = 'px-6 py-2.5 rounded-xl text-sm font-bold bg-white shadow-sm text-brand-600 transition-all';
    }
}

function render() {
    const container = document.getElementById('admin-container');
    if (!container) return;
    
    if (products.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-500 font-bold">Nenhum produto cadastrado.</div>';
        return;
    }

    const catLabels: any = {
        'combos': 'Combos',
        'doces-6': 'Doces',
        'papinhas-6': '6-8 Meses',
        'papinhas-8': '8-12 Meses',
        'comidinhas-12': '1 a 3 anos'
    };

    const grouped = products.reduce((acc: any, p: any, index: number) => {
        let cat = p.categoria ? p.categoria.toLowerCase().trim() : 'outros';
        if (cat === 'combo') cat = 'combos';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push({ p, index });
        return acc;
    }, {});

    const order = ['combos', 'doces-6', 'papinhas-6', 'papinhas-8', 'comidinhas-12', 'outros'];
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });

    let html = '';
    for (const cat of sortedKeys) {
        const items = grouped[cat];
        const catName = catLabels[cat] || cat.toUpperCase();
        
        html += `
        <div class="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
            <h3 class="font-bold text-slate-700 uppercase tracking-widest text-[11px]">${catName}</h3>
            <span class="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">${items.length} itens</span>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead class="bg-white border-b text-[10px] uppercase text-slate-400 font-bold tracking-widest hidden sm:table-header-group">
                    <tr>
                        <th class="p-4 sm:p-6">Produto</th>
                        <th class="p-4 sm:p-6 text-center">Preço</th>
                        <th class="p-4 sm:p-6 text-center">Estoque</th>
                        <th class="p-4 sm:p-6 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${items.map(({ p, index }: any) => `
                        <tr class="hover:bg-slate-50/50 transition-colors group">
                            <td class="p-4 sm:p-6">
                                <div class="flex items-center gap-4">
                                    <img src="${driveImg(p.imagem_url)}" class="w-12 h-12 rounded-xl object-cover shadow-sm">
                                    <div>
                                        <p class="font-bold text-slate-900 text-sm">${p.nome}</p>
                                        <p class="text-[10px] text-slate-400 font-bold uppercase">${p.peso || '200g'}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="p-4 sm:p-6 text-center">
                                <span class="font-bold text-slate-700 text-sm">R$ ${Number(p.preco).toFixed(2)}</span>
                            </td>
                            <td class="p-4 sm:p-6 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button onclick="updateStock(${index}, -1)" class="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">-</button>
                                    <span class="px-3 py-1 rounded-lg text-[11px] font-bold ${p.estoque > 5 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}">
                                        ${p.estoque} un
                                    </span>
                                    <button onclick="updateStock(${index}, 1)" class="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-all">+</button>
                                </div>
                            </td>
                            <td class="p-4 sm:p-6 text-right">
                                <button onclick="editProduct(${index})" class="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
    }
    container.innerHTML = html;
}

function renderConfigs() {
    const container = document.getElementById('configs-view');
    if (!container) return;
    
    container.innerHTML = configs.map(c => `
        <div class="bg-white p-8 rounded-4xl shadow-sm border border-slate-100 space-y-4">
            <div>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">${c.key.replace(/_/g, ' ')}</p>
                <h4 class="text-sm font-bold text-slate-900">${c.description || 'Configuração do Sistema'}</h4>
            </div>
            <div class="flex items-center gap-3">
                <input type="text" id="cfg-${c.id}" value="${c.value}" class="flex-1 bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100 focus:border-brand-500 transition-all">
                <button onclick="saveConfig('${c.id}')" class="p-4 bg-brand-600 text-white rounded-2xl shadow-lg shadow-brand-600/20 hover:scale-105 transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                </button>
            </div>
        </div>
    `).join('');
}

async function saveConfig(id: string) {
    const val = (document.getElementById(`cfg-${id}`) as HTMLInputElement)?.value;
    try {
        const { error } = await (window as any).sb.from('config').update({ value: val }).eq('id', id);
        if (error) throw error;
        alert("Configuração salva!");
        init();
    } catch (e) {
        alert("Erro ao salvar config.");
    }
}

function renderOrders() {
    const pendentes = orders.filter(o => o.status === 'pendente');
    const preparando = orders.filter(o => o.status === 'preparando');
    const confirmados = orders.filter(o => o.status === 'confirmado');
    
    const container = document.getElementById('orders-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="space-y-6">
            <div class="flex items-center justify-between px-2">
                <h3 class="font-bold text-slate-900 flex items-center gap-2">
                    <span class="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                    Pendentes
                </h3>
                <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">${pendentes.length}</span>
            </div>
            <div class="space-y-4">${pendentes.map(o => renderCard(o)).join('')}</div>
        </div>
        <div class="space-y-6">
            <div class="flex items-center justify-between px-2">
                <h3 class="font-bold text-slate-900 flex items-center gap-2">
                    <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    Em Preparo
                </h3>
                <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">${preparando.length}</span>
            </div>
            <div class="space-y-4">${preparando.map(o => renderCard(o)).join('')}</div>
        </div>
        <div class="space-y-6">
            <div class="flex items-center justify-between px-2">
                <h3 class="font-bold text-slate-900 flex items-center gap-2">
                    <span class="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    Confirmados
                </h3>
                <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">${confirmados.length}</span>
            </div>
            <div class="space-y-4">${confirmados.map(o => renderCard(o)).join('')}</div>
        </div>
    `;
}

function renderCard(p: any) {
    const statusColors: any = {
        'pendente': 'bg-amber-50 text-amber-600 border-amber-100',
        'preparando': 'bg-blue-50 text-blue-600 border-blue-100',
        'confirmado': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'cancelado': 'bg-red-50 text-red-600 border-red-100'
    };

    return `
    <div onclick="verDetalhes('${p.id}')" class="bg-white p-6 rounded-4xl shadow-sm border border-slate-100 hover:shadow-md hover:border-brand-200 transition-all cursor-pointer group">
        <div class="flex justify-between items-start mb-4">
            <div>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">${p.codigo}</p>
                <h4 class="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">${p.cliente_nome}</h4>
            </div>
            <span class="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${statusColors[p.status] || 'bg-slate-50 text-slate-500 border-slate-100'}">
                ${p.status}
            </span>
        </div>
        <div class="space-y-2 mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span class="truncate">${p.cliente_bairro || 'Não informado'}</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>${p.agendamento || 'Imediato'}</span>
            </div>
        </div>
        <div class="pt-4 border-t border-slate-50 flex items-center justify-between">
            <p class="text-sm font-bold text-slate-900">R$ ${Number(p.total).toFixed(2)}</p>
            <div class="flex -space-x-2">
                ${p.itens.slice(0, 3).map((i: any) => `
                    <div class="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                        ${i.qty}
                    </div>
                `).join('')}
                ${p.itens.length > 3 ? `<div class="w-7 h-7 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-400">+${p.itens.length - 3}</div>` : ''}
            </div>
        </div>
    </div>`;
}

function verDetalhes(id: string) {
    const p = orders.find(o => o.id === id);
    if (!p) return;

    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="space-y-8">
            <div class="flex justify-between items-start">
                <div>
                    <span class="px-3 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2 inline-block">${p.codigo}</span>
                    <h2 class="text-3xl font-bold text-slate-900">${p.cliente_nome}</h2>
                    <p class="text-brand-600 font-bold text-sm">${p.cliente_telefone || 'Sem telefone'}</p>
                </div>
                <button onclick="closeModal()" class="p-2 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-600 transition-all">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="space-y-6">
                    <div class="bg-slate-50 p-6 rounded-4xl space-y-4">
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Endereço de Entrega</h3>
                        <div class="space-y-1">
                            <p class="font-bold text-slate-900 text-sm">${p.cliente_endereco}</p>
                            <p class="text-xs text-slate-500 font-medium">Bairro: ${p.cliente_bairro}</p>
                        </div>
                    </div>
                    <div class="bg-slate-50 p-6 rounded-4xl space-y-4">
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Agendamento</h3>
                        <p class="font-bold text-slate-900 text-sm">${p.agendamento}</p>
                    </div>
                </div>

                <div class="space-y-4">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Itens do Pedido</h3>
                    <div class="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                        ${p.itens.map((i: any) => `
                            <div class="bg-white border border-slate-100 p-4 rounded-3xl flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <span class="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs">${i.qty}x</span>
                                    <div>
                                        <p class="font-bold text-slate-900 text-xs">${i.nome}</p>
                                        ${i.subitens && i.subitens.length > 0 ? `<p class="text-[10px] text-slate-400 font-medium">${i.subitens.map((s: any) => s.qty + 'x ' + s.nome).join(', ')}</p>` : ''}
                                    </div>
                                </div>
                                <span class="font-bold text-slate-400 text-xs">R$ ${(i.preco * i.qty).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="bg-slate-900 rounded-4xl p-8 text-white">
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-8">
                    <div><p class="text-[10px] font-bold text-slate-500 uppercase mb-1">Subtotal</p><p class="font-bold">R$ ${Number(p.total).toFixed(2)}</p></div>
                    <div><p class="text-[10px] font-bold text-slate-500 uppercase mb-1">Taxa Entrega</p><input type="number" id="taxa-${p.id}" value="${p.taxa_entrega || 0}" class="bg-white/10 border-none outline-none font-bold w-20 rounded p-1 text-sm"></div>
                    <div><p class="text-[10px] font-bold text-slate-500 uppercase mb-1">Desconto</p><input type="number" id="desc-${p.id}" value="${p.desconto || 0}" class="bg-white/10 border-none outline-none font-bold w-20 rounded p-1 text-sm"></div>
                    <div class="text-right"><p class="text-[10px] font-bold text-slate-500 uppercase mb-1">Total Final</p><p class="text-2xl font-bold text-brand-500">R$ ${(Number(p.total) + Number(p.taxa_entrega || 0) - Number(p.desconto || 0)).toFixed(2)}</p></div>
                </div>
                <button onclick="atualizarValores('${p.id}')" class="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-bold transition-all">Atualizar Valores</button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${p.status === 'pendente' ? `
                    <button onclick="prepararPedido('${p.id}')" class="py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-600/20 hover:scale-105 transition-all">Preparar Pedido</button>
                ` : ''}
                ${(p.status === 'pendente' || p.status === 'preparando') ? `
                    <button onclick="confirmarPedido('${p.id}')" class="py-4 bg-brand-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-brand-600/20 hover:scale-105 transition-all">Confirmar Pagamento</button>
                    <button onclick="cancelarPedido('${p.id}')" class="py-4 bg-red-50 text-red-600 rounded-2xl font-bold text-sm border border-red-100 hover:bg-red-100 transition-all">Cancelar Pedido</button>
                ` : ''}
                <button onclick="imprimirPedido('${p.id}')" class="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">Imprimir Recibo</button>
                <button onclick="copyOrderToWhatsApp('${p.id}')" class="py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm border border-emerald-100 hover:bg-emerald-100 transition-all">WhatsApp Cliente</button>
            </div>
        </div>
    `;
}

async function prepararPedido(id: string) {
    try {
        await OrderRepository.updateStatus(id, 'preparando');
        closeModal();
        init();
    } catch (e) {
        alert("Erro ao atualizar status.");
    }
}

async function confirmarPedido(id: string) {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    try {
        const unit = sessionStorage.getItem('admin_unit') || 'bc';
        for (const item of order.itens) {
            await OrderRepository.baixarEstoque(item.id, item.qty, unit);
            if (item.subitens && Array.isArray(item.subitens)) {
                for (const sub of item.subitens) {
                    await OrderRepository.baixarEstoque(sub.id, sub.qty * item.qty, unit);
                }
            }
        }
        await OrderRepository.updateStatus(id, 'confirmado');
        alert("Pedido confirmado e estoque atualizado.");
        closeModal();
        init();
    } catch (error: any) {
        console.error("Erro ao confirmar pedido:", error);
        alert("Erro ao processar baixa de estoque: " + (error.message || "Erro desconhecido"));
    }
}

async function cancelarPedido(id: string) {
    if (!confirm("Tem certeza que deseja cancelar este pedido?")) return;
    try {
        await OrderRepository.updateStatus(id, 'cancelado');
        closeModal();
        init();
    } catch (e) {
        alert("Erro ao cancelar pedido.");
    }
}

async function atualizarValores(id: string) {
    const taxa = parseFloat((document.getElementById(`taxa-${id}`) as HTMLInputElement)?.value || '0');
    const desc = parseFloat((document.getElementById(`desc-${id}`) as HTMLInputElement)?.value || '0');
    try {
        await OrderRepository.updateOrderValores(id, taxa, desc);
        alert("Valores atualizados!");
        init();
        verDetalhes(id);
    } catch (e) {
        alert("Erro ao atualizar valores.");
    }
}

function closeModal() {
    document.getElementById('modal')?.classList.add('hidden');
}

function editProduct(idx: number) {
    const p = products[idx];
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="space-y-8">
            <div class="flex justify-between items-center">
                <h2 class="text-2xl font-bold text-slate-900">Editar Produto</h2>
                <button onclick="closeModal()" class="p-2 bg-slate-50 rounded-2xl text-slate-400">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div class="space-y-2"><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Nome</label><input type="text" id="m-nome" value="${p.nome}" class="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100"></div>
                <div class="space-y-2"><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Preço (R$)</label><input type="number" id="m-preco" value="${p.preco}" class="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100"></div>
                <div class="space-y-2"><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Estoque</label><input type="number" id="m-estoque" value="${p.estoque}" class="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100"></div>
                <div class="space-y-2"><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Peso</label><input type="text" id="m-peso" value="${p.peso || ''}" class="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100"></div>
                <div class="space-y-2 sm:col-span-2"><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Categoria</label><input type="text" id="m-cat" value="${p.categoria}" class="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100"></div>
                <div class="space-y-2 sm:col-span-2"><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Ingredientes</label><textarea id="m-ingredientes" class="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100 h-32">${p.ingredientes || ''}</textarea></div>
                <div class="space-y-2 sm:col-span-2"><label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">URL Imagem (Drive)</label><input type="text" id="m-img" value="${p.imagem_url || ''}" class="w-full bg-slate-50 p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100"></div>
            </div>
            <button onclick="save(${idx})" class="w-full py-5 bg-brand-600 text-white rounded-3xl font-bold text-lg shadow-xl shadow-brand-600/20 hover:scale-[1.02] transition-all">Salvar Alterações</button>
        </div>
    `;
}

async function save(idx: number) {
    const p = products[idx];
    const updates = { 
        nome: (document.getElementById('m-nome') as HTMLInputElement).value, 
        preco: parseFloat((document.getElementById('m-preco') as HTMLInputElement).value), 
        estoque: parseInt((document.getElementById('m-estoque') as HTMLInputElement).value),
        peso: (document.getElementById('m-peso') as HTMLInputElement).value,
        ingredientes: (document.getElementById('m-ingredientes') as HTMLTextAreaElement).value,
        categoria: (document.getElementById('m-cat') as HTMLInputElement).value,
        imagem_url: (document.getElementById('m-img') as HTMLInputElement).value
    };
    
    try {
        const unit = sessionStorage.getItem('admin_unit') || 'bc';
        await ProductRepository.updateProduct(p.id, updates, unit);
        closeModal();
        init();
    } catch (e) {
        alert("Erro ao salvar produto.");
    }
}

async function updateStock(idx: number, delta: number) {
    const p = products[idx];
    const newStock = Math.max(0, p.estoque + delta);
    if (newStock === p.estoque) return;
    
    try {
        const unit = sessionStorage.getItem('admin_unit') || 'bc';
        await ProductRepository.updateProduct(p.id, { estoque: newStock }, unit);
        p.estoque = newStock;
        render();
    } catch (e) {
        console.error("Erro ao atualizar estoque:", e);
        alert("Erro ao atualizar estoque.");
    }
}

function imprimirPedido(id: string) {
    const p = orders.find(o => o.id === id);
    if (!p) return;
    const sub = Number(p.total);
    const taxa = Number(p.taxa_entrega || 0);
    const desc = Number(p.desconto || 0);
    const totalFinal = sub + taxa - desc;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
        <html>
            <head>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 5mm; margin: 0; font-size: 12px; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
                    .item-row { display: flex; justify-content: space-between; margin: 2px 0; }
                    .total-row { display: flex; justify-content: space-between; margin-top: 5px; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="center bold" style="font-size: 16px;">BEBÊ BISTRÔ BC</div>
                <div class="center">Papinhas e Comidinhas Naturais</div>
                <div class="divider"></div>
                <div class="bold">PEDIDO: ${p.codigo}</div>
                <div>DATA: ${new Date(p.created_at).toLocaleString('pt-BR')}</div>
                <div class="divider"></div>
                <div class="bold">CLIENTE:</div>
                <div>${p.cliente_nome} - ${p.cliente_telefone}</div>
                <div class="bold">ENTREGA:</div>
                <div>${p.cliente_endereco}</div>
                <div>Bairro: ${p.cliente_bairro}</div>
                <div class="bold">AGENDAMENTO:</div>
                <div>${p.agendamento}</div>
                <div class="divider"></div>
                <div class="bold">ITENS:</div>
                ${p.itens.map((i: any) => {
                    let mainName = i.nome;
                    let subItems = [];
                    const match = i.nome.match(/^(.*?)\s*\((.*)\)$/);
                    if (match) {
                        mainName = match[1].trim();
                        subItems = match[2].split(',').map((s: any) => s.trim());
                    }

                    let html = `
                        <div class="item-row">
                            <span>* ${i.qty}x ${mainName}</span>
                            <span>R$ ${(i.preco * i.qty).toFixed(2).replace('.', ',')}</span>
                        </div>
                    `;

                    if (subItems.length > 0) {
                        html += subItems.map((sub: any) => `<div style="margin-left: 10px;">- ${sub}</div>`).join('');
                    } else if (i.subitens && i.subitens.length > 0) {
                        html += i.subitens.map((s: any) => `<div style="margin-left: 10px;">- ${s.qty}x ${s.nome}</div>`).join('');
                    }
                    return html;
                }).join('')}
                <div class="divider"></div>
                <div class="item-row"><span>SUBTOTAL:</span><span>R$ ${sub.toFixed(2).replace('.', ',')}</span></div>
                <div class="item-row"><span>TAXA ENTREGA:</span><span>R$ ${taxa.toFixed(2).replace('.', ',')}</span></div>
                <div class="item-row"><span>DESCONTO:</span><span>- R$ ${desc.toFixed(2).replace('.', ',')}</span></div>
                <div class="divider"></div>
                <div class="total-row bold"><span>TOTAL:</span><span>R$ ${totalFinal.toFixed(2).replace('.', ',')}</span></div>
                <div class="divider"></div>
                <div class="center bold" style="margin-top: 10px;">OBRIGADO POR ESCOLHER BEBÊ BISTRÔ!</div>
            </body>
        </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
}

function copyOrderToWhatsApp(id: string) {
    const p = orders.find(o => o.id === id);
    if (!p) return;
    const sub = Number(p.total);
    const taxa = Number(p.taxa_entrega || 0);
    const desc = Number(p.desconto || 0);
    const totalFinal = sub + taxa - desc;
    
    const lines = p.itens.map((i: any) => {
        let itemStr = `* ${i.qty}x ${i.nome}`;
        if (i.subitens && i.subitens.length > 0) {
            const subLines = i.subitens.map((s: any) => `   - ${s.qty}x ${s.nome}`).join('\n');
            itemStr += `\n${subLines}`;
        }
        return itemStr;
    }).join('\n');
    
    const msg = `PEDIDO CONFIRMADO - BEBÊ BISTRÔ\nCódigo: ${p.codigo}\nCliente: ${p.cliente_nome}\nTelefone: ${p.cliente_telefone}\nEntrega: ${p.cliente_endereco}\nBairro: ${p.cliente_bairro}\nAgendamento: ${p.agendamento}\nItens:\n${lines}\n\nSubtotal: R$ ${sub.toFixed(2).replace('.', ',')}\nTaxa de Entrega: R$ ${taxa.toFixed(2).replace('.', ',')}\nTotal: R$ ${totalFinal.toFixed(2).replace('.', ',')}`;
    
    navigator.clipboard.writeText(msg).then(() => alert("Resumo copiado!")).catch(() => alert("Erro ao copiar."));
}

if (sessionStorage.getItem('auth') === '1') init();
