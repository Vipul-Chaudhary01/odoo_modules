/** @odoo-module **/

import {deserializeDateTime, formatDateTime} from "@web/core/l10n/dates";
import {_t} from "@web/core/l10n/translation";
import {registry} from "@web/core/registry";
import {user} from "@web/core/user";
import {useService} from "@web/core/utils/hooks";
import {
    Component,
    onWillStart,
    onWillUnmount,
    useExternalListener,
    useRef,
    useState,
} from "@odoo/owl";

const COLORS = ["yellow", "green", "blue", "pink", "purple", "orange", "white"];

export class QuickStickyNotes extends Component {
    static template = "quick_sticky_notes.QuickStickyNotes";
    static props = {};

    setup() {
        this.action = useService("action");
        this.orm = useService("orm");
        this.textareaRef = useRef("textarea");
        this.saveTimer = null;
        this.state = useState({
            canUseStickyNotes: false,
            isOpen: false,
            isSaving: false,
            notes: [],
            search: "",
            selectedId: false,
        });

        onWillStart(async () => {
            this.state.canUseStickyNotes = await user.hasGroup(
                "quick_sticky_notes.group_quick_sticky_note_user"
            );
            if (this.state.canUseStickyNotes) {
                await this.loadNotes();
            }
        });

        useExternalListener(window, "click", () => {
            this.state.isOpen = false;
        });
        useExternalListener(window, "quick_sticky_notes:close_systray", () => {
            this.state.isOpen = false;
        });

        onWillUnmount(() => {
            clearTimeout(this.saveTimer);
        });
    }

    get selectedNote() {
        return this.state.notes.find((note) => note.id === this.state.selectedId);
    }

    get filteredNotes() {
        const search = this.state.search.trim().toLowerCase();
        if (!search) {
            return this.state.notes;
        }
        return this.state.notes.filter((note) => {
            const reference = this.getNoteReference(note).toLowerCase();
            return [note.name, note.content, reference].some((value) =>
                (value || "").toLowerCase().includes(search)
            );
        });
    }

    get colorOptions() {
        return COLORS;
    }

    async loadNotes() {
        if (!this.state.canUseStickyNotes) {
            return;
        }
        const selectedId = this.state.selectedId;
        this.state.notes = await this.orm.call("quick.sticky.note", "get_quick_notes", []);
        this.state.selectedId = this.state.notes.some((note) => note.id === selectedId)
            ? selectedId
            : this.state.notes[0]?.id || false;
    }

    async togglePanel(ev) {
        ev.stopPropagation();
        if (!this.state.canUseStickyNotes) {
            return;
        }
        this.state.isOpen = !this.state.isOpen;
        if (this.state.isOpen) {
            window.dispatchEvent(new Event("quick_sticky_notes:close_record_panel"));
            await this.loadNotes();
            if (!this.state.notes.length) {
                await this.addNote();
            }
        }
        this.focusEditor();
    }

    keepOpen(ev) {
        ev.stopPropagation();
    }

    focusEditor() {
        setTimeout(() => this.textareaRef.el?.focus(), 0);
    }

    selectNote(note) {
        this.state.selectedId = note.id;
        this.focusEditor();
    }

    async addNote() {
        const note = await this.orm.call("quick.sticky.note", "create_quick_note", []);
        this.state.notes.unshift(note);
        this.state.search = "";
        this.state.selectedId = note.id;
        this.focusEditor();
    }

    async saveNote(noteId = this.state.selectedId, values = {}) {
        const note = this.state.notes.find((item) => item.id === noteId);
        if (!note) {
            return;
        }
        Object.assign(note, values);
        this.state.isSaving = true;
        try {
            const savedNote = await this.orm.call("quick.sticky.note", "save_quick_note", [
                note.id,
                {
                    name: note.name || _t("New Note"),
                    content: note.content || "",
                    color: note.color || "yellow",
                },
            ]);
            Object.assign(note, savedNote);
        } finally {
            this.state.isSaving = false;
        }
    }

    scheduleSave(values) {
        const note = this.selectedNote;
        if (!note) {
            return;
        }
        Object.assign(note, values);
        const noteId = note.id;
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.saveNote(noteId), 500);
    }

    async deleteNote() {
        const note = this.selectedNote;
        if (!note) {
            return;
        }
        await this.orm.call("quick.sticky.note", "delete_quick_note", [note.id]);
        this.state.notes = this.state.notes.filter((item) => item.id !== note.id);
        this.state.selectedId = this.state.notes[0]?.id || false;
        if (!this.state.notes.length) {
            await this.addNote();
        }
    }

    getNoteReference(note) {
        if (!note?.res_model || !note?.res_id) {
            return _t("Personal");
        }
        return `${note.res_model} #${note.res_id}`;
    }

    getNoteCreator(note) {
        if (Array.isArray(note?.create_uid)) {
            return note.create_uid[1];
        }
        if (Array.isArray(note?.user_id)) {
            return note.user_id[1];
        }
        return _t("Unknown");
    }

    getNoteCreatedDate(note) {
        if (!note?.create_date) {
            return "";
        }
        return formatDateTime(deserializeDateTime(note.create_date));
    }

    async openLinkedRecord() {
        const note = this.selectedNote;
        if (!note?.res_model || !note?.res_id) {
            return;
        }
        this.state.isOpen = false;
        await this.action.doAction({
            type: "ir.actions.act_window",
            res_model: note.res_model,
            res_id: note.res_id,
            views: [[false, "form"]],
            target: "current",
        });
    }

    async openAllNotes() {
        this.state.isOpen = false;
        await this.action.doAction("quick_sticky_notes.quick_sticky_note_action");
    }

    onTitleInput(ev) {
        this.scheduleSave({name: ev.target.value});
    }

    onContentInput(ev) {
        this.scheduleSave({content: ev.target.value});
    }

    onColorClick(color) {
        this.saveNote(this.state.selectedId, {color});
    }

    onSearchInput(ev) {
        this.state.search = ev.target.value;
        if (!this.filteredNotes.some((note) => note.id === this.state.selectedId)) {
            this.state.selectedId = this.filteredNotes[0]?.id || false;
        }
    }
}

registry.category("systray").add(
    "quick_sticky_notes.quick_sticky_notes",
    {Component: QuickStickyNotes},
    {sequence: 45}
);
