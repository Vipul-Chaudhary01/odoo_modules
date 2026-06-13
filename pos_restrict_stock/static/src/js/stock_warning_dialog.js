/** @odoo-module **/

import {Component} from "@odoo/owl";
import {Dialog} from "@web/core/dialog/dialog";
import {_t} from "@web/core/l10n/translation";

export class StockWarningDialog extends Component {
    static template = "pos_restrict_stock.StockWarningDialog";
    static components = {Dialog};
    static props = {
        close: Function,
        title: {type: String, optional: true},
        message: {type: String, optional: true},
        productName: String,
        requestedQty: String,
        availableQty: String,
        stockLines: {type: Array, optional: true},
        locationName: String,
        stockTypeLabel: {type: String, optional: true},
        confirm: {type: Function, optional: true},
        confirmLabel: {type: String, optional: true},
        confirmClass: {type: String, optional: true},
        cancel: {type: Function, optional: true},
        cancelLabel: {type: String, optional: true},
        allowOverride: {type: Boolean, optional: true},
    };
    static defaultProps = {
        title: _t("Insufficient Stock"),
        message: _t("This product is currently unavailable in the selected POS location."),
        confirmLabel: _t("Ok"),
        confirmClass: "btn-primary",
        cancelLabel: _t("Cancel"),
        stockTypeLabel: "",
        stockLines: [],
        allowOverride: false,
    };

    async onConfirm() {
        if (this.props.confirm) {
            await this.props.confirm();
        }
        this.props.close();
    }

    async onCancel() {
        if (this.props.cancel) {
            await this.props.cancel();
        }
        this.props.close();
    }
}
