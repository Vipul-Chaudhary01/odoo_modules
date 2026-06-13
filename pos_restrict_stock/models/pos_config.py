# -*- coding: utf-8 -*-

from odoo import _, api, fields, models


STOCK_CACHE_VERSION = "19.0.1.0.1"


class PosConfig(models.Model):
    _inherit = "pos.config"

    display_stock = fields.Boolean(
        string="Display Stock in POS",
        default=True,
        help="Show stock badges on POS product tiles.",
    )
    restrict_out_of_stock = fields.Boolean(
        string="Restrict Out of Stock Products",
        default=True,
        help="Block products when the selected POS stock quantity is not available.",
    )
    stock_type = fields.Selection(
        [
            ("qty_available", "Qty on Hand"),
            ("virtual_available", "Forecasted Qty"),
            ("both", "Both"),
        ],
        string="Stock Type",
        default="virtual_available",
        required=True,
        help="Quantity used by the POS stock badge and restriction checks.",
    )
    stock_threshold = fields.Float(
        string="Minimum Sale Quantity",
        default=0.0,
        help="Products at or below this quantity are treated as unavailable.",
    )
    hide_out_of_stock_products = fields.Boolean(
        string="Hide Out of Stock Products",
        help="Remove unavailable products from the POS grid while keeping barcode blocking active.",
    )
    allow_manager_override = fields.Boolean(
        string="Allow Manager Override",
        help="Let a POS manager continue after an out-of-stock warning.",
    )
    out_of_stock_message = fields.Text(
        string="Out of Stock Message",
        default="This product is currently out of stock in the selected POS location.",
        translate=True,
    )

    @api.depends(
        "display_stock",
        "restrict_out_of_stock",
        "stock_type",
        "stock_threshold",
        "hide_out_of_stock_products",
    )
    def _compute_local_data_integrity(self):
        super()._compute_local_data_integrity()

    def _load_pos_data_fields(self, config):
        fields_to_load = super()._load_pos_data_fields(config)
        if not fields_to_load:
            return fields_to_load
        return list(dict.fromkeys(fields_to_load + [
            "display_stock",
            "restrict_out_of_stock",
            "stock_type",
            "stock_threshold",
            "hide_out_of_stock_products",
            "allow_manager_override",
            "out_of_stock_message",
        ]))

    def _load_pos_data_read(self, records, config):
        read_data = super()._load_pos_data_read(records, config)
        for values in read_data:
            values["_pos_restrict_stock_cache_version"] = STOCK_CACHE_VERSION
        return read_data

    def _pos_stock_location(self):
        self.ensure_one()
        return (
                self.picking_type_id.default_location_src_id
                or self.warehouse_id.lot_stock_id
                or self.env["stock.location"]
        )

    def _pos_stock_context(self):
        self.ensure_one()
        context = {
            "company_id": self.company_id.id,
            "allowed_company_ids": self.company_id.ids,
        }
        location = self._pos_stock_location()
        if location:
            context["location"] = location.id
        elif self.warehouse_id:
            context["warehouse"] = self.warehouse_id.id
        return context

    def _selected_stock_qty(self, stock_values):
        self.ensure_one()
        qty_on_hand = stock_values.get("qty_available", 0.0)
        forecasted = stock_values.get("virtual_available", 0.0)
        if self.stock_type == "qty_available":
            return qty_on_hand
        if self.stock_type == "both":
            return min(qty_on_hand, forecasted)
        return forecasted

    def _build_stock_payload(self, products):
        self.ensure_one()
        products = products.exists()
        stock_payload = {}
        if not products:
            return stock_payload

        products_by_id = {
            product.id: product
            for product in products.with_context(**self._pos_stock_context())
        }
        location = self._pos_stock_location()
        location_name = location.display_name if location else _("All Stock Locations")
        for product in products:
            scoped_product = products_by_id[product.id]
            if not product.is_storable:
                values = {
                    "qty_available": 0.0,
                    "virtual_available": 0.0,
                }
                sale_qty = 0.0
                stock_state = "untracked"
            else:
                values = {
                    "qty_available": scoped_product.qty_available,
                    "virtual_available": scoped_product.virtual_available,
                }
                sale_qty = self._selected_stock_qty(values)
                if sale_qty <= self.stock_threshold:
                    stock_state = "out"
                else:
                    stock_state = "available"

            stock_payload[product.id] = {
                "pos_qty_on_hand": values["qty_available"],
                "pos_virtual_qty": values["virtual_available"],
                "pos_available_qty": sale_qty,
                "pos_stock_state": stock_state,
                "pos_stock_location_name": location_name,
            }
        return stock_payload
