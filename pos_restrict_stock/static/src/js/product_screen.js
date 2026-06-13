/** @odoo-module **/

import {ProductScreen} from "@point_of_sale/app/screens/product_screen/product_screen";
import {patch} from "@web/core/utils/patch";

patch(ProductScreen.prototype, {
    async _barcodeProductAction(code) {
        const product = await this._getProductByBarcode(code);
        if (product && (await this.pos.shouldBlockStock(product, code.value || 1))) {
            this.sound.play("scan-error");
            return;
        }
        return await super._barcodeProductAction(code);
    },

    async _barcodeGS1Action(parsedResults) {
        const productBarcode = parsedResults.find((element) => element.type === "product");
        const qty = parsedResults.find((element) => element.type === "quantity");
        const product = productBarcode && (await this._getProductByBarcode(productBarcode));
        if (product && (await this.pos.shouldBlockStock(product, qty?.value || 1))) {
            this.sound.play("scan-error");
            return;
        }
        return await super._barcodeGS1Action(parsedResults);
    },
});
