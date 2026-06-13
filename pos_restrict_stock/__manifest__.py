# -*- coding: utf-8 -*-

{
    # Module Info
    "name": "POS Restrict Out of Stock",
    "version": "19.0.1.0.1",
    "category": "Point of Sale",
    "summary": "Display POS stock and restrict out-of-stock product sales.",
    "description": """
        Show on-hand or forecasted stock inside Odoo POS, block unavailable products,
        optionally hide depleted items, and support manager override workflows.
    """,

    # Author
    'author': 'Vipul Chaudhary',
    'website': '',

    # Dependencies
    "depends": ["point_of_sale", "stock"],

    # Data Files
    "data": [
        "security/pos_restrict_stock_security.xml",
        "views/pos_config_views.xml",
        "views/res_config_settings_views.xml",
    ],

    # Assets
    "assets": {
        "point_of_sale._assets_pos": [
            "pos_restrict_stock/static/src/js/stock_utils.js",
            "pos_restrict_stock/static/src/js/data_service.js",
            "pos_restrict_stock/static/src/js/stock_warning_dialog.js",
            "pos_restrict_stock/static/src/js/pos_store.js",
            "pos_restrict_stock/static/src/js/product_screen.js",
            "pos_restrict_stock/static/src/js/product_card.js",
            "pos_restrict_stock/static/src/xml/stock_warning_dialog.xml",
            "pos_restrict_stock/static/src/xml/product_card.xml",
            "pos_restrict_stock/static/src/scss/pos_restrict_stock.scss",
        ],
    },


    # Technical Info
    "license": "LGPL-3",
    "installable": True,
    "auto_install": False,
    "application": False,
}
