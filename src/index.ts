import { OrderRepository, ProductRepository, ConfigRepository } from './repository';

// Constants
const CATEGORIES = [
    { id: 'todos', label: 'Todos', icon: '🍽️' },
    { id: 'combos', label: 'Combos', icon: '🎁' },
    { id: 'doces-6', label: 'Doces', icon: '🍎' },
    { id: 'papinhas-6', label: '6-8 Meses', icon: '👶' },
    { id: 'papinhas-8', label: '8-12 Meses', icon: '🥣' },
    { id: 'comidinhas-12', label: '1 a 3 anos', icon: '🍛' }
];

const DELIVERY_CONFIG: any = {
    'Balneário Camboriú': {
        bairros: [
            { nome: 'Centro', taxa: 13 },
            { nome: 'Nações', taxa: 13 },
            { nome: 'Pioneiros', taxa: 13 },
            { nome: 'Estados', taxa: 13 },
            { nome: 'Ariribá', taxa: 13 },
            { nome: 'Vila Real', taxa: 13 },
            { nome: 'Municípios', taxa: 13 },
            { nome: 'Iate Clube', taxa: 13 },
            { nome: 'Praia dos Amores', taxa: 15 },
            { nome: 'Nova Esperança', taxa: 15 },
            { nome: 'Barra', taxa: 15 }
        ],
        freeShipping: true
    },
    'Camboriú': {
        manual: true,
        consulte: true
    },
    'Itapema': {
        manual: true,
        consulte: true
    },
    'Blumenau': {
        bairros: [
            { nome: 'Garcia', taxa: 12 },
            { nome: 'Velha', taxa: 12 },
            { nome: 'Itoupava', taxa: 15 },
            { nome: 'Centro', taxa: 10 },
            { nome: 'Victor Konder', taxa: 10 },
            { nome: 'Vila Nova', taxa: 10 },
            { nome: 'Escola Agrícola', taxa: 12 },
            { nome: 'Água Verde', taxa: 12 },
            { nome: 'Ponta Aguda', taxa: 12 },
            { nome: 'Vorstadt', taxa: 12 }
        ],
        freeShipping: false
    }
};

// State management
export const state: any = {
    unidade: sessionStorage.getItem('unidade') || null,
    products: [],
    cart: JSON.parse(localStorage.getItem('cart') || '[]'),
    configs: [],
    activeCat: 'todos',
    hours: { semana: '', sabado: '' },
    absence: { inicio: null, fim: null },
    isPaused: false,
    address: (() => {
        try {
            const saved = JSON.parse(localStorage.getItem('address') || '{}');
            const unidade = sessionStorage.getItem('unidade');
            return { 
                nome: saved.nome || '', 
                telefone: saved.telefone || '',
                rua: saved.rua || '', 
                bairro: saved.bairro || '',
                complemento: saved.complemento || '', 
                cidade: saved.cidade || (unidade === 'blu' ? 'Blumenau' : 'Balneário Camboriú'), 
                data: '', 
                horario: '', 
                combinar: false 
            };
        } catch (e) {
            const unidade = sessionStorage.getItem('unidade');
            return { nome: '', telefone: '', rua: '', bairro: '', complemento: '', cidade: (unidade === 'blu' ? 'Blumenau' : 'Balneário Camboriú'), data: '', horario: '', combinar: false };
        }
    })()
};

// Attach functions to window for HTML access
(window as any).state = state;
(window as any).selectUnit = selectUnit;
(window as any).showUnitModal = showUnitModal;

function showUnitModal() {
    const modal = document.getElementById('unit-modal');
    if (modal) modal.classList.remove('hidden');
}
(window as any).addToCart = addToCart;
(window as any).removeFromCart = removeFromCart;
(window as any).updateQty = updateQty;
(window as any).setAddress = setAddress;
(window as any).send = send;
(window as any).render = render;
(window as any).validateDeliveryDate = validateDeliveryDate;
(window as any).getAvailableTimeSlots = getAvailableTimeSlots;
(window as any).openCombo = openCombo;
(window as any).updateComboItem = updateComboItem;
(window as any).confirmCombo = confirmCombo;
(window as any).closeCombo = closeCombo;

const driveImg = (input: string, width = 300) => {
    if (!input) return `https://via.placeholder.com/${width}x${width}?text=Sem+Foto`;
    
    // Aplica transformações APENAS se for Supabase
    if (input.includes('supabase.co')) {
        return `${input}?width=${width}&height=${width}&resize=contain&quality=80&format=webp`;
    }

    // Se for link do Google Drive ou apenas o ID, usa o proxy lh3 para exibir a imagem
    if (input.includes('drive.google.com') || !input.startsWith('http')) {
        const idMatch = input.match(/[-\w]{25,}/);
        const id = idMatch ? idMatch[0] : input;
        return `https://lh3.googleusercontent.com/d/${id}=w1000`;
    }

    // Outros links externos retornam sem alteração
    return input;
};

let comboState: any = { productId: null, selected: [], rules: [] };

