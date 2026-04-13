# -*- coding: utf-8 -*-

from odoo import models


class PosSession(models.Model):
    _inherit = "pos.session"

    def _load_pos_data_models(self, config):
        models_to_load = super()._load_pos_data_models(config)
        if "pos.keyboard.shortcut" not in models_to_load:
            models_to_load.append("pos.keyboard.shortcut")
        return models_to_load
