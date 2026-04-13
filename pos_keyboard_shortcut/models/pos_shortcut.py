# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo.fields import Domain


class PosKeyboardShortcut(models.Model):
    _name = "pos.keyboard.shortcut"
    _description = "POS Keyboard Shortcut"
    _inherit = ["pos.load.mixin"]
    _order = "sequence, screen_scope, name, id"

    SCREEN_SELECTION = [
        ("all", "All Screens"),
        ("product", "Product Screen"),
        ("payment", "Payment Screen"),
        ("receipt", "Receipt Screen"),
        ("customer", "Customer Screen"),
        ("order", "Order Screen"),
    ]

    ACTION_SELECTION = [
        ("go_payment", "Go to Payment"),
        ("go_customer", "Go to Customer"),
        ("go_order", "Go to Orders"),
        ("go_product", "Go to Product Screen"),
        ("back", "Go Back"),
        ("add_order", "Add New Order"),
        ("delete_order", "Delete Current Order"),
        ("mode_quantity", "Quantity Mode"),
        ("mode_discount", "Discount Mode"),
        ("mode_price", "Price Mode"),
        ("focus_product_search", "Search Product"),
        ("delete_orderline", "Delete Order Line"),
        ("clear_orderlines", "Clear Order Lines"),
        ("select_orderline_up", "Select Previous Order Line"),
        ("select_orderline_down", "Select Next Order Line"),
        ("increase_orderline_qty", "Increase Line Quantity"),
        ("decrease_orderline_qty", "Decrease Line Quantity"),
        ("duplicate_orderline", "Duplicate Order Line"),
        ("add_first_product", "Add First Visible Product"),
        ("add_visible_products", "Add Visible Products"),
        ("select_category", "Select POS Category"),
        ("add_product", "Add Product"),
        ("cash_move", "Cash In/Out"),
        ("create_product", "Create Product"),
        ("select_pricelist", "Select Pricelist"),
        ("refund_order", "Refund Order"),
        ("change_cashier", "Change Cashier"),
        ("validate_order", "Validate Order"),
        ("delete_paymentline", "Delete Payment Line"),
        ("clear_paymentlines", "Clear Payment Lines"),
        ("select_paymentline_up", "Select Previous Payment Line"),
        ("select_paymentline_down", "Select Next Payment Line"),
        ("pay_remaining", "Pay Remaining Amount"),
        ("payment_method", "Select Payment Method"),
        ("payment_amount", "Set Payment Amount"),
        ("next_order", "Next Order"),
        ("focus_customer_search", "Search Customer"),
        ("select_customer_up", "Select Previous Customer"),
        ("select_customer_down", "Select Next Customer"),
        ("set_customer", "Set Customer"),
        ("edit_customer", "Edit Customer"),
        ("save_customer", "Save Customer"),
        ("create_customer", "Create Customer"),
        ("focus_order_search", "Search Order"),
        ("select_order_up", "Select Previous Order"),
        ("select_order_down", "Select Next Order"),
        ("select_order", "Select Order"),
        ("show_help", "Show Shortcut Tips"),
        ("toggle_shortcuts", "Enable/Disable Shortcuts"),
    ]

    name = fields.Char(required=True, translate=True)
    active = fields.Boolean(default=True)
    sequence = fields.Integer(default=10)
    config_id = fields.Many2one(
        "pos.config",
        string="Point of Sale",
        ondelete="cascade",
        help="Leave empty to make this shortcut available to every POS configuration.",
    )
    company_id = fields.Many2one(
        "res.company",
        string="Company",
        related="config_id.company_id",
        store=True,
        readonly=True,
    )
    screen_scope = fields.Selection(SCREEN_SELECTION, required=True, default="product")
    action = fields.Selection(ACTION_SELECTION, required=True)
    key = fields.Char(
        required=True,
        help="Examples: Shift+P, Ctrl+C, Delete, ArrowUp, F10, +",
    )
    key_normalized = fields.Char(
        compute="_compute_key_normalized",
        store=True,
        index=True,
    )
    description = fields.Char(translate=True)
    target_product_id = fields.Many2one("product.product", string="Product")
    target_category_id = fields.Many2one("pos.category", string="POS Category")
    target_pricelist_id = fields.Many2one("product.pricelist", string="Pricelist")
    target_payment_method_id = fields.Many2one("pos.payment.method", string="Payment Method")
    target_payment_code = fields.Char(
        string="Payment Method Code",
        help="Optional fallback such as cash or bank. Used when no exact payment method is selected.",
    )
    target_amount = fields.Float(string="Amount")
    stop_propagation = fields.Boolean(default=True)

    @api.depends("key")
    def _compute_key_normalized(self):
        for shortcut in self:
            shortcut.key_normalized = shortcut._normalize_key(shortcut.key)

    @api.model
    def _normalize_key(self, key):
        if not key:
            return False
        aliases = {
            "control": "ctrl",
            "cmd": "meta",
            "command": "meta",
            "esc": "escape",
            "del": "delete",
            "arrow up": "arrowup",
            "arrow down": "arrowdown",
            "arrow left": "arrowleft",
            "arrow right": "arrowright",
            "spacebar": "space",
            "return": "enter",
        }
        parts = [part.strip().lower() for part in key.replace("-", "+").split("+") if part.strip()]
        normalized = []
        for part in parts:
            normalized.append(aliases.get(part, part))
        modifiers = [part for part in ("ctrl", "alt", "shift", "meta") if part in normalized]
        regular = [part for part in normalized if part not in modifiers]
        if not regular:
            return "+".join(modifiers)
        return "+".join(modifiers + [regular[-1]])

    @api.constrains("key", "screen_scope", "config_id", "active")
    def _check_duplicate_shortcut(self):
        for shortcut in self.filtered("active"):
            if not shortcut.key_normalized:
                continue
            same_config_domain = [("config_id", "=", shortcut.config_id.id or False)]
            scope_domain = (
                [("screen_scope", "=", "all")]
                if shortcut.screen_scope == "all"
                else [("screen_scope", "in", ("all", shortcut.screen_scope))]
            )
            domain = Domain.AND([
                [("id", "!=", shortcut.id), ("active", "=", True), ("key_normalized", "=", shortcut.key_normalized)],
                same_config_domain,
                scope_domain,
            ])
            conflict = self.search(domain, limit=1)
            if conflict:
                raise ValidationError(_(
                    "Shortcut '%(key)s' conflicts with '%(name)s' on %(screen)s.",
                    key=shortcut.key,
                    name=conflict.display_name,
                    screen=dict(self.SCREEN_SELECTION).get(shortcut.screen_scope),
                ))

    @api.constrains("action", "target_product_id", "target_category_id", "target_pricelist_id",
                    "target_payment_method_id", "target_payment_code", "target_amount")
    def _check_action_target(self):
        for shortcut in self:
            if shortcut.action == "add_product" and not shortcut.target_product_id:
                raise ValidationError(_("Product shortcuts require a product."))
            if shortcut.action == "select_category" and not shortcut.target_category_id:
                raise ValidationError(_("Category shortcuts require a POS category."))
            if shortcut.action == "select_pricelist" and not shortcut.target_pricelist_id:
                raise ValidationError(_("Pricelist shortcuts require a pricelist."))
            if shortcut.action == "payment_method" and not (
                    shortcut.target_payment_method_id or shortcut.target_payment_code):
                raise ValidationError(_("Payment method shortcuts require a payment method or payment code."))
            if shortcut.action == "payment_amount" and shortcut.target_amount <= 0:
                raise ValidationError(_("Payment amount shortcuts require an amount greater than zero."))

    @api.model
    def _load_pos_data_domain(self, data, config):
        if not self.env.user.has_group("point_of_sale.group_pos_user"):
            return False
        return [
            ("active", "=", True),
            "|",
            ("config_id", "=", False),
            ("config_id", "=", config.id),
        ]

    @api.model
    def _load_pos_data_fields(self, config):
        return [
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
        ]