function openCombo(id: string) {
    const p = state.products.find((x: any) => x.id === id);
    comboState.productId = id;
    comboState.selected = [];
    comboState.rules = [];
    
    if (p.nome.includes('7 Papinhas (8m+)')) {
        comboState.rules = [
            { cat: 'papinhas-8', limit: 5, label: 'Papinhas Salgadas (8m+)' },
            { cat: 'doces-6', limit: 2, label: 'Papinhas Doces (6m+)' }
        ];
    } else if (p.nome.includes('12 Papinhas (6m+)') || p.nome.includes('Megacombo 12')) {
        comboState.rules = [
            { cat: 'papinhas-6', limit: 10, label: 'Papinhas Salgadas (6m+)' },
            { cat: 'doces-6', limit: 2, label: 'Papinhas Doces (6m+)' }
        ];
    } else {
        const match = p.nome.match(/(\d+)/);
        const limit = match ? parseInt(match[1]) : 5;
        let targetCat = '';
        if (p.nome.includes('6m+')) targetCat = 'papinhas-6';
        else if (p.nome.includes('8m+')) targetCat = 'papinhas-8';
        else if (p.nome.includes('12m+')) targetCat = 'comidinhas-12';
        
        comboState.rules = [{ cat: targetCat, limit: limit, label: 'Itens do Combo' }];
    }

    const modal = document.getElementById('combo-modal');
    const itemsContainer = document.getElementById('combo-items');
    if (!modal || !itemsContainer) return;

    let targetCats = comboState.rules.map((r: any) => r.cat);
    if (p.nome.includes('7 Papinhas (8m+)') || p.nome.includes('12 Papinhas (6m+)')) {
        if (!targetCats.includes('doces-6')) targetCats.push('doces-6');
    }

    const flavors = state.products.filter((f: any) => {
        const cat = f.categoria ? f.categoria.toLowerCase().trim() : '';
        return targetCats.includes(cat) && f.estoque > 0;
    });
    
    if (flavors.length === 0) {
        itemsContainer.innerHTML = '<p class="text-center py-10 text-slate-400 font-bold">Nenhum sabor disponível para este combo no momento.</p>';
    } else {
        let html = '';
        const allCategoriesInFlavors = [...new Set(flavors.map((f: any) => f.categoria))];
        allCategoriesInFlavors.forEach(catId => {
            const cat = CATEGORIES.find(c => c.id === catId);
            if (!cat) return;

            const catFlavors = flavors.filter((f: any) => f.categoria === catId);
            if (catFlavors.length > 0) {
                const rule = comboState.rules.find((r: any) => r.cat === catId);
                const limitText = rule ? ` (Limite: ${rule.limit})` : '';
                html += `
                    <div class="mb-6">
                        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">${cat.label}${limitText}</h4>
                        <div class="space-y-3">
                            ${catFlavors.map((f: any) => `
                                <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                    <div class="flex items-center gap-3">
                                        <img src="${f.displayImg}" class="w-12 h-12 rounded-xl object-cover">
                                        <div>
                                            <p class="font-bold text-sm text-slate-900">${f.nome}</p>
                                            <p class="text-[10px] text-slate-400 font-bold uppercase">${f.categoria} | Estoque: ${f.estoque > 0 ? f.estoque : 'Esgotado'}</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <button onclick="updateComboItem('${f.id}', -1)" class="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400">-</button>
                                        <span id="combo-qty-${f.id}" class="text-sm font-bold w-4 text-center">${comboState.selected.find((s: any) => s.id === f.id)?.qty || 0}</span>
                                        <button onclick="updateComboItem('${f.id}', 1)" ${f.estoque <= 0 ? 'disabled' : ''} class="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-400 ${f.estoque <= 0 ? 'opacity-50 cursor-not-allowed' : ''}">+</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        });
        itemsContainer.innerHTML = html;
    }
    
    updateComboUI();
    modal.classList.remove('hidden');
}

function updateComboItem(id: string, delta: number) {
    const p = state.products.find((x: any) => x.id === id);
    const cat = p.categoria ? p.categoria.toLowerCase().trim() : '';
    const rule = comboState.rules.find((r: any) => r.cat === cat);
    if (!rule) return;

    const currentCatTotal = comboState.selected.filter((s: any) => {
        const sp = state.products.find((x: any) => x.id === s.id);
        return (sp.categoria ? sp.categoria.toLowerCase().trim() : '') === cat;
    }).reduce((a: number, b: any) => a + b.qty, 0);

    const item = comboState.selected.find((s: any) => s.id === id);
    
    if (delta > 0) {
        if (p.estoque <= 0) return;
        if (currentCatTotal >= rule.limit) return;
        if (item && item.qty >= p.estoque) {
            alert(`Estoque insuficiente para "${p.nome}" (Máximo: ${p.estoque})`);
            return;
        }
    }
    
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) comboState.selected = comboState.selected.filter((s: any) => s.id !== id);
    } else if (delta > 0) {
        comboState.selected.push({ id, nome: p.nome, qty: 1 });
    }
    
    const qtyEl = document.getElementById(`combo-qty-${id}`);
    if (qtyEl) qtyEl.innerText = comboState.selected.find((s: any) => s.id === id)?.qty || 0;
    
    updateComboItemButtons(id, p.estoque);
    updateComboUI();
}

function updateComboItemButtons(id: string, estoque: number) {
    const item = comboState.selected.find((s: any) => s.id === id);
    const btnPlus = document.querySelector(`button[onclick="updateComboItem('${id}', 1)"]`) as HTMLButtonElement;
    if (btnPlus) {
        const reached = item && item.qty >= estoque;
        btnPlus.disabled = reached;
        btnPlus.classList.toggle('opacity-50', reached);
        btnPlus.classList.toggle('cursor-not-allowed', reached);
    }
}

