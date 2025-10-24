{
    "name": "OPM Dev Helper",
    "version": "19.0.1.0.0",
    "summary": "Hot-reload for faster Odoo development (requires Odoo Plugin Manager CLI).",
    "description": """
    # OPM Dev Helper

    ⚠️ Requires [Odoo Plugin Manager (CLI)](https://github.com/ahmetatakan/odoo-plugin-manager)

    Adds developer utilities for faster Odoo development:
    - Hot reload support
    - View/QWeb cache flush
    - Quick module install/upgrade hooks
    """,
    "author": "Ahmet Atakan",
    "maintainers": ["ahmetatakan.tech@gmail.com"],
    "website": "https://github.com/ahmetatakan/odoo-plugin-manager",
    "category": "Tools",
   "depends": ["base", "web"],
    "data": [],
    "installable": True,
    "license": "LGPL-3",
    'assets': {
    'web.assets_backend': [
            'opm_dev_helper/static/src/js/opm_live.js',
        ],
    },
    "images": [
        "static/description/banner.png",
        "static/description/icon.png",
    ],
}