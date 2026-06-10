"use client";
import { useState, useRef } from "react";
import { MessageSquare, Pencil, Check, X } from "lucide-react";

interface Props {
  id: string;
  nota: string | null;
  onSaved?: (nota: string | null) => void;
}

export function NoteCell({ id, nota: initialNota, onSaved }: Props) {
  const [nota, setNota] = useState(initialNota);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    setDraft(nota ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function save() {
    setSaving(true);
    const newNota = draft.trim() || null;
    await fetch("/api/admin/nota-row", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, nota: newNota }),
    });
    setNota(newNota);
    setEditing(false);
    setSaving(false);
    onSaved?.(newNota);
  }

  function cancel() {
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-start gap-1 min-w-[180px]">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === "Escape") cancel(); }}
          rows={2}
          className="flex-1 text-xs border border-brand rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-brand"
          placeholder="Agregar comentario…"
        />
        <div className="flex flex-col gap-1">
          <button onClick={save} disabled={saving} className="p-1 rounded hover:bg-green-100 text-green-600">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={cancel} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (nota) {
    return (
      <div className="group flex items-start gap-1 max-w-[220px]">
        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 leading-snug">{nota}</span>
        <button onClick={startEdit} className="opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 p-0.5 rounded hover:bg-gray-100 text-gray-400">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button onClick={startEdit} title="Agregar comentario"
      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500">
      <MessageSquare className="w-3.5 h-3.5" />
    </button>
  );
}
