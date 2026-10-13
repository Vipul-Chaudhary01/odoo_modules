# -*- coding: utf-8 -*-

{
    "name": "Quick Sticky Notes",
    "version": "19.0.1.0.0",
    "category": "Productivity",
    "summary": "Create and manage personal and record-specific sticky notes.",
    "description": """
        Quick Sticky Notes adds a fast sticky notes panel to the Odoo backend.
        Users can create, edit, color-code, and delete personal notes from the systray,
        and manage record-specific notes directly from form views.
    """,

    # Author
    'author': 'Vipul Chaudhary',
    'website': '',

    # Dependencies
    "depends": ["base", "web", "mail"],

    # Data Files
    "data": [
        "security/quick_sticky_note_security.xml",
        "security/ir.model.access.csv",
        "views/quick_sticky_note_views.xml",
    ],

    # Assets
    "assets": {
        "web.assets_backend": [
            "quick_sticky_notes/static/src/js/quick_sticky_notes.js",
            "quick_sticky_notes/static/src/js/form_sticky_notes.js",
            "quick_sticky_notes/static/src/xml/quick_sticky_notes.xml",
            "quick_sticky_notes/static/src/scss/quick_sticky_notes.scss",
        ],
    },

    # Technical Info
    "license": "LGPL-3",
    "installable": True,
    "auto_install": False,
    "application": False,
}
