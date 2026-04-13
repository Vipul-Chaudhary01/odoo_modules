/** @odoo-module **/

import {registry} from "@web/core/registry";
import {_t} from "@web/core/l10n/translation";
import {ConfirmationDialog} from "@web/core/confirmation_dialog/confirmation_dialog";
import OrderPaymentValidation from "@point_of_sale/app/utils/order_payment_validation";
import {PosShortcutTipsDialog} from "./shortcut_dialog";

const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true'], .o_input";
const SHORTCUT_REFRESH_TTL = 1500;
const SHORTCUT_FIELDS = [
    "id",
    "name",
    "active",
    "sequence",
    "config_id",
    "screen_scope",
    "action",
    "key",
    "key_normalized",
    "description",
    "target_product_id",
    "target_category_id",
    "target_pricelist_id",
    "target_payment_method_id",
    "target_payment_code",
    "target_amount",
    "stop_propagation",
    "write_date",
];

class PosShortcutService {
    setup(env, {pos, notification, dialog, number_buffer}) {
        this.env = env;
        this.pos = pos;
        this.notification = notification;
        this.dialog = dialog;
        this.numberBuffer = number_buffer;
        this.paused = false;
        this.highlighted = new Map();
        this.lastShortcutRefresh = 0;
        this.shortcutRefreshPromise = null;
        this.liveShortcutIds = new Set();
        this.hasLiveShortcutSnapshot = false;
        this.boundKeydown = this.onKeydown.bind(this);
        this.boundFocus = () => this.refreshShortcuts({force: true});
        this.boundVisibilityChange = () => {
            if (!document.hidden) {
                this.refreshShortcuts({force: true});
            }
        };
        window.addEventListener("keydown", this.boundKeydown, {capture: true});
        window.addEventListener("focus", this.boundFocus);
        document.addEventListener("visibilitychange", this.boundVisibilityChange);
        this.refreshShortcuts({force: true});
    }

    get shortcuts() {
        const shortcuts = this.pos.models?.["pos.keyboard.shortcut"]?.getAll?.() || [];
        const configId = this.pos.config?.id;
        return shortcuts
            .filter((shortcut) => {
                if (this.hasLiveShortcutSnapshot && !this.liveShortcutIds.has(shortcut.id)) {
                    return false;
                }
                return shortcut.active !== false && (!shortcut.config_id || shortcut.config_id.id === configId);
            })
            .slice()
            .sort((left, right) => {
                const leftSpecific = left.config_id ? 0 : 1;
                const rightSpecific = right.config_id ? 0 : 1;
                return leftSpecific - rightSpecific || left.sequence - right.sequence || left.id - right.id;
            });
    }

    get enabled() {
        return Boolean(this.pos.config?.keyboard_shortcut_enabled) && !this.paused;
    }