function updateComboUI() {
    const progress = document.getElementById('combo-progress');
    const confirmBtn = document.getElementById('confirm-combo') as HTMLButtonElement;
    if (!progress || !confirmBtn) return;
    
    let allRulesMet = true;
    let statusParts: string[] = [];

    comboState.rules.forEach((rule: any) => {
        const currentCatTotal = comboState.selected.filter((s: any) => {
            const sp = state.products.find((x: any) => x.id === s.id);
            return (sp.categoria ? sp.categoria.toLowerCase().trim() : '') === rule.cat;
        }).reduce((a: number, b: any) => a + b.qty, 0);

        const remaining = rule.limit - currentCatTotal;
        if (remaining > 0) {
            allRulesMet = false;
            statusParts.push(`${remaining} ${rule.label}`);
        }
    });

    if (allRulesMet) {
        progress.innerText = 'Tudo pronto!';
        progress.className = 'text-sm font-bold text-brand-600 mt-1';
        confirmBtn.disabled = false;
        confirmBtn.className = 'w-full mt-8 py-5 rounded-2xl font-bold text-white gradient-btn shadow-xl shadow-brand-600/20';
        confirmBtn.onclick = confirmCombo;
    } else {
        progress.innerText = `Selecione mais: ${statusParts.join(', ')}`;
        progress.className = 'text-sm font-bold text-amber-500 mt-1';
        confirmBtn.disabled = true;
        confirmBtn.className = 'w-full mt-8 py-5 rounded-2xl font-bold text-white bg-slate-200 cursor-not-allowed';
    }
}

function confirmCombo() {
    const p = state.products.find((x: any) => x.id === comboState.productId);
    const comboItem = {
        ...p,
        qty: 1,
        subitens: comboState.selected.map((s: any) => ({ id: s.id, nome: s.nome, qty: s.qty }))
    };
    
    state.cart.push(comboItem);
    saveCart();
    closeCombo();
    render();
}

function closeCombo() {
    const modal = document.getElementById('combo-modal');
    if (modal) modal.classList.add('hidden');
}

function selectUnit(unit: string) {
    console.log('Selecionando unidade:', unit);
    sessionStorage.setItem('unidade', unit);
    state.unidade = unit;
    
    // Ajusta a cidade padrão se necessário
    if (state.address.cidade === 'Balneário Camboriú' || state.address.cidade === 'Blumenau' || !state.address.cidade) {
        state.address.cidade = unit === 'blu' ? 'Blumenau' : 'Balneário Camboriú';
        saveAddress();
    }

    const modal = document.getElementById('unit-modal');
    if (modal) modal.classList.add('hidden');
    
    // Recarrega a página para garantir que todo o estado seja reiniciado corretamente
    window.location.reload();
}

async function init() {
    console.log('Iniciando aplicação para unidade:', state.unidade);
    const modal = document.getElementById('unit-modal');
    if (!state.unidade) {
        if (modal) modal.classList.remove('hidden');
        return;
    } else {
        if (modal) modal.classList.add('hidden');
    }

    try {
        const hTitle = document.getElementById('header-title');
        const hSubtitle = document.getElementById('header-subtitle');
        if (hTitle) hTitle.innerText = state.unidade === 'blu' ? 'Bebe Bistrô Blumenau' : 'Bebe Bistrô Balneário Camboriú';
        if (hSubtitle) hSubtitle.innerText = 'Papinhas e Comidinhas Naturais Congeladas';

        state.configs = await ConfigRepository.getConfigs(state.unidade);
        if (state.configs) {
            state.hours.semana = state.configs.find((c: any) => c.key === 'horario_semana')?.value || '09:00 - 18:00';
            state.hours.sabado = state.configs.find((c: any) => c.key === 'horario_sabado')?.value || 'Sob Consulta';
            state.absence.inicio = state.configs.find((c: any) => c.key === 'ausencia_inicio')?.value || null;
            state.absence.fim = state.configs.find((c: any) => c.key === 'ausencia_fim')?.value || null;
            const pausedConfig = state.configs.find((c: any) => c.key === 'loja_pausada')?.value;
            state.isPaused = pausedConfig === 'true' || pausedConfig === true;

            const hSemana = document.getElementById('hero-hours-semana');
            const hSabado = document.getElementById('hero-hours-sabado');
            if (hSemana) hSemana.innerText = `Seg-Sex: ${state.hours.semana}`;
            if (hSabado) hSabado.innerText = `Sáb: ${state.hours.sabado}`;
        }

        const db = await ProductRepository.getProducts(state.unidade);
        console.log('Produtos carregados:', db?.length);
        state.products = (db || []).map((p: any) => ({ ...p, displayImg: driveImg(p.imagem_url, 300) }));
        
        render();
    } catch (e) {
        console.error("Erro ao carregar dados:", e);
        render();
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(state.cart));
}

function saveAddress() {
    const { nome, telefone, rua, bairro, complemento, cidade } = state.address;
    localStorage.setItem('address', JSON.stringify({ nome, telefone, rua, bairro, complemento, cidade }));
}

