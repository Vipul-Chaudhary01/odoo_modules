/** @odoo-module **/

import {PosData} from "@point_of_sale/app/services/data_service";
import {patch} from "@web/core/utils/patch";

const STOCK_FIELDS = [
    "pos_qty_on_hand",
    "pos_virtual_qty",
    "pos_available_qty",
    "pos_stock_state",
    "pos_stock_location_name",
];
const STOCK_CACHE_VERSION = "19.0.1.0.1";

function hasStockFeature(config) {
    return Boolean(
        config?.display_stock ||
        config?.restrict_out_of_stock ||
        config?.hide_out_of_stock_products
    );
}

function hasStockFields(record) {
    return STOCK_FIELDS.every((field) =>
        Object.prototype.hasOwnProperty.call(record, field)
    );
}

function needsStockCacheReset(localData) {
    const config = localData?.["pos.config"]?.[0];
    if (!hasStockFeature(config)) {
        return false;
    }
    if (config._pos_restrict_stock_cache_version !== STOCK_CACHE_VERSION) {
        return true;
    }

    const templates = localData["product.template"] || [];
    const products = localData["product.product"] || [];
    return [...templates, ...products].some((record) => !hasStockFields(record));
}

patch(PosData.prototype, {
    async getCachedServerDataFromIndexedDB() {
        const localData = await super.getCachedServerDataFromIndexedDB(...arguments);
        if (localData && needsStockCacheReset(localData)) {
            await this.resetIndexedDB();
            await this.initIndexedDB(this.relations);
            return {};
        }
        return localData;
    },
});
