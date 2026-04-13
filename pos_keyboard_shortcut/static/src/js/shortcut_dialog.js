/** @odoo-module **/

import {Component} from "@odoo/owl";
import {Dialog} from "@web/core/dialog/dialog";

export class PosShortcutTipsDialog extends Component {
    static template = "pos_keyboard_shortcut.ShortcutTipsDialog";
    static components = {Dialog};
    static props = {
        shortcuts: {type: Array},
        close: Function,
    };

    get groupedShortcuts() {
        const labels = {
            all: "All Screens",
            product: "Product Screen",
            payment: "Payment Screen",
            receipt: "Receipt Screen",
            customer: "Customer Screen",
            order: "Order Screen",
        };
        const groups = [];
        for (const shortcut of this.props.shortcuts) {
            let group = groups.find((item) => item.scope === shortcut.screen_scope);
            if (!group) {
                group = {
                    scope: shortcut.screen_scope,
                    label: labels[shortcut.screen_scope] || shortcut.screen_scope,
                    shortcuts: [],
                };
                groups.push(group);
            }
            group.shortcuts.push(shortcut);
        }
        return groups;
    }
}
