export interface Addon { id: number; name: string; additional_price: number }
export interface AddonGroup { id: number; name: string; is_required: boolean; max_selections: number; addons: Addon[] }
export interface MenuItemVariation { id: number; name: string; price: number; sort_order: number }
export interface MenuItem {
    id: number; name: string; description: string; price: number;
    display_price?: number; has_variations?: boolean; variations?: MenuItemVariation[];
    image_url: string | null; category_id: number; addon_groups: AddonGroup[];
}
export interface Category { id: number; name: string; icon: string; menu_items: MenuItem[] }
export interface TableOption { id: number; name: string }
export interface CartItem {
    id: string; menuItem: MenuItem; quantity: number;
    selectedVariation: MenuItemVariation | null; selectedAddons: Addon[];
    notes: string; unitPrice: number;
}
export type StationStatus = 'pending' | 'preparing' | 'ready' | 'completed';
export interface OrderItemLine {
    id: number;
    menu_item: { name: string; is_kitchen?: boolean };
    variation?: { name: string } | null;
    quantity: number;
    subtotal: number;
    notes?: string | null;
    is_done?: boolean;
    addons: Array<{ name: string }>;
}
export interface Order {
    id: number; order_number: string; status: string; type: string;
    kitchen_status?: StationStatus | null;
    barista_status?: StationStatus | null;
    subtotal: number; tax: number; discount: number; total: number;
    table: { id: number; name: string } | null;
    items: OrderItemLine[];
    payment: { method: string; amount: number } | null;
    created_at: string;
}
export interface Customer {
    id: number; name: string; phone: string | null; email: string | null;
    notes: string | null; points: number; cup_count: number; free_drinks_available: number;
}
export type OrderType = 'dine-in' | 'takeout' | 'walkin';
export type PayMethod = 'cash' | 'card' | 'gcash' | 'maya';
export interface PosSettings { currency: string; tax_rate: number; pay_as_you_order: boolean }
