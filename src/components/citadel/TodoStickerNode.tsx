"use client";

import { useEffect, useRef, useState } from "react";
import { type NodeProps, NodeResizer } from "reactflow";
import { X, Pencil, Check, Plus, Trash2, CheckSquare, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCitadel } from "@/lib/store";

export type TodoNodeData = {
  kind: "todo";
  stickerId: string;
  title?: string;
  items: Array<{ id: string; text: string; done: boolean; resolvedAt?: string }>;
  width?: number;
  height?: number;
};

export function TodoStickerNode({ data }: NodeProps<TodoNodeData>) {
  const updateSticker = useCitadel((s) => s.updateSticker);
  const removeSticker = useCitadel((s) => s.removeSticker);
  const addTodoItem = useCitadel((s) => s.addTodoItem);
  const toggleTodoItem = useCitadel((s) => s.toggleTodoItem);
  const removeTodoItem = useCitadel((s) => s.removeTodoItem);
  const updateTodoItem = useCitadel((s) => s.updateTodoItem);
  const archiveTodoPanel = useCitadel((s) => s.archiveTodoPanel);

  const [editing, setEditing] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [titleDraft, setTitleDraft] = useState(data.title ?? "");
  const newItemRef = useRef<HTMLInputElement>(null);

  useEffect(() => setTitleDraft(data.title ?? ""), [data.title]);

  const open = data.items.filter((i) => !i.done);
  const done = data.items.filter((i) => i.done);

  const submitNew = () => {
    const t = newItem.trim();
    if (!t) return;
    addTodoItem(data.stickerId, t);
    setNewItem("");
    // Keep the input focused so the user can add a few in a row.
    newItemRef.current?.focus();
  };

  return (
    <>
      <NodeResizer
        isVisible={editing}
        minWidth={220}
        minHeight={140}
        color="rgb(var(--accent-rgb))"
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
        lineStyle={{ borderColor: "rgb(var(--accent-rgb) / 0.4)" }}
        onResize={(_e, params) =>
          updateSticker(data.stickerId, {
            width: params.width,
            height: params.height,
          })
        }
      />

      <div
        onDoubleClick={() => setEditing(true)}
        style={{ width: data.width, height: data.height }}
        className={cn(
          "group relative flex h-full w-full min-w-[220px] flex-col overflow-hidden rounded-xl border bg-ink-100/90 shadow-glow-sm backdrop-blur-sm transition-colors",
          editing ? "border-accent/60" : "border-white/[0.08] hover:border-white/[0.18]"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-white/[0.05] px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <CheckSquare className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.7} />
            {editing ? (
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() =>
                  updateSticker(data.stickerId, { title: titleDraft || undefined })
                }
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="To-do list"
                className="nodrag flex-1 bg-transparent text-[12.5px] font-medium tracking-tight text-white placeholder:text-muted-soft focus:outline-none"
              />
            ) : (
              <span className="truncate text-[12.5px] font-medium tracking-tight text-white">
                {data.title || "To-do list"}
              </span>
            )}
            <span className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-px text-[9.5px] tabular-nums tracking-wider text-muted">
              {open.length} OPEN
            </span>
          </div>

          {!editing && (
            <div className="nodrag flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                title="Edit"
                className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.10] bg-black/40 text-muted hover:border-accent/40 hover:text-accent"
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSticker(data.stickerId);
                }}
                title="Delete list"
                className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.10] bg-black/40 text-muted hover:border-rose-300/40 hover:text-rose-300"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
          )}

          {editing && (
            <div className="nodrag flex gap-1">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  archiveTodoPanel(data.stickerId);
                }}
                title="Archive panel → Reminders"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-accent/[0.10] hover:text-accent"
              >
                <Archive className="h-3 w-3" strokeWidth={1.8} />
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSticker(data.stickerId);
                }}
                title="Delete list (no archive)"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-rose-300/[0.10] hover:text-rose-300"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(false);
                }}
                title="Done"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/[0.18] text-white hover:bg-accent/[0.28]"
              >
                <Check className="h-3 w-3" strokeWidth={2.4} />
              </button>
            </div>
          )}
        </div>

        {/* Item list — scroll inside */}
        <div className="nodrag flex min-h-0 flex-1 flex-col gap-1 overflow-auto px-2 py-2 text-[12px]">
          {open.length === 0 && done.length === 0 && (
            <div className="px-1 py-2 text-[11px] text-muted-soft">
              {editing ? "Add your first item below." : "Double-click to add items."}
            </div>
          )}
          {open.map((it) => (
            <TodoRow
              key={it.id}
              editing={editing}
              done={it.done}
              text={it.text}
              onToggle={() => toggleTodoItem(data.stickerId, it.id)}
              onRemove={() => removeTodoItem(data.stickerId, it.id)}
              onTextChange={(v) =>
                updateTodoItem(data.stickerId, it.id, { text: v })
              }
            />
          ))}
          {done.length > 0 && (
            <>
              <div className="mt-1 px-1 text-[9.5px] tracking-wider text-muted-soft">
                DONE · {done.length}
              </div>
              {done.map((it) => (
                <TodoRow
                  key={it.id}
                  editing={editing}
                  done={it.done}
                  text={it.text}
                  onToggle={() => toggleTodoItem(data.stickerId, it.id)}
                  onRemove={() => removeTodoItem(data.stickerId, it.id)}
                  onTextChange={(v) =>
                    updateTodoItem(data.stickerId, it.id, { text: v })
                  }
                />
              ))}
            </>
          )}
        </div>

        {/* Add new item */}
        {editing && (
          <div className="nodrag flex items-center gap-1 border-t border-white/[0.05] bg-white/[0.015] px-2 py-1.5">
            <input
              ref={newItemRef}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") submitNew();
              }}
              placeholder="Add item — Enter"
              className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11.5px] text-white placeholder:text-muted-soft focus:border-accent/40 focus:outline-none"
            />
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                submitNew();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/[0.14] text-white hover:bg-accent/[0.24]"
              title="Add"
            >
              <Plus className="h-3 w-3" strokeWidth={2.4} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function TodoRow({
  done,
  text,
  editing,
  onToggle,
  onRemove,
  onTextChange,
}: {
  done: boolean;
  text: string;
  editing: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onTextChange: (v: string) => void;
}) {
  return (
    <div className="group/row flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-white/[0.02]">
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          done
            ? "border-accent/40 bg-accent/[0.12]"
            : "border-white/[0.10] hover:border-accent/30"
        )}
      >
        {done && <Check className="h-2.5 w-2.5 text-accent" strokeWidth={2.8} />}
      </button>
      {editing ? (
        <input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent text-[12px] focus:outline-none",
            done ? "text-muted line-through" : "text-white"
          )}
        />
      ) : (
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[12px]",
            done ? "text-muted line-through" : "text-white"
          )}
        >
          {text}
        </span>
      )}
      {editing && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 transition-opacity hover:text-rose-300 group-hover/row:opacity-100"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
