/** @odoo-module **/

import {_t} from "@web/core/l10n/translation";
import {ask} from "@point_of_sale/app/utils/make_awaitable_dialog";
import {PosStore} from "@point_of_sale/app/services/pos_store";
import {patch} from "@web/core/utils/patch";
import {StockWarningDialog} from "./stock_warning_dialog";
import {
    isOutOfStock,
    isStockFeatureEnabled,
    isTrackedForRestriction,
    productTemplate,
    productVariants,
    stockLocationName,
    stockQty,
    stockValue,
} from "./stock_utils";

patch(PosStore.prototype, {
    filterExcludedProducts(products) {
        const filteredList = super.filterExcludedProducts(products);
        if (!this.config?.hide_out_of_stock_products || !isStockFeatureEnabled(this)) {
            return filteredList;
        }
        return filteredList.filter((product) => !isOutOfStock(this, product));
    },

    async addLineToCurrentOrder(vals, opts = {}, configure = true) {
        if (!opts.stockChecked) {
            const product = vals.product_id || opts.presetVariant;
            const template = vals.product_tmpl_id || productTemplate(product);
            const recordToCheck = product || template;
            if (recordToCheck && (await this.shouldBlockStock(recordToCheck, vals.qty || 1))) {
                return;
            }
        }
        return await super.addLineToCurrentOrder(vals, opts, configure);
    },

    async handleConfigurableProduct(values, productTemplate, opts = {}, configure = true) {
        const keepGoing = await super.handleConfigurableProduct(...arguments);
        if (keepGoing === false) {
            return false;
        }
        if (await this.shouldBlockStock(values.product_id, values.qty || 1)) {
            return false;
        }
        return true;
    },

    async handleComboProduct(values, order, configure = true, options = {}) {
        const keepGoing = await super.handleComboProduct(...arguments);
        if (keepGoing === false) {
            return false;
        }
        if (!values.combo_line_ids?.length) {
            return true;
        }
        for (const command of values.combo_line_ids) {
            const comboLine = command[1];
            if (await this.shouldBlockStock(comboLine.product_id, comboLine.qty || 1)) {
                return false;
            }
        }
        return true;
    },

    async shouldBlockStock(record, requestedQty = 1) {
        if (!this.config?.restrict_out_of_stock || !record) {
            return false;
        }

        const normalizedQty = Number(requestedQty || 1);
        if (normalizedQty <= 0) {
            return false;
        }

        const candidate = this.findBlockingRecord(record, normalizedQty);
        if (!candidate) {
            return false;
        }

        if (this.config.allow_manager_override && this.currentCashierCanOverrideStock()) {
            return !(await ask(this.dialog, {
                ...this.stockWarningProps(candidate, normalizedQty),
                confirmLabel: _t("Add Anyway"),
                confirmClass: "btn-warning",
                cancelLabel: _t("Cancel"),
                allowOverride: true,
            }, {}, StockWarningDialog));
        }

        this.dialog.add(StockWarningDialog, this.stockWarningProps(candidate, normalizedQty));
        return true;
    },

    findBlockingRecord(record, requestedQty) {
        if (!isTrackedForRestriction(this, record)) {
            return false;
        }
        const variants = productVariants(record);
        if (variants.length === 1 && variants[0] !== record) {
            return this.findBlockingRecord(variants[0], requestedQty);
        }

        const availableQty = stockQty(record, this.config.stock_type);
        const reserveQty = this.config.stock_threshold || 0;
        const currentOrderQty = this.currentOrderQtyForRecord(record);
        return currentOrderQty + requestedQty > availableQty - reserveQty ? record : false;
    },

    currentOrderQtyForRecord(record) {
        const order = this.getOrder();
        if (!order?.lines?.length) {
            return 0;
        }
        const productIds = new Set(productVariants(record).map((product) => product.id));
        return order.lines.reduce((total, line) => {
            if (line.qty > 0 && productIds.has(line.product_id?.id)) {
                return total + line.qty;
            }
            return total;
        }, 0);
    },

    currentCashierCanOverrideStock() {
        return this.cashier?._role === "manager" || this.cashierHasPriceControlRights?.();
    },

    stockWarningProps(record, requestedQty) {
        const availableQty = stockQty(record, this.config.stock_type);
        const productName = record.display_name || record.name;
        return {
            title: _t("Insufficient Stock"),
            message:
                this.config.out_of_stock_message ||
                _t("This product is currently unavailable in the selected POS location."),
            productName,
            requestedQty: this.env.utils.formatProductQty(requestedQty, false),
            availableQty: this.env.utils.formatProductQty(availableQty, false),
            stockLines: this.stockWarningLines(record),
            locationName: stockLocationName(record) || _t("POS stock location"),
            stockTypeLabel: this.stockTypeLabel(),
        };
    },

    stockWarningLines(record) {
        const stockType = this.config.stock_type;
        if (stockType === "qty_available") {
            return [
                this.stockWarningLine(
                    _t("Qty on Hand"),
                    stockValue(record, "pos_qty_on_hand", 0)
                ),
            ];
        }
        if (stockType === "both") {
            return [
                this.stockWarningLine(
                    _t("Qty on Hand"),
                    stockValue(record, "pos_qty_on_hand", 0)
                ),
                this.stockWarningLine(
                    _t("Forecasted Qty"),
                    stockValue(record, "pos_virtual_qty", 0)
                ),
            ];
        }
        return [
            this.stockWarningLine(
                _t("Forecasted Qty"),
                stockValue(record, "pos_virtual_qty", 0)
            ),
        ];
    },

    stockWarningLine(label, qty) {
        const quantity = qty ?? 0;
        return {
            label,
            value: this.env.utils.formatProductQty(quantity, false),
            danger: quantity <= (this.config.stock_threshold || 0),
        };
    },

    stockTypeLabel() {
        if (this.config.stock_type === "qty_available") {
            return _t("Quantity on Hand");
        }
        if (this.config.stock_type === "both") {
            return _t("On Hand and Forecasted");
        }
        return _t("Forecasted Quantity");
    },
});
