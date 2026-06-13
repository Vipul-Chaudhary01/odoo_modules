/** @odoo-module **/

export function isStockFeatureEnabled(pos) {
    return Boolean(
        pos?.config?.display_stock ||
        pos?.config?.restrict_out_of_stock ||
        pos?.config?.hide_out_of_stock_products
    );
}

export function stockValue(record, fieldName, fallback = undefined) {
    if (!record) {
        return fallback;
    }
    return record.raw?.[fieldName] ?? record[fieldName] ?? fallback;
}

export function stockState(record) {
    return stockValue(record, "pos_stock_state", false);
}

export function stockLocationName(record) {
    return stockValue(record, "pos_stock_location_name", "");
}

export function isTrackedForRestriction(pos, record) {
    if (!record) {
        return false;
    }
    const stockState = stockState(record);
    return Boolean(stockState && stockState !== "untracked");
}

export function stockQty(record, stockType) {
    if (!record) {
        return 0;
    }
    const qtyOnHand = stockValue(record, "pos_qty_on_hand", 0);
    const virtualQty = stockValue(record, "pos_virtual_qty");
    const availableQty = stockValue(record, "pos_available_qty");
    if (stockType === "qty_available") {
        return qtyOnHand;
    }
    if (stockType === "both") {
        return Math.min(qtyOnHand, virtualQty ?? 0);
    }
    return virtualQty ?? availableQty ?? 0;
}

export function formatStockQty(env, qty) {
    return env.utils.formatProductQty(qty || 0, false);
}

export function productVariants(record) {
    if (!record) {
        return [];
    }
    if (record.model?.name === "product.product") {
        return [record];
    }
    if (record.product_variant_ids) {
        return record.product_variant_ids;
    }
    return [record];
}

export function productTemplate(record) {
    return record?.product_tmpl_id || record;
}

export function isOutOfStock(pos, record) {
    if (!isTrackedForRestriction(pos, record)) {
        return false;
    }
    const availableQty = stockQty(record, pos.config.stock_type);
    return availableQty <= (pos.config.stock_threshold || 0);
}

export function stockStateClass(state) {
    if (state === "out") {
        return "pos-stock-out";
    }
    if (state === "untracked") {
        return "pos-stock-untracked";
    }
    return "pos-stock-available";
}
