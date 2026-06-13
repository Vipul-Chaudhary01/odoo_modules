# -*- coding: utf-8 -*-

from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

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
        for template in self:
            variants = template.product_variant_ids
            template.pos_qty_on_hand = sum(variants.mapped("qty_available"))
            template.pos_virtual_qty = sum(variants.mapped("virtual_available"))
            template.pos_available_qty = template.pos_virtual_qty
            template.pos_stock_state = "untracked" if not template.is_storable else "available"
            template.pos_stock_location_name = False

    def _load_pos_data_fields(self, config):
        fields_to_load = super()._load_pos_data_fields(config)
        if not (config.display_stock or config.restrict_out_of_stock or config.hide_out_of_stock_products):
            return fields_to_load
        return list(dict.fromkeys(fields_to_load + [
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

        stock_by_product = config._build_stock_payload(records.product_variant_ids)
        for values in read_data:
            template = records.browse(values["id"])
            variant_payloads = [
                stock_by_product[variant.id]
                for variant in template.product_variant_ids
                if variant.id in stock_by_product
            ]
            if not variant_payloads:
                continue

            values["pos_qty_on_hand"] = sum(payload["pos_qty_on_hand"] for payload in variant_payloads)
            values["pos_virtual_qty"] = sum(payload["pos_virtual_qty"] for payload in variant_payloads)
            values["pos_available_qty"] = sum(payload["pos_available_qty"] for payload in variant_payloads)
            values["pos_stock_location_name"] = variant_payloads[0]["pos_stock_location_name"]

            if not template.is_storable:
                values["pos_stock_state"] = "untracked"
            elif values["pos_available_qty"] <= config.stock_threshold:
                values["pos_stock_state"] = "out"
            else:
                values["pos_stock_state"] = "available"
        return read_data
