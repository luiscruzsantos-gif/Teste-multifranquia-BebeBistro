import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://svvtmjdyjrvznrfskbvy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2dnRtamR5anJ2em5yZnNrYnZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTQwMTksImV4cCI6MjA4ODgzMDAxOX0.shXtVq0O8d0GONbW8HRxo6sWtZpR_bmdqrs206nEA9Y';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const OrderRepository = {
    async getOrders(unidade: string) {
        const { data, error } = await sb
            .from('pedidos')
            .select('*')
            .eq('unidade', unidade)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createOrder(pedido) {
        const { data, error } = await sb.from('pedidos').insert([pedido]).select();
        if (error) throw error;
        return data;
    },

    async updateStatus(orderId, status) {
        const { data, error } = await sb
            .from('pedidos')
            .update({ status })
            .eq('id', orderId)
            .select();
        if (error) throw error;
        return data;
    },

    async updateOrderValores(orderId, taxa, desconto) {
        const { data, error } = await sb
            .from('pedidos')
            .update({ taxa_entrega: taxa, desconto: desconto })
            .eq('id', orderId)
            .select();
        if (error) throw error;
        return data;
    },

    async baixarEstoque(prodId, qty) {
        // Busca estoque atual
        const { data: prod, error: fetchError } = await sb.from('produtos').select('estoque').eq('id', prodId).single();
        if (fetchError) throw fetchError;
        if (prod) {
            // Atualiza estoque
            const { data, error } = await sb.from('produtos').update({ estoque: prod.estoque - qty }).eq('id', prodId).select();
            if (error) throw error;
            return data;
        }
        return null;
    }
};

export const ProductRepository = {
    async getProducts(unidade: string) {
        const { data, error } = await sb.from('produtos').select('*').eq('unidade', unidade).order('nome');
        if (error) throw error;
        return data;
    },

    async updateProduct(id, updates) {
        const { data, error } = await sb.from('produtos').update(updates).eq('id', id).select();
        if (error) throw error;
        return data;
    }
};

export const ConfigRepository = {
    async getConfigs(unidade: string) {
        const { data, error } = await sb.from('config').select('*').eq('unidade', unidade);
        if (error) throw error;
        return data;
    }
};
