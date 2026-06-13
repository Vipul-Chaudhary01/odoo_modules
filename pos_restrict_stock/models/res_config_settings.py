# -*- coding: utf-8 -*-

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    pos_display_stock = fields.Boolean(related="pos_config_id.display_stock", readonly=False)
    pos_restrict_out_of_stock = fields.Boolean(related="pos_config_id.restrict_out_of_stock", readonly=False)
    pos_stock_type = fields.Selection(related="pos_config_id.stock_type", readonly=False)
    pos_stock_threshold = fields.Float(related="pos_config_id.stock_threshold", readonly=False)
    pos_hide_out_of_stock_products = fields.Boolean(related="pos_config_id.hide_out_of_stock_products",
                                                       readonly=False)
    pos_allow_manager_override = fields.Boolean(related="pos_config_id.allow_manager_override", readonly=False)
    pos_out_of_stock_message = fields.Text(related="pos_config_id.out_of_stock_message", readonly=False)
