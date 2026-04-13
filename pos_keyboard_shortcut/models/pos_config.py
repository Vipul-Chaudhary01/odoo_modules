# -*- coding: utf-8 -*-

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = "pos.config"

    keyboard_shortcut_enabled = fields.Boolean(string="Keyboard Shortcuts", default=False)

    def _load_pos_data_fields(self, config):
        fields_to_load = super()._load_pos_data_fields(config)
        if not fields_to_load:
            return fields_to_load
        return list(dict.fromkeys(fields_to_load + [
            "keyboard_shortcut_enabled",
        ]))
