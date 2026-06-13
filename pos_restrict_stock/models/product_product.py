# -*- coding: utf-8 -*-

from odoo import fields, models


class ProductProduct(models.Model):
    _inherit = "product.product"

    pos_qty_on_hand = fields.Float(string="POS Qty on Hand", compute="_compute_pos_stock")
    pos_virtual_qty = fields.Float(string="POS Forecasted Qty", compute="_compute_pos_stock")
    pos_available_qty = fields.Float(string="POS Available Qty", compute="_compute_pos_stock")
    pos_stock_state = fields.Selection(
        [
            ("available", "Available"),
            ("out", "Out of Stock"),
            ("untracked", "Not Tracked"),
        ],
        string="POS Stock State",
        compute="_compute_pos_stock",
    )
    pos_stock_location_name = fields.Char(
        string="POS Stock Location",
        compute="_compute_pos_stock",
    )

    def _compute_pos_stock(self):
        for product in self:
            product.pos_qty_on_hand = product.qty_available
            product.pos_virtual_qty = product.virtual_available
            product.pos_available_qty = product.virtual_available
            product.pos_stock_state = "untracked" if not product.is_storable else "available"
            product.pos_stock_location_name = False

    def _load_pos_data_fields(self, config):
        fields_to_load = super()._load_pos_data_fields(config)
        if not (config.display_stock or config.restrict_out_of_stock or config.hide_out_of_stock_products):
            return fields_to_load
        return list(dict.fromkeys(fields_to_load + [
            "is_storable",
            "uom_id",
            "pos_qty_on_hand",
            "pos_virtual_qty",
            "pos_available_qty",
            "pos_stock_state",
            "pos_stock_location_name",
        ]))

    def _load_pos_data_read(self, records, config):
        read_data = super()._load_pos_data_read(records, config)
        if not (config.display_stock or config.restrict_out_of_stock or config.hide_out_of_stock_products):
            return read_data

        stock_by_product = config._build_stock_payload(records)
        for values in read_data:
            values.update(stock_by_product.get(values["id"], {}))
        return read_data
