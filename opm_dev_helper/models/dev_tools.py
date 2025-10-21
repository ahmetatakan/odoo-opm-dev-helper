# addons/opm_dev_helper/models/dev_tools.py
from odoo import api, models

class DevTools(models.AbstractModel):
    _name = "opm.dev.tools"
    _description = "Dev tools for OPM"

    @api.model
    def flush_caches(self):
        """Best-effort cache flush for multiple Odoo versions (14→17+)."""
        # 1) Views/QWeb caches (method adları sürüme göre değişebiliyor)
        View = self.env['ir.ui.view']
        for meth in ("clear_caches", "_clear_caches", "_clear_cache"):
            fn = getattr(View, meth, None)
            if fn:
                try:
                    fn()            # bound method ise
                except TypeError:
                    fn(View)        # classmethod/old-style ise
                break  # birini başarıyla bulduk → devam

        # 2) HTTP yönlendirme / route cache
        Http = self.env.get('ir.http')
        if Http:
            fn = getattr(Http, "clear_caches", None)
            if fn:
                try:
                    fn()
                except TypeError:
                    fn(Http)

        # 3) QWeb derlenmiş template cache (bazı sürümlerde mevcut)
        QWeb = self.env.get('ir.qweb')
        if QWeb:
            for meth in ("clear_caches", "_clear_caches"):
                fn = getattr(QWeb, meth, None)
                if fn:
                    try:
                        fn()
                    except TypeError:
                        fn(QWeb)
                    break

        # 4) ORM/env invalidation – güvenli tazeleme
        try:
            self.env.invalidate_all()
        except Exception:
            pass

        return {"status": "ok"}

    @api.model
    def quick_upgrade(self, module_name):
        mm = self.env['ir.module.module'].sudo()
        m = mm.search([('name', '=', module_name)], limit=1)
        if not m:
            return {"status": "error", "msg": f"module not found: {module_name}"}
        m.button_immediate_upgrade()
        return {"status": "ok", "module": module_name}