    async onKeydown(event) {
        if (!this.pos?.config?.keyboard_shortcut_enabled) {
            return;
        }
        const normalized = this.normalizeEvent(event);
        await this.refreshShortcuts();
        const shortcut = this.findShortcut(normalized);
        if (!shortcut || this.shouldIgnoreEvent(event, shortcut)) {
            return;
        }
        if (shortcut.stop_propagation) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        }
        this.execute(shortcut, event);
    }

    async refreshShortcuts({force = false} = {}) {
        if (!this.pos?.data || !this.pos?.config?.id) {
            return;
        }
        const now = Date.now();
        if (!force && this.hasLiveShortcutSnapshot && now - this.lastShortcutRefresh < SHORTCUT_REFRESH_TTL) {
            return this.shortcutRefreshPromise;
        }
        if (this.shortcutRefreshPromise) {
            return this.shortcutRefreshPromise;
        }
        this.shortcutRefreshPromise = (async () => {
            try {
                const records = await this.pos.data.searchRead(
                    "pos.keyboard.shortcut",
                    [
                        "&",
                        ["active", "=", true],
                        "|",
                        ["config_id", "=", false],
                        ["config_id", "=", this.pos.config.id],
                    ],
                    SHORTCUT_FIELDS
                );
                this.liveShortcutIds = new Set(records.map((record) => record.id));
                this.hasLiveShortcutSnapshot = true;
                this.lastShortcutRefresh = Date.now();
            } catch (error) {
                console.warn("Could not refresh POS keyboard shortcuts", error);
            } finally {
                this.shortcutRefreshPromise = null;
            }
        })();
        return this.shortcutRefreshPromise;
    }

    shouldIgnoreEvent(event, shortcut) {
        if (["show_help", "toggle_shortcuts"].includes(shortcut.action)) {
            return false;
        }
        if (!this.enabled) {
            return true;
        }
        const target = event.target;
        if (!target?.matches?.(EDITABLE_SELECTOR)) {
            return false;
        }
        return !["escape", "ctrl+delete", "shift+delete"].includes(shortcut.key_normalized);
    }

    normalizeEvent(event) {
        const aliases = {
            " ": "space",
            esc: "escape",
            del: "delete",
            arrowup: "arrowup",
            arrowdown: "arrowdown",
            arrowleft: "arrowleft",
            arrowright: "arrowright",
        };
        const key = aliases[String(event.key || "").toLowerCase()] || String(event.key || "").toLowerCase();
        const modifiers = [];
        if (event.ctrlKey) {
            modifiers.push("ctrl");
        }
        if (event.altKey) {
            modifiers.push("alt");
        }
        if (event.shiftKey && key !== "shift") {
            modifiers.push("shift");
        }
        if (event.metaKey) {
            modifiers.push("meta");
        }
        return [...modifiers, key].join("+");
    }

    activeScope() {
        if (document.querySelector(".partner-list")) {
            return "customer";
        }
        const current = this.pos.router?.state?.current;
        if (current === "PaymentScreen") {
            return "payment";
        }
        if (current === "ReceiptScreen") {
            return "receipt";
        }
        if (current === "TicketScreen") {
            return "order";
        }
        return "product";
    }

    findShortcut(normalizedKey) {
        const scope = this.activeScope();
        const candidateKeys = this.expandNormalizedKeys(normalizedKey);
        return this.shortcuts.find(
            (shortcut) =>
                candidateKeys.includes(shortcut.key_normalized) &&
                (shortcut.screen_scope === "all" || shortcut.screen_scope === scope)
        );
    }

    expandNormalizedKeys(normalizedKey) {
        const keys = [normalizedKey];
        if (normalizedKey?.startsWith("shift+")) {
            const shiftedKey = normalizedKey.slice("shift+".length);
            if (shiftedKey.length === 1 && !/^[a-z0-9]$/.test(shiftedKey)) {
                keys.push(shiftedKey);
            }
        }
        return keys;
    }

    async execute(shortcut, event) {
        const handlers = {
            go_payment: () => this.pos.pay(),
            go_customer: () => this.pos.selectPartner(),
            go_order: () => this.pos.navigate("TicketScreen"),
            go_product: () => this.navigateProduct(),
            back: () => this.goBack(),
            add_order: () => this.addOrder(),
            delete_order: () => this.deleteCurrentOrder(),
            mode_quantity: () => this.setNumpadMode("quantity"),
            mode_discount: () => this.setNumpadMode("discount"),
            mode_price: () => this.setNumpadMode("price"),
            focus_product_search: () => this.focusProductSearch(),
            delete_orderline: () => this.deleteSelectedOrderline(),
            clear_orderlines: () => this.clearOrderlines(),
            select_orderline_up: () => this.selectOrderline(-1),
            select_orderline_down: () => this.selectOrderline(1),
            increase_orderline_qty: () => this.changeSelectedOrderlineQty(1),
            decrease_orderline_qty: () => this.changeSelectedOrderlineQty(-1),
            duplicate_orderline: () => this.duplicateSelectedOrderline(),
            add_first_product: () => this.addFirstProduct(),
            add_visible_products: () => this.addVisibleProducts(),
            select_category: () => this.selectCategory(shortcut),
            add_product: () => this.addProduct(shortcut),
            cash_move: () => this.pos.cashMove(),
            create_product: () => this.pos.editProduct(),
            select_pricelist: () => this.selectPricelist(shortcut),
            refund_order: () => this.openRefundOrders(),
            change_cashier: () => this.openCashierLogin(),
            validate_order: () => this.validateOrder(),
            delete_paymentline: () => this.deleteSelectedPaymentLine(),
            clear_paymentlines: () => this.clearPaymentLines(),
            select_paymentline_up: () => this.selectPaymentLine(-1),
            select_paymentline_down: () => this.selectPaymentLine(1),
            payment_method: () => this.selectPaymentMethod(shortcut),
            payment_amount: () => this.setPaymentAmount(shortcut),
            pay_remaining: () => this.payRemaining(shortcut),
            next_order: () => this.nextOrder(),
            focus_customer_search: () => this.focusSelector(".partner-list input"),
            select_customer_up: () => this.moveDomSelection(".partner-list tbody tr", -1),
            select_customer_down: () => this.moveDomSelection(".partner-list tbody tr", 1),
            set_customer: () => this.clickHighlighted(".partner-list tbody tr"),
            edit_customer: () => this.clickInHighlighted(".partner-list tbody tr", "button, .edit-partner-button"),
            save_customer: () => this.clickSelector(".modal button.btn-primary"),
            create_customer: () => this.clickSelector(".partner-list .modal-header button.btn-primary, .partner-list .modal-footer button.btn-primary"),
            focus_order_search: () => this.focusSelector(".ticket-screen input"),
            select_order_up: () => this.moveDomSelection(".ticket-screen .order-row", -1),
            select_order_down: () => this.moveDomSelection(".ticket-screen .order-row", 1),
            select_order: () => this.clickHighlighted(".ticket-screen .order-row"),
            show_help: () => this.showTips(),
            toggle_shortcuts: () => this.toggleShortcuts(),
        };
        try {
            await handlers[shortcut.action]?.(event);
        } catch (error) {
            console.warn("POS shortcut failed", shortcut.action, error);
            this.notification.add(_t("Shortcut action could not be completed."), {type: "warning"});
        }
    }

    navigateProduct() {
        const order = this.pos.getOrder() || this.pos.addNewOrder();
        this.pos.navigate("ProductScreen", {orderUuid: order.uuid});
    }

    goBack() {
        if (document.querySelector(".modal.show")) {
            this.clickSelector(".modal.show .btn-close, .modal.show button.btn-secondary");
            return;
        }
        if (this.pos.router?.state?.current === "ProductScreen") {
            return;
        }
        this.pos.router?.back?.();
    }

    addOrder() {
        const order = this.pos.addNewOrder();
        this.pos.navigate("ProductScreen", {orderUuid: order.uuid});
    }

    deleteCurrentOrder() {
        const order = this.pos.getOrder();
        if (!order || order.finalized) {
            return;
        }
        this.dialog.add(ConfirmationDialog, {
            title: _t("Delete current order?"),
            body: _t("This will remove the current draft order from the POS."),
            confirmLabel: _t("Delete"),
            confirmClass: "btn-danger",
            confirm: async () => {
                await this.pos.deleteOrders([order]);
                const nextOrder = this.pos.getOrder() || this.pos.addNewOrder();
                this.pos.navigate("ProductScreen", {orderUuid: nextOrder.uuid});
            },
        });
    }

    setNumpadMode(mode) {
        this.numberBuffer.capture();
        this.numberBuffer.reset();
        this.pos.numpadMode = mode;
    }

    focusProductSearch() {
        this.focusSelector(".pos-topheader input, .pos-rightheader input");
    }

    deleteSelectedOrderline() {
        const line = this.pos.getOrder()?.getSelectedOrderline();
        if (line) {
            this.pos.getOrder().removeOrderline(line);
        }
    }

    clearOrderlines() {
        const order = this.pos.getOrder();
        for (const line of [...(order?.lines || [])]) {
            order.removeOrderline(line);
        }
    }

    selectOrderline(step) {
        const order = this.pos.getOrder();
        const lines = order?.lines || [];
        if (!lines.length) {
            return;
        }
        const selected = order.getSelectedOrderline();
        const currentIndex = Math.max(0, lines.findIndex((line) => line === selected));
        const nextIndex = Math.min(lines.length - 1, Math.max(0, currentIndex + step));
        order.selectOrderline(lines[nextIndex]);
    }

    changeSelectedOrderlineQty(step) {
        const line = this.pos.getOrder()?.getSelectedOrderline();
        if (!line) {
            return;
        }
        const nextQuantity = line.getQuantity() + step;
        if (nextQuantity <= 0) {
            this.pos.getOrder().removeOrderline(line);
            return;
        }
        line.setQuantity(nextQuantity, true);
    }

    duplicateSelectedOrderline() {
        const line = this.pos.getOrder()?.getSelectedOrderline();
        if (!line?.product_id) {
            return;
        }
        return this.pos.addLineToCurrentOrder(
            {product_id: line.product_id, product_tmpl_id: line.product_id.product_tmpl_id},
            {},
            line.product_id.needToConfigure?.()
        );
    }

    addFirstProduct() {
        const firstProduct = this.pos.productsToDisplay?.[0];
        if (firstProduct) {
            return this.pos.addLineToCurrentOrder({product_tmpl_id: firstProduct}, {}, firstProduct.needToConfigure?.());
        }
        this.clickSelector(".product-list .product");
    }

    async addVisibleProducts() {
        const products = this.pos.productsToDisplay || [];
        if (!products.length) {
            this.notification.add(_t("No visible products to add."), {type: "warning"});
            return;
        }
        for (const product of products) {
            await this.pos.addLineToCurrentOrder(
                {product_tmpl_id: product},
                {},
                product.needToConfigure?.()
            );
        }
    }

    selectCategory(shortcut) {
        if (shortcut.target_category_id) {
            this.pos.setSelectedCategory(shortcut.target_category_id.id);
        }
    }

    addProduct(shortcut) {
        const product = shortcut.target_product_id;
        if (!product) {
            return;
        }
        return this.pos.addLineToCurrentOrder(
            {product_id: product, product_tmpl_id: product.product_tmpl_id},
            {},
            product.needToConfigure?.()
        );
    }

    selectPricelist(shortcut) {
        if (shortcut.target_pricelist_id) {
            return this.pos.selectPricelist(shortcut.target_pricelist_id);
        }
    }

    openRefundOrders() {
        this.pos.navigate("TicketScreen", {
            stateOverride: {
                filter: "SYNCED",
            },
        });
        this.notification.add(_t("Select an order and use Refund."), {type: "info"});
    }

    openCashierLogin() {
        if (this.pos.config.module_pos_hr) {
            this.pos.navigate("LoginScreen");
        } else {
            this.notification.add(_t("Employee login is not enabled for this POS."), {type: "warning"});
        }
    }

    validateOrder() {
        const order = this.pos.getOrder();
        if (!order) {
            return;
        }
        const validation = new OrderPaymentValidation({
            pos: this.pos,
            orderUuid: order.uuid,
        });
        return validation.validateOrder(false);
    }

    deleteSelectedPaymentLine() {
        const order = this.pos.getOrder();
        const line = order?.getSelectedPaymentline();
        if (line) {
            order.removePaymentline(line);
            this.numberBuffer.reset();
        }
    }

    clearPaymentLines() {
        const order = this.pos.getOrder();
        for (const line of [...(order?.payment_ids || [])]) {
            order.removePaymentline(line);
        }
        this.numberBuffer.reset();
    }

    selectPaymentLine(step) {
        const order = this.pos.getOrder();
        const lines = order?.payment_ids || [];
        if (!lines.length) {
            return;
        }
        const selected = order.getSelectedPaymentline();
        const currentIndex = Math.max(0, lines.findIndex((line) => line === selected));
        const nextIndex = Math.min(lines.length - 1, Math.max(0, currentIndex + step));
        order.selectPaymentline(lines[nextIndex]);
        this.numberBuffer.reset();
    }

    selectPaymentMethod(shortcut) {
        const method = this.findPaymentMethod(shortcut);
        if (!method) {
            this.notification.add(_t("No matching payment method is available."), {type: "warning"});
            return;
        }
        const order = this.pos.getOrder();
        const result = order.addPaymentline(method);
        if (result.status) {
            this.numberBuffer.set(result.data.amount.toString());
        } else {
            this.notification.add(result.data, {type: "warning"});
        }
    }

    findPaymentMethod(shortcut) {
        if (shortcut.target_payment_method_id) {
            return this.pos.config.payment_method_ids.find(
                (method) => method.id === shortcut.target_payment_method_id.id
            );
        }
        const code = (shortcut.target_payment_code || "").toLowerCase();
        if (code === "cash") {
            return this.pos.config.payment_method_ids.find((method) => method.is_cash_count || method.type === "cash");
        }
        if (code === "bank") {
            return this.pos.config.payment_method_ids.find(
                (method) => !method.is_cash_count && ["bank", "pay_later"].includes(method.type)
            ) || this.pos.config.payment_method_ids.find((method) => !method.is_cash_count);
        }
        return this.pos.config.payment_method_ids.find((method) =>
            method.name?.toLowerCase().includes(code)
        );
    }

    setPaymentAmount(shortcut) {
        const order = this.pos.getOrder();
        let line = order?.getSelectedPaymentline();
        if (!line && this.pos.config.payment_method_ids.length) {
            const result = order.addPaymentline(this.pos.config.payment_method_ids[0]);
            if (!result.status) {
                return;
            }
            line = order.getSelectedPaymentline();
        }
        if (line) {
            line.setAmount(shortcut.target_amount);
            this.numberBuffer.set(String(shortcut.target_amount));
        }
    }

    payRemaining(shortcut) {
        const method = this.findPaymentMethod(shortcut) || this.pos.config.payment_method_ids[0];
        if (!method) {
            this.notification.add(_t("No payment method is available."), {type: "warning"});
            return;
        }
        const result = this.pos.getOrder()?.addPaymentline(method);
        if (result?.status) {
            this.numberBuffer.set(result.data.amount.toString());
        } else if (result?.data) {
            this.notification.add(result.data, {type: "warning"});
        }
    }

    nextOrder() {
        const order = this.pos.addNewOrder();
        this.pos.navigate("ProductScreen", {orderUuid: order.uuid});
    }

    async showTips() {
        await this.refreshShortcuts({force: true});
        this.dialog.add(PosShortcutTipsDialog, {
            shortcuts: this.shortcuts,
        });
    }

    toggleShortcuts() {
        this.paused = !this.paused;
        this.notification.add(
            this.paused ? _t("POS keyboard shortcuts paused.") : _t("POS keyboard shortcuts enabled."),
            {type: this.paused ? "warning" : "success"}
        );
    }

    focusSelector(selector) {
        const element = document.querySelector(selector);
        element?.focus?.();
        element?.select?.();
    }

    clickSelector(selector) {
        document.querySelector(selector)?.click?.();
    }

    moveDomSelection(selector, step) {
        const rows = [...document.querySelectorAll(selector)].filter((row) => row.offsetParent !== null);
        if (!rows.length) {
            return;
        }
        const current = this.highlighted.get(selector) ?? rows.findIndex((row) => row.classList.contains("active") || row.classList.contains("highlight"));
        const next = Math.min(rows.length - 1, Math.max(0, (current < 0 ? 0 : current) + step));
        rows.forEach((row) => row.classList.remove("ps-shortcut-highlight"));
        rows[next].classList.add("ps-shortcut-highlight");
        rows[next].scrollIntoView({block: "nearest"});
        this.highlighted.set(selector, next);
    }

    clickHighlighted(selector) {
        const rows = [...document.querySelectorAll(selector)].filter((row) => row.offsetParent !== null);
        const index = this.highlighted.get(selector) ?? rows.findIndex((row) => row.classList.contains("active") || row.classList.contains("highlight"));
        rows[index >= 0 ? index : 0]?.click?.();
    }

    clickInHighlighted(selector, innerSelector) {
        const rows = [...document.querySelectorAll(selector)].filter((row) => row.offsetParent !== null);
        const index = this.highlighted.get(selector) ?? 0;
        const row = rows[index] || rows[0];
        (row?.querySelector(innerSelector) || row)?.click?.();
    }

}

const posShortcutService = {
    dependencies: ["pos", "notification", "dialog", "number_buffer"],
    start(env, deps) {
        const service = new PosShortcutService();
        service.setup(env, deps);
        return service;
    },
};

registry.category("services").add("pos_keyboard_shortcuts", posShortcutService);
