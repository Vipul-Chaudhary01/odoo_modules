# -*- coding: utf-8 -*-

from odoo import api, fields, models


QUICK_NOTE_FIELDS = [
    "name",
    "content",
    "color",
    "sequence",
    "res_model",
    "res_id",
    "is_pinned",
    "create_uid",
    "create_date",
    "write_date",
]

RECORD_NOTE_FIELDS = [
    "name",
    "content",
    "color",
    "is_pinned",
    "create_uid",
    "create_date",
    "write_date",
]


class QuickStickyNote(models.Model):
    _name = "quick.sticky.note"
    _description = "Quick Sticky Note"
    _order = "is_pinned desc, sequence, write_date desc, id desc"

    name = fields.Char(required=True, default="New Note")
    content = fields.Text()
    color = fields.Selection(
        [
            ("yellow", "Yellow"),
            ("green", "Green"),
            ("blue", "Blue"),
            ("pink", "Pink"),
            ("purple", "Purple"),
            ("orange", "Orange"),
            ("white", "White"),
        ],
        default="yellow",
        required=True,
    )
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    user_id = fields.Many2one(
        "res.users",
        string="Owner",
        required=True,
        default=lambda self: self.env.user,
        index=True,
        ondelete="cascade",
    )
    res_model = fields.Char(string="Related Model", index=True)
    res_id = fields.Integer(string="Related Record ID", default=0, index=True)
    is_pinned = fields.Boolean(string="Pinned", default=False)
    note_scope = fields.Char(string="Type", compute="_compute_note_scope")
    related_record = fields.Char(string="Related Record", compute="_compute_related_record")

    @api.depends("res_model", "res_id")
    def _compute_note_scope(self):
        for note in self:
            note.note_scope = "Record Note" if note.res_model and note.res_id else "Personal Note"

    @api.depends("res_model", "res_id")
    def _compute_related_record(self):
        for note in self:
            if not note.res_model or not note.res_id:
                note.related_record = "Personal"
                continue
            model_name = note.res_model
            model = self.env["ir.model"].sudo().search([("model", "=", note.res_model)], limit=1)
            if model:
                model_name = model.name
            record_name = "#%s" % note.res_id
            try:
                record = self.env[note.res_model].browse(note.res_id).exists()
                if record:
                    record_name = record.display_name
            except Exception:
                pass
            note.related_record = "%s: %s" % (model_name, record_name)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            vals.setdefault("user_id", self.env.user.id)
            vals["name"] = vals.get("name") or "New Note"
        return super().create(vals_list)

    @api.model
    def get_quick_notes(self):
        """Return all notes for the current user's navbar panel."""
        return self.search_read(
            [
                ("user_id", "=", self.env.user.id),
                ("active", "=", True),
            ],
            QUICK_NOTE_FIELDS,
            order=self._order,
        )

    @api.model
    def create_quick_note(self):
        note = self.create({"name": "New Note", "content": "", "color": "yellow"})
        return note.read(QUICK_NOTE_FIELDS)[0]

    @api.model
    def save_quick_note(self, note_id, values):
        allowed_values = {
            key: values[key]
            for key in ("name", "content", "color", "sequence")
            if key in values
        }
        note = self.search([("id", "=", note_id), ("user_id", "=", self.env.user.id)], limit=1)
        if note and allowed_values:
            note.write(allowed_values)
        return (
            note.read(QUICK_NOTE_FIELDS)[0]
            if note
            else False
        )

    @api.model
    def delete_quick_note(self, note_id):
        note = self.search([("id", "=", note_id), ("user_id", "=", self.env.user.id)], limit=1)
        if note:
            note.unlink()
        return True

    @api.model
    def get_record_notes(self, res_model, res_id):
        return self.search_read(
            [
                ("user_id", "=", self.env.user.id),
                ("active", "=", True),
                ("res_model", "=", res_model),
                ("res_id", "=", res_id),
            ],
            RECORD_NOTE_FIELDS,
            order=self._order,
        )

    @api.model
    def create_record_note(self, res_model, res_id, values):
        note = self.create(
            {
                "name": values.get("name") or "New Note",
                "content": values.get("content") or "",
                "color": values.get("color") or "yellow",
                "res_model": res_model,
                "res_id": res_id,
            }
        )
        return note.read(RECORD_NOTE_FIELDS)[0]

    @api.model
    def toggle_pin(self, note_id):
        note = self.search([("id", "=", note_id), ("user_id", "=", self.env.user.id)], limit=1)
        if note:
            note.is_pinned = not note.is_pinned
        return True
