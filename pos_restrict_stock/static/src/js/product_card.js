/** @odoo-module **/

import {ProductCard} from "@point_of_sale/app/components/product_card/product_card";
import {patch} from "@web/core/utils/patch";
import {
    formatStockQty,
    stockLocationName,
    stockQty,
    stockState,
    stockStateClass,
    stockValue,
} from "./stock_utils";

patch(ProductCard.prototype, {
    get posConfig() {
        return this.env.services.pos?.config;
    },

    get stockRecord() {
        return this.props.product;
    },

    get showStockBadge() {
        const config = this.posConfig;
        const product = this.stockRecord;
        return Boolean(
            config?.display_stock &&
            product &&
            stockState(product) &&
            stockState(product) !== "untracked"
        );
    },

    get stockBadgeClass() {
        return stockStateClass(stockState(this.stockRecord));
    },

    get stockBadgeLabel() {
        const config = this.posConfig;
        const product = this.stockRecord;
        if (!config || !product) {
            return "";
        }
        if (config.stock_type === "both") {
            const qtyOnHand = formatStockQty(
                this.env,
                stockValue(product, "pos_qty_on_hand", 0)
            );
            const forecastedQty = formatStockQty(
                this.env,
                stockValue(product, "pos_virtual_qty", 0)
            );
            return `${qtyOnHand} / ${forecastedQty}`;
        }
        return formatStockQty(this.env, stockQty(product, config.stock_type));
    },

    get stockTitle() {
        const product = this.stockRecord;
        const location = stockLocationName(product);
        if (this.posConfig?.stock_type === "both") {
            return `${location} - On hand / Forecasted`;
        }
        return location;
    },
});