function addToCart(id: string) {
    const p = state.products.find((x: any) => x.id === id);
    if (!p || p.estoque <= 0) return;
    
    const existing = state.cart.find((x: any) => x.id === id);
    if (existing) {
        if (existing.qty >= p.estoque) {
            alert(`Desculpe, temos apenas ${p.estoque} unidades de "${p.nome}" em estoque.`);
            return;
        }
        existing.qty++;
    } else {
        state.cart.push({ ...p, qty: 1 });
    }
    saveCart();
    render();
}

function removeFromCart(id: string) {
    const item = state.cart.find((c: any) => c.id === id);
    if (!item) return;
    item.qty--;
    if (item.qty <= 0) state.cart = state.cart.filter((c: any) => c.id !== id);
    saveCart();
    render();
}

function updateQty(id: string, delta: number) {
    const item = state.cart.find((x: any) => x.id === id);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) removeFromCart(id);
        else {
            saveCart();
            render();
        }
    }
}

function setAddress(field: string, value: any) {
    state.address[field] = value;
    if (['nome', 'telefone', 'rua', 'bairro', 'complemento', 'cidade'].includes(field)) {
        saveAddress();
    }
}

function isDateInAbsencePeriod(dateStr: string) {
    if (!state.absence.inicio || !state.absence.fim) return false;
    const checkDate = new Date(dateStr.replace(/-/g, '/'));
    const start = new Date(state.absence.inicio.replace(/-/g, '/'));
    const end = new Date(state.absence.fim.replace(/-/g, '/'));
    checkDate.setHours(0,0,0,0);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    return checkDate >= start && checkDate <= end;
}

function validateDeliveryDate(value: string) {
    if (!value) return;
    const d = new Date(value.replace(/-/g, '/'));
    if (d.getDay() === 0) {
        alert('Não realizamos entregas aos domingos. Por favor, escolha outro dia.');
        state.address.data = '';
        render();
        return;
    }
    if (isDateInAbsencePeriod(value)) {
        alert('Desculpe, estaremos fechados neste período. Por favor, escolha outra data.');
        state.address.data = '';
        render();
        return;
    }
    state.address.data = value;
    state.address.horario = '';
    render();
}

