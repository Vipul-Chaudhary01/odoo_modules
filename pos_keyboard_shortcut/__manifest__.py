# -*- coding: utf-8 -*-

{
    # Module Info
    "name": "POS Keyboard Shortcuts",
    "version": "19.0.1.0.0",
    "category": "Point of Sale",
    "summary": "Enterprise keyboard shortcut manager for Odoo POS.",
    "description": """
        Configure global or POS-specific keyboard shortcuts for product, payment,
        receipt, customer, order, and global POS workflows.
    """,

    # Author
    'author': 'Vipul Chaudhary',
    'website': '',

    # Dependencies
    "depends": ["point_of_sale"],

    # Data Files
    "data": [
        "security/ir.model.access.csv",
        "data/pos_shortcut_data.xml",
        "views/pos_shortcut_views.xml",
        "views/pos_config_views.xml",
    ],

    # Assets
    "assets": {
        "point_of_sale._assets_pos": [
            "pos_keyboard_shortcut/static/src/js/shortcut_dialog.js",
            "pos_keyboard_shortcut/static/src/js/shortcut_service.js",
            "pos_keyboard_shortcut/static/src/js/navbar_shortcut_button.js",
            "pos_keyboard_shortcut/static/src/xml/shortcut_dialog.xml",
            "pos_keyboard_shortcut/static/src/xml/navbar_shortcut_button.xml",
            "pos_keyboard_shortcut/static/src/scss/shortcut.scss",
        ],
    },

    # Technical Info
    "license": "LGPL-3",
    "installable": True,
    "auto_install": False,
    "application": False,
}
