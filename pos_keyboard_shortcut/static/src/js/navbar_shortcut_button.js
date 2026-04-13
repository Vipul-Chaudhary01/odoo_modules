/** @odoo-module **/

import {Navbar} from "@point_of_sale/app/components/navbar/navbar";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";

patch(Navbar.prototype, {
    setup() {
        super.setup(...arguments);
        this.shortcutService = useService("pos_keyboard_shortcuts");
    },

    get showShortcutTipsButton() {
        return Boolean(this.pos.config?.keyboard_shortcut_enabled);
    },

    openShortcutTips() {
        this.shortcutService.showTips();
    },
});