function getAvailableTimeSlots(dateStr: string) {
    if (!dateStr) return [];
    if (isDateInAbsencePeriod(dateStr)) return [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const minTime = now.getHours() * 60 + now.getMinutes() + 30;
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    if (day === 0) return [];
    let hoursStr = (day >= 1 && day <= 5) ? state.hours.semana : state.hours.sabado;
    if (!hoursStr || hoursStr.toLowerCase().includes('consulta') || hoursStr.toLowerCase().includes('fechado')) return [];
    const slots = [];
    const ranges = hoursStr.split(',').map((r: string) => r.trim());
    for (const range of ranges) {
        const parts = range.includes(' - ') ? range.split(' - ') : range.split('-');
        if (parts.length === 2) {
            const [startH, startM] = parts[0].trim().split(':').map(Number);
            const [endH, endM] = parts[1].trim().split(':').map(Number);
            let current = startH * 60 + startM;
            const end = endH * 60 + endM;
            while (current <= end) {
                if (!isToday || current >= minTime) {
                    const h = Math.floor(current / 60).toString().padStart(2, '0');
                    const min = (current % 60).toString().padStart(2, '0');
                    slots.push(`${h}:${min}`);
                }
                current += 30;
            }
        }
    }
    return [...new Set(slots)].sort();
}

function isStoreOpen() {
    if (state.isPaused) return false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    if (isDateInAbsencePeriod(todayStr)) return false;
    const day = now.getDay();
    const time = now.getHours() * 60 + now.getMinutes();
    let hoursStr = '';
    if (day >= 1 && day <= 5) hoursStr = state.hours.semana;
    else if (day === 6) hoursStr = state.hours.sabado;
    else return false;
    if (!hoursStr || hoursStr.toLowerCase().includes('consulta') || hoursStr.toLowerCase().includes('fechado')) return false;
    const ranges = hoursStr.split(',').map((r: string) => r.trim());
    for (const range of ranges) {
        const parts = range.includes(' - ') ? range.split(' - ') : range.split('-');
        if (parts.length === 2) {
            const [startH, startM] = parts[0].trim().split(':').map(Number);
            const [endH, endM] = parts[1].trim().split(':').map(Number);
            const start = startH * 60 + startM;
            const end = endH * 60 + endM;
            if (time >= start && time <= end) return true;
        }
    }
    return false;
}

async function send() {
    const a = state.address;
    if (!a.nome || !a.rua || !a.bairro || !a.telefone || !a.cidade) {
        alert("Por favor, preencha todos os campos obrigatórios: Nome, Telefone, Cidade, Rua e Bairro.");
        return;
    }
    if (state.cart.length === 0) {
        alert("Carrinho vazio.");
        return;
    }
    const subtotal = state.cart.reduce((acc: number, item: any) => acc + (item.preco * item.qty), 0);
    
    const cityConfig = DELIVERY_CONFIG[a.cidade];
    let taxaEntrega = 0;
    let taxaStr = 'A combinar';

    if (cityConfig) {
        if (cityConfig.consulte) {
            taxaEntrega = 0;
            taxaStr = 'A consultar';
        } else {
            const bairroData = cityConfig.bairros.find((b: any) => b.nome === a.bairro);
            if (bairroData) {
                const isEligibleForFreeShipping = a.cidade === 'Balneário Camboriú';
                
                taxaEntrega = (cityConfig.freeShipping && isEligibleForFreeShipping && subtotal >= 150) ? 0 : bairroData.taxa;
                taxaStr = taxaEntrega === 0 ? 'Grátis' : `R$ ${taxaEntrega.toFixed(2)}`;
            }
        }
    }

    const totalFinal = subtotal + taxaEntrega;
    const codigo = "BB-" + Date.now();
    const agendamento = a.combinar ? 'Combinar com a loja' : `${a.data} às ${a.horario}`;
    const pedido = {
        codigo: codigo,
        unidade: state.unidade,
        cliente_nome: a.nome,
        cliente_telefone: a.telefone,
        cliente_endereco: `${a.rua}${a.complemento ? ', ' + a.complemento : ''} - ${a.cidade}`,
        cliente_bairro: a.bairro,
        agendamento: agendamento,
        itens: state.cart.map((i: any) => ({
            id: i.id,
            nome: i.nome,
            qty: i.qty,
            preco: i.preco,
            subitens: i.subitens || []
        })),
        total: subtotal, // Apenas o valor dos produtos (Subtotal)
        taxa_entrega: taxaEntrega, // Apenas o valor do frete
        desconto: 0,
        status: "pendente"
    };
    try {
        await OrderRepository.createOrder(pedido);
        const lines = state.cart.map((i: any) => {
            let itemStr = `* ${i.qty}x ${i.nome}`;
            if (i.subitens && i.subitens.length > 0) {
                const subLines = i.subitens.map((s: any) => ` - ${s.qty}x ${s.nome}`).join('%0A');
                itemStr += `%0A${subLines}`;
            }
            return itemStr;
        }).join('%0A');
        
        const msg = `NOVO PEDIDO - BEBÊ BISTRÔ (${state.unidade === 'blu' ? 'Blumenau' : 'BC'})%0ACódigo: ${codigo}%0ACliente: ${a.nome}%0ATelefone: ${a.telefone}%0AEntrega: ${a.rua}${a.complemento ? ', ' + a.complemento : ''}%0ACidade: ${a.cidade}%0ABairro: ${a.bairro}%0AAgendamento: ${agendamento}%0AItens:%0A${lines}%0A%0ASubtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}%0ATaxa de Entrega: R$ ${taxaEntrega.toFixed(2).replace('.', ',')}%0ATotal: R$ ${totalFinal.toFixed(2).replace('.', ',')}`;
        
        const whatsappNumber = state.unidade === 'blu' ? '5547999999999' : '5547997335500'; 
        const url = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${msg}`;
        state.cart = [];
        saveCart();
        window.location.hash = '';
        render();
        window.location.href = url;
    } catch (error) {
        alert("Erro ao registrar pedido.");
        console.error(error);
    }
}

function render() {
    try {
        const container = document.getElementById('view-container');
        const statusText = document.getElementById('shop-status-text');
        const checkoutModal = document.getElementById('checkout-modal');
        const checkoutContent = document.getElementById('checkout-modal-content');
        const catList = document.getElementById('category-list');
        
        if (!container || !statusText || !checkoutModal || !checkoutContent || !catList) return;

        if (state.isPaused) {
            statusText.innerText = 'Loja Pausada';
            statusText.className = 'text-[10px] font-bold text-red-500 uppercase';
        } else {
            const isOpen = isStoreOpen();
            statusText.innerText = isOpen ? 'Entregando agora' : 'Recebendo somente agendamentos';
            statusText.className = `text-[10px] font-bold ${isOpen ? 'text-brand-600' : 'text-amber-500'} uppercase`;
        }

        catList.innerHTML = CATEGORIES.map(cat => `
            <button onclick="state.activeCat='${cat.id}'; window.location.hash=''; render();" 
                class="category-btn whitespace-nowrap px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all border border-slate-100 ${state.activeCat === cat.id ? 'active' : 'bg-white text-slate-500 hover:bg-slate-50'}">
                <span>${cat.icon}</span> ${cat.label}
            </button>
        `).join('');

        renderMenu(container);

        if (window.location.hash === '#checkout') {
            checkoutModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            renderCheckout(checkoutContent);
        } else {
            checkoutModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
        
        const badge = document.getElementById('cart-badge');
        const qty = state.cart.reduce((a: number, b: any) => a + b.qty, 0);
        if (badge) {
            badge.innerText = qty.toString(); 
            badge.classList.toggle('hidden', qty === 0);
        }

        const totalPreview = document.getElementById('header-total-preview');
        const totalVal = document.getElementById('header-total-val');
        const total = state.cart.reduce((a: number, b: any) => a + (b.preco * b.qty), 0);
        if (totalPreview && totalVal) {
            if (total > 0) {
                totalPreview.classList.remove('hidden');
                totalPreview.classList.add('flex');
                totalVal.innerText = `R$ ${total.toFixed(2)}`;
            } else {
                totalPreview.classList.add('hidden');
                totalPreview.classList.remove('flex');
            }
        }
    } catch (e) {
        console.error("Erro na função render:", e);
    }
}

function renderMenu(container: HTMLElement) {
    let sections: any[] = [];
    const normalizedProducts = state.products.map((p: any) => {
        let cat = p.categoria ? p.categoria.toLowerCase().trim() : '';
        if (cat === 'combo') cat = 'combos';
        if (cat === 'doce') cat = 'doces-6';
        return { ...p, categoria: cat };
    });

    if (state.activeCat === 'todos') {
        const order = ['combos', 'doces-6', 'papinhas-6', 'papinhas-8', 'comidinhas-12'];
        
        // Primeiro, adiciona as categorias na ordem definida
        order.forEach(catId => {
            const cat = CATEGORIES.find(c => c.id === catId);
            let items = normalizedProducts.filter((p: any) => p.categoria === catId);
            if (items.length > 0 && cat) sections.push({ title: cat.label, items });
        });

        // Depois, adiciona qualquer outra categoria que tenha produtos e não esteja na ordem
        const otherCats = [...new Set(normalizedProducts.map((p: any) => p.categoria))]
            .filter(catId => !order.includes(catId));
        
        otherCats.forEach(catId => {
            const cat = CATEGORIES.find(c => c.id === catId);
            let items = normalizedProducts.filter((p: any) => p.categoria === catId);
            if (items.length > 0) {
                sections.push({ 
                    title: cat ? cat.label : (catId.charAt(0).toUpperCase() + catId.slice(1)), 
                    items 
                });
            }
        });

        // Ordenação específica para comidinhas-12 em qualquer seção que a contenha
        sections.forEach(section => {
            if (section.title.toLowerCase().includes('1 a 3 anos') || section.title.toLowerCase().includes('comidinhas')) {
                section.items.sort((a: any, b: any) => {
                    const numA = parseInt(a.nome.match(/\d+/)?.[0] || '0');
                    const numB = parseInt(b.nome.match(/\d+/)?.[0] || '0');
                    return numA - numB;
                });
            }
        });
    } else {
        const cat = CATEGORIES.find(c => c.id === state.activeCat);
        let items = normalizedProducts.filter((p: any) => p.categoria === state.activeCat);
        if (state.activeCat === 'comidinhas-12') {
            items.sort((a: any, b: any) => {
                const numA = parseInt(a.nome.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.nome.match(/\d+/)?.[0] || '0');
                return numA - numB;
            });
        }
        if (items.length > 0 && cat) sections.push({ title: cat.label, items });
    }
    
    if (sections.length === 0) {
        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 py-24 text-center animate-slideUp">
                <div class="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-200">
                    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 11v10l8 4" />
                    </svg>
                </div>
                <h3 class="text-2xl font-bold text-slate-900 mb-3">Nenhum produto encontrado</h3>
                <p class="text-slate-500 mb-10 max-w-md mx-auto">Não encontramos itens nesta categoria no momento. Que tal dar uma olhadinha em todo o nosso cardápio?</p>
                <button onclick="state.activeCat='todos'; render();" 
                    class="gradient-btn text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-brand-500/20 hover:scale-105 transition-transform">
                    Ver todos os produtos
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        ${state.isPaused ? `<div class="max-w-7xl mx-auto px-4 pt-8 animate-slideUp"><div class="bg-red-50 border border-red-100 p-6 rounded-4xl flex flex-col sm:flex-row items-center justify-between gap-4"><div class="flex items-center gap-4"><div class="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><div><h3 class="font-bold text-red-900">Loja Temporariamente Pausada</h3><p class="text-xs text-red-600 font-medium">Estamos preparando novos sabores! Voltamos em breve.</p></div></div></div></div>` : ''}
        <div class="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-slideUp">
            ${sections.map(section => `
                <div class="space-y-6">
                    <div class="flex items-center gap-4"><h2 class="text-2xl font-bold text-slate-900">${section.title}</h2><div class="h-[2px] flex-1 bg-slate-100"></div></div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        ${section.items.map((p: any) => {
                            const isNew = p.nome.toLowerCase().includes('novidade');
                            const isBest = p.nome.toLowerCase().includes('mais pedido');
                            const cartItem = state.cart.find((c: any) => c.id === p.id);
                            const isCombo = p.categoria === 'combos';
                            
                            const whatsappNumber = state.unidade === 'blu' ? '5547999999999' : '5547997335500';
                            
                            return `
                            <div class="product-card bg-white rounded-4xl border border-slate-100 overflow-hidden flex flex-col shadow-sm relative">
                                ${isNew ? '<span class="absolute top-4 left-4 z-10 bg-brand-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">✨ NOVIDADE</span>' : ''}
                                ${isBest ? '<span class="absolute top-4 left-4 z-10 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">🏆 MAIS PEDIDO</span>' : ''}
                                
                                <div class="relative aspect-[4/3] overflow-hidden bg-slate-50">
                                    <img src="${p.displayImg}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/400x400?text=Imagem+Indisponivel'">
                                    ${p.estoque <= 0 ? '<div class="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center font-bold text-slate-900 text-xs uppercase tracking-widest">Esgotado</div>' : ''}
                                </div>
                                
                                <div class="p-6 flex flex-col flex-1">
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-[10px] font-bold text-slate-300 uppercase tracking-widest">${p.categoria}</span>
                                        <span class="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">${p.peso || '200g'}</span>
                                    </div>
                                    
                                    <h3 class="text-lg font-bold text-slate-900 leading-tight mb-2 h-[50px] overflow-hidden">${p.nome}</h3>
                                    <p class="text-xs text-slate-400 line-clamp-3 mb-6 leading-relaxed min-h-[48px]">${p.ingredientes || 'Ingredientes selecionados com carinho.'}</p>
                                    
                                    <div class="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <div>
                                            <p class="text-[10px] text-slate-300 font-bold uppercase">Preço</p>
                                            <p class="text-xl font-bold text-brand-600">R$ ${Number(p.preco).toFixed(2)}</p>
                                        </div>
                                        
                                        ${isCombo ? `
                                            ${p.estoque <= 0 ? `
                                                <button onclick="window.location.href='https://api.whatsapp.com/send?phone=${whatsappNumber}&text=Tenho%20interesse%20no%20produto%20${encodeURIComponent(p.nome)},%20avise-me%20quando%20chegar.'"
                                                    class="bg-slate-100 text-slate-500 px-4 py-3 rounded-2xl font-bold text-[10px] leading-tight hover:bg-slate-200 transition-all">
                                                    Avise-me quando chegar
                                                </button>
                                            ` : `
                                                <button onclick="openCombo('${p.id}')" ${state.isPaused ? 'disabled' : ''} 
                                                    class="gradient-btn text-white px-4 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-brand-500/20 disabled:opacity-30 disabled:shadow-none">
                                                    Montar Combo
                                                </button>
                                            `}
                                        ` : `
                                            <div class="flex items-center gap-2">
                                                ${cartItem ? `
                                                    <div class="flex items-center gap-3 bg-slate-50 rounded-xl p-1">
                                                        <button onclick="removeFromCart('${p.id}')" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 font-bold">-</button>
                                                        <span class="text-sm font-bold w-4 text-center">${cartItem.qty}</span>
                                                        <button onclick="addToCart('${p.id}')" ${cartItem.qty >= p.estoque ? 'disabled' : ''} class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-600 font-bold disabled:opacity-20 disabled:cursor-not-allowed">+</button>
                                                    </div>
                                                ` : `
                                                    ${p.estoque <= 0 ? `
                                                        <button onclick="window.location.href='https://api.whatsapp.com/send?phone=${whatsappNumber}&text=Tenho%20interesse%20no%20produto%20${encodeURIComponent(p.nome)},%20avise-me%20quando%20chegar.'"
                                                            class="bg-slate-100 text-slate-500 px-4 py-3 rounded-2xl font-bold text-[10px] leading-tight hover:bg-slate-200 transition-all">
                                                            Avise-me quando chegar
                                                        </button>
                                                    ` : `
                                                        <button onclick="addToCart('${p.id}')" ${state.isPaused ? 'disabled' : ''} 
                                                            class="gradient-btn text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-brand-500/20 disabled:opacity-30 disabled:shadow-none">
                                                            ${state.isPaused ? 'Pausado' : 'Adicionar'}
                                                        </button>
                                                    `}
                                                `}
                                            </div>
                                        `}
                                    </div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`).join('')}
        </div>`;
}

function renderCheckout(container: HTMLElement) {
    const subtotal = state.cart.reduce((acc: number, item: any) => acc + (item.preco * item.qty), 0);
    const availableSlots = getAvailableTimeSlots(state.address.data);
    
    const freeShippingLimit = 150;
    const progress = Math.min((subtotal / freeShippingLimit) * 100, 100);
    const missing = freeShippingLimit - subtotal;

    const cityConfig = DELIVERY_CONFIG[state.address.cidade];
    let taxaEntrega = 0;
    let taxaStr = 'Selecione a cidade e bairro';
    let canHaveFreeShipping = false;

    if (cityConfig) {
        if (cityConfig.consulte) {
            taxaEntrega = 0;
            taxaStr = 'A consultar';
        } else {
            const bairroData = cityConfig.bairros.find((b: any) => b.nome === state.address.bairro);
            if (bairroData) {
                // Frete grátis apenas para BC
                const isEligibleForFreeShipping = state.address.cidade === 'Balneário Camboriú';
                
                canHaveFreeShipping = cityConfig.freeShipping && isEligibleForFreeShipping;
                taxaEntrega = (canHaveFreeShipping && subtotal >= freeShippingLimit) ? 0 : bairroData.taxa;
                taxaStr = taxaEntrega === 0 ? 'Grátis' : `R$ ${taxaEntrega.toFixed(2)}`;
            }
        }
    }
    const totalFinal = subtotal + taxaEntrega;

    container.innerHTML = `
        <div class="p-6 sm:p-10 space-y-8">
            <div class="flex justify-between items-center border-b border-slate-50 pb-6">
                <h2 class="text-2xl font-bold text-slate-900">Sua Sacola</h2>
                <button onclick="window.location.hash = '';" class="p-2 bg-slate-50 rounded-2xl text-slate-400">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <!-- Barra de Progresso Frete Grátis -->
            ${canHaveFreeShipping ? `
            <div class="space-y-3">
                <div class="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <span class="${subtotal >= freeShippingLimit ? 'text-brand-600' : 'text-orange-500'}">
                        ${subtotal >= freeShippingLimit ? '🎉 Parabéns! Você ganhou Frete Grátis!' : `Faltam R$ ${missing.toFixed(2)} para frete grátis`}
                    </span>
                    <span class="text-slate-400">${progress.toFixed(0)}%</span>
                </div>
                <div class="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full transition-all duration-500 ${subtotal >= freeShippingLimit ? 'bg-brand-600' : 'bg-orange-400'}" style="width: ${progress}%"></div>
                </div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Válido para Balneário Camboriú</p>
            </div>
            ` : `
            <div class="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Taxa de Entrega</p>
                <p class="text-[10px] text-slate-400 font-medium leading-tight">Frete fixo por região para Blumenau e proximidades.</p>
            </div>
            `}

            <div class="space-y-4">
                ${state.cart.length === 0 ? '<p class="text-center py-10 text-slate-400 font-bold">Sua sacola está vazia.</p>' : state.cart.map((item: any) => `
                    <div class="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl">
                        <img src="${driveImg(item.imagem_url, 100)}" class="w-16 h-16 rounded-2xl object-cover">
                        <div class="flex-1">
                            <h4 class="font-bold text-slate-900 text-sm">${item.nome}</h4>
                            <p class="text-xs font-bold text-brand-600">R$ ${item.preco.toFixed(2)}</p>
                        </div>
                        <div class="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm">
                            <button onclick="updateQty('${item.id}', -1)" class="w-8 h-8 flex items-center justify-center text-slate-400 font-bold">-</button>
                            <span class="font-bold text-slate-900 text-sm">${item.qty}</span>
                            <button onclick="updateQty('${item.id}', 1)" class="w-8 h-8 flex items-center justify-center text-brand-600 font-bold">+</button>
                        </div>
                        <button onclick="removeFromCart('${item.id}')" class="p-2 text-red-400 hover:text-red-600 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                `).join('')}
            </div>

            <div class="space-y-6 bg-slate-50 p-6 sm:p-8 rounded-4xl">
                <h3 class="font-bold text-slate-900">Informações de Entrega</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input type="text" placeholder="Seu Nome" value="${state.address.nome}" oninput="setAddress('nome', this.value)" class="w-full bg-white p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100">
                    <input type="tel" placeholder="Telefone" value="${state.address.telefone}" oninput="setAddress('telefone', this.value)" class="w-full bg-white p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100">
                    <input type="text" placeholder="Rua e Número" value="${state.address.rua}" oninput="setAddress('rua', this.value)" class="w-full bg-white p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100 sm:col-span-2">
                    
                    <select onchange="setAddress('cidade', this.value); setAddress('bairro', ''); render();" class="w-full bg-white p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100 appearance-none">
                        <option value="">Selecione a Cidade</option>
                        ${Object.keys(DELIVERY_CONFIG).map(city => `<option value="${city}" ${state.address.cidade === city ? 'selected' : ''}>${city}</option>`).join('')}
                    </select>

                    ${cityConfig && cityConfig.manual ? `
                        <input type="text" placeholder="Bairro" value="${state.address.bairro}" oninput="setAddress('bairro', this.value)" class="w-full bg-white p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100">
                    ` : `
                        <select onchange="setAddress('bairro', this.value); render();" ${!state.address.cidade ? 'disabled' : ''} class="w-full bg-white p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100 appearance-none disabled:opacity-50">
                            <option value="">Selecione o Bairro</option>
                            ${cityConfig ? cityConfig.bairros.map((b: any) => `<option value="${b.nome}" ${state.address.bairro === b.nome ? 'selected' : ''}>${b.nome}</option>`).join('') : ''}
                        </select>
                    `}

                    <input type="text" placeholder="Complemento" value="${state.address.complemento}" oninput="setAddress('complemento', this.value)" class="w-full bg-white p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100 sm:col-span-2">
                </div>

                <div class="space-y-4 pt-4 border-t border-slate-200">
                    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Agendamento</h4>
                    <div class="flex items-center gap-2 mb-4">
                        <input type="checkbox" id="chk-combinar" ${state.address.combinar ? 'checked' : ''} onchange="setAddress('combinar', this.checked); render();" class="w-5 h-5 rounded-lg border-slate-300 text-brand-600 focus:ring-brand-500">
                        <label for="chk-combinar" class="text-sm font-bold text-slate-700">Combinar data/horário depois</label>
                    </div>
                    ${!state.address.combinar ? `
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input type="date" value="${state.address.data}" onchange="validateDeliveryDate(this.value)" class="w-full bg-white p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100">
                            <select onchange="setAddress('horario', this.value); render();" class="w-full bg-white p-4 rounded-2xl outline-none font-bold text-sm border border-slate-100 appearance-none">
                                <option value="">Escolha o Horário</option>
                                ${availableSlots.map((s: string) => `<option value="${s}" ${state.address.horario === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="space-y-4 pt-6">
                <div class="space-y-2 border-b border-slate-100 pb-4">
                    <div class="flex justify-between items-center text-sm font-bold text-slate-400">
                        <span>Subtotal</span>
                        <span>R$ ${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm font-bold text-slate-400">
                        <span>Taxa de Entrega</span>
                        <span class="${taxaEntrega === 0 && cityConfig && !cityConfig.consulte && state.address.bairro ? 'text-brand-600' : ''}">${taxaStr}</span>
                    </div>
                </div>
                <div class="flex justify-between items-center text-xl font-bold text-slate-900">
                    <span>Total</span>
                    <span class="text-brand-600">R$ ${totalFinal.toFixed(2)}</span>
                </div>
                <button onclick="send()" ${state.isPaused || state.cart.length === 0 || !state.address.bairro || !state.address.cidade ? 'disabled' : ''} class="w-full gradient-btn text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-brand-600/20 disabled:opacity-30">
                    ${state.isPaused ? 'Loja Pausada' : 'Finalizar no WhatsApp'}
                </button>
            </div>
        </div>`;
}

window.addEventListener('hashchange', render);
init();
