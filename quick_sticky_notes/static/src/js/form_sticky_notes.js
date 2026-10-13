/** @odoo-module **/

import {deserializeDateTime, formatDateTime} from "@web/core/l10n/dates";
import {_t} from "@web/core/l10n/translation";
import {user} from "@web/core/user";
import {patch} from "@web/core/utils/patch";
import {useService} from "@web/core/utils/hooks";
import {FormController} from "@web/views/form/form_controller";
import {onMounted, onPatched, onWillUnmount, useExternalListener} from "@odoo/owl";

const COLORS = ["yellow", "green", "blue", "pink", "purple", "orange"];

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        this.quickStickyOrm = useService("orm");
        this.quickStickyNotes = [];
        this.quickStickyIcon = null;
        this.quickStickyPanel = null;
        this.quickStickyRecordKey = null;
        this.quickStickySelectedId = false;
        this.quickStickySaveTimer = null;
        this.quickStickyGroupPromise = user.hasGroup(
            "quick_sticky_notes.group_quick_sticky_note_user"
        );

        const init = () => this.initQuickStickyNotes();
        onMounted(init);
        onPatched(init);
        useExternalListener(window, "quick_sticky_notes:close_record_panel", () =>
            this.closeQuickStickyPanel()
        );
        onWillUnmount(() => this.cleanupQuickStickyNotes());
    },

    getQuickRecordInfo() {
        const record = this.model.root;
        return {
            resModel: this.props.resModel || record?.resModel || this.model.config?.resModel,
            resId: Number(record?.resId || this.props.resId || this.model.config?.resId || 0),
        };
    },

    async initQuickStickyNotes() {
        if (!(await this.quickStickyGroupPromise)) {
            this.cleanupQuickStickyNotes();
            return;
        }
        const recordInfo = this.getQuickRecordInfo();
        const root = this.rootRef?.el?.querySelector(".o_form_view_container") || this.rootRef?.el;
        if (!root || !recordInfo.resId || !recordInfo.resModel) {
            this.cleanupQuickStickyNotes();
            return;
        }

        const recordKey = `${recordInfo.resModel}:${recordInfo.resId}`;
        if (this.quickStickyRecordKey && this.quickStickyRecordKey !== recordKey) {
            this.cleanupQuickStickyNotes();
        }
        if (this.quickStickyIcon) {
            return;
        }

        this.quickStickyRecordKey = recordKey;
        const icon = document.createElement("button");
        icon.type = "button";
        icon.className = "o_quick_form_sticky_icon";
        icon.title = _t("Record Notes");
        icon.innerHTML = '<i class="fa fa-sticky-note-o"></i>';
        icon.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            await this.toggleQuickStickyPanel();
        });
        root.appendChild(icon);
        this.quickStickyIcon = icon;

        await this.loadQuickRecordNotes();
        this.updateQuickStickyBadge();
    },

    async loadQuickRecordNotes() {
        const recordInfo = this.getQuickRecordInfo();
        if (!recordInfo.resId || !recordInfo.resModel) {
            this.quickStickyNotes = [];
            this.quickStickySelectedId = false;
            return;
        }
        this.quickStickyNotes = await this.quickStickyOrm.call(
            "quick.sticky.note",
            "get_record_notes",
            [recordInfo.resModel, recordInfo.resId]
        );
        if (!this.quickStickyNotes.some((note) => note.id === this.quickStickySelectedId)) {
            this.quickStickySelectedId = this.quickStickyNotes[0]?.id || false;
        }
    },

    getQuickSelectedRecordNote() {
        return this.quickStickyNotes.find((note) => note.id === this.quickStickySelectedId);
    },

    getQuickNoteCreator(note) {
        if (Array.isArray(note?.create_uid)) {
            return note.create_uid[1];
        }
        return _t("Unknown");
    },

    getQuickNoteCreatedDate(note) {
        if (!note?.create_date) {
            return "";
        }
        return formatDateTime(deserializeDateTime(note.create_date));
    },

    updateQuickStickyBadge() {
        if (!this.quickStickyIcon) {
            return;
        }
        this.quickStickyIcon.querySelector(".o_quick_form_sticky_badge")?.remove();
        if (this.quickStickyNotes.length) {
            const badge = document.createElement("span");
            badge.className = "o_quick_form_sticky_badge";
            badge.textContent = this.quickStickyNotes.length;
            this.quickStickyIcon.appendChild(badge);
        }
    },

    async toggleQuickStickyPanel() {
        if (this.quickStickyPanel?.isConnected) {
            this.closeQuickStickyPanel();
            return;
        }
        window.dispatchEvent(new Event("quick_sticky_notes:close_systray"));
        if (!this.quickStickyNotes.length) {
            await this.createQuickRecordNote();
        }
        this.renderQuickStickyPanel();
    },

    renderQuickStickyPanel() {
        this.quickStickyPanel?.remove();

        const panel = document.createElement("div");
        panel.className = "o_quick_form_sticky_panel shadow-lg";
        panel.addEventListener("click", (ev) => ev.stopPropagation());

        const header = document.createElement("div");
        header.className = "o_quick_sticky_notes_header";
        header.innerHTML = `<strong>${_t("Sticky Notes")}</strong>`;

        const actions = document.createElement("div");
        actions.className = "d-flex align-items-center gap-1";

        const add = document.createElement("button");
        add.type = "button";
        add.className = "btn btn-sm btn-primary";
        add.title = _t("New Note");
        add.innerHTML = '<i class="oi oi-plus"></i>';
        add.addEventListener("click", () => this.createQuickRecordNote());
        actions.appendChild(add);

        const close = document.createElement("button");
        close.type = "button";
        close.className = "btn btn-sm btn-light";
        close.title = _t("Close");
        close.innerHTML = '<i class="oi oi-close"></i>';
        close.addEventListener("click", () => this.closeQuickStickyPanel());
        actions.appendChild(close);
        header.appendChild(actions);
        panel.appendChild(header);

        const body = document.createElement("div");
        body.className = "o_quick_sticky_notes_body";

        const list = document.createElement("aside");
        list.className = "o_quick_sticky_notes_list";
        this.renderQuickStickyList(list);
        body.appendChild(list);

        const editor = document.createElement("section");
        this.renderQuickStickyEditor(editor);
        body.appendChild(editor);

        panel.appendChild(body);
        this.quickStickyIcon.parentElement.appendChild(panel);
        this.quickStickyPanel = panel;
    },

    renderQuickStickyList(container) {
        container.innerHTML = "";
        if (!this.quickStickyNotes.length) {
            const empty = document.createElement("div");
            empty.className = "o_quick_form_sticky_empty";
            empty.textContent = _t("No notes yet");
            container.appendChild(empty);
            return;
        }

        for (const note of this.quickStickyNotes) {
            const item = document.createElement("button");
            item.type = "button";
            item.className = `o_quick_sticky_notes_list_item o_quick_sticky_notes_color_${note.color}`;
            if (note.id === this.quickStickySelectedId) {
                item.classList.add("active");
            }
            item.textContent = note.name || _t("New Note");
            item.addEventListener("click", () => {
                this.quickStickySelectedId = note.id;
                this.renderQuickStickyPanel();
            });
            container.appendChild(item);
        }
    },

    renderQuickStickyEditor(container) {
        container.innerHTML = "";
        const note = this.getQuickSelectedRecordNote();
        if (!note) {
            container.className = "o_quick_sticky_notes_editor";
            const empty = document.createElement("div");
            empty.className = "o_quick_form_sticky_empty";
            empty.textContent = _t("Create a note to start.");
            container.appendChild(empty);
            return;
        }

        container.className = `o_quick_sticky_notes_editor o_quick_sticky_notes_color_${note.color}`;

        const title = document.createElement("input");
        title.className = "form-control o_quick_sticky_notes_title";
        title.placeholder = _t("Title");
        title.value = note.name || "";
        title.addEventListener("input", (ev) => {
            this.scheduleQuickRecordNoteSave(note.id, {name: ev.target.value});
        });
        container.appendChild(title);

        const meta = document.createElement("div");
        meta.className = "o_quick_sticky_notes_meta";
        const createdDate = this.getQuickNoteCreatedDate(note);
        meta.textContent = createdDate
            ? `${_t("Created by")} ${this.getQuickNoteCreator(note)} ${_t("on")} ${createdDate}`
            : `${_t("Created by")} ${this.getQuickNoteCreator(note)}`;
        container.appendChild(meta);

        const content = document.createElement("textarea");
        content.className = "form-control o_quick_sticky_notes_content";
        content.placeholder = _t("Write a quick note...");
        content.value = note.content || "";
        content.addEventListener("input", (ev) => {
            this.scheduleQuickRecordNoteSave(note.id, {content: ev.target.value});
        });
        container.appendChild(content);

        const footer = document.createElement("div");
        footer.className = "o_quick_sticky_notes_footer";

        const palette = document.createElement("div");
        palette.className = "o_quick_sticky_notes_palette";
        for (const color of COLORS) {
            const swatch = document.createElement("button");
            swatch.type = "button";
            swatch.className = `o_quick_sticky_notes_swatch o_quick_sticky_notes_color_${color}`;
            swatch.title = color;
            if (note.color === color) {
                swatch.classList.add("active");
            }
            swatch.addEventListener("click", () => this.saveQuickRecordNote(note.id, {color}));
            palette.appendChild(swatch);
        }
        footer.appendChild(palette);

        const buttons = document.createElement("div");
        buttons.className = "d-flex align-items-center gap-2";

        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "btn btn-sm btn-light";
        pin.title = note.is_pinned ? _t("Unpin") : _t("Pin");
        pin.innerHTML = note.is_pinned
            ? '<i class="fa fa-thumb-tack"></i>'
            : '<i class="fa fa-thumb-tack text-muted"></i>';
        pin.addEventListener("click", () => this.toggleQuickRecordNotePin(note.id));
        buttons.appendChild(pin);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-sm btn-light";
        remove.title = _t("Delete Note");
        remove.innerHTML = '<i class="fa fa-trash"></i>';
        remove.addEventListener("click", () => this.deleteQuickRecordNote(note.id));
        buttons.appendChild(remove);

        footer.appendChild(buttons);
        container.appendChild(footer);
    },

    async createQuickRecordNote(name = "New Note", content = "", color = "yellow") {
        const recordInfo = this.getQuickRecordInfo();
        if (!recordInfo.resId || !recordInfo.resModel) {
            return;
        }
        const note = await this.quickStickyOrm.call("quick.sticky.note", "create_record_note", [
            recordInfo.resModel,
            recordInfo.resId,
            {name, content, color},
        ]);
        if (!note) {
            return;
        }
        this.quickStickySelectedId = note.id;
        await this.refreshQuickRecordNotes();
    },

    scheduleQuickRecordNoteSave(noteId, values) {
        const note = this.quickStickyNotes.find((item) => item.id === noteId);
        if (!note) {
            return;
        }
        Object.assign(note, values);
        clearTimeout(this.quickStickySaveTimer);
        this.quickStickySaveTimer = setTimeout(() => this.saveQuickRecordNote(noteId), 500);
    },

    async saveQuickRecordNote(noteId, values = {}) {
        const note = this.quickStickyNotes.find((item) => item.id === noteId);
        if (!note) {
            return;
        }
        Object.assign(note, values);
        await this.quickStickyOrm.call("quick.sticky.note", "save_quick_note", [
            note.id,
            {
                name: note.name || _t("New Note"),
                content: note.content || "",
                color: note.color || "yellow",
            },
        ]);
        if (values.color) {
            await this.refreshQuickRecordNotes();
        }
    },

    async toggleQuickRecordNotePin(noteId) {
        await this.quickStickyOrm.call("quick.sticky.note", "toggle_pin", [noteId]);
        await this.refreshQuickRecordNotes();
    },

    async deleteQuickRecordNote(noteId) {
        await this.quickStickyOrm.call("quick.sticky.note", "delete_quick_note", [noteId]);
        if (this.quickStickySelectedId === noteId) {
            this.quickStickySelectedId = false;
        }
        await this.refreshQuickRecordNotes();
    },

    async refreshQuickRecordNotes() {
        await this.loadQuickRecordNotes();
        this.updateQuickStickyBadge();
        if (this.quickStickyPanel?.isConnected) {
            this.renderQuickStickyPanel();
        }
    },

    closeQuickStickyPanel() {
        this.quickStickyPanel?.remove();
        this.quickStickyPanel = null;
    },

    cleanupQuickStickyNotes() {
        clearTimeout(this.quickStickySaveTimer);
        this.closeQuickStickyPanel();
        this.quickStickyIcon?.remove();
        this.quickStickyIcon = null;
        this.quickStickyRecordKey = null;
        this.quickStickySelectedId = false;
    },
});
