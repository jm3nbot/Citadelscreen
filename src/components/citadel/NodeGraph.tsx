"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeDragHandler,
  type ReactFlowInstance,
} from "reactflow";
import { CitadelNodeComponent, type NodeData } from "./CitadelNode";
import { TextStickerNode, ImageStickerNode, type StickerNodeData } from "./StickerNode";
import { StickyNoteNode, type StickyNodeData } from "./StickyNoteNode";
import { TodoStickerNode, type TodoNodeData } from "./TodoStickerNode";
import { initialNodes, initialEdges } from "@/lib/data/nodes";
import { useCitadel } from "@/lib/store";
import { NodeVisibilityMenu } from "./NodeVisibilityMenu";
import { saveLocalFile } from "@/lib/local-files";
import type { Sticker } from "@/lib/types";
import {
  StickyNote,
  ImagePlus,
  Type as TypeIcon,
  X as XIcon,
  CheckSquare,
  Puzzle,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const nodeTypes = {
  citadel: CitadelNodeComponent,
  "text-sticker": TextStickerNode,
  "image-sticker": ImageStickerNode,
  "sticky-note": StickyNoteNode,
  "todo-sticker": TodoStickerNode,
};

const fitViewOptions = { padding: 0.25, minZoom: 0.75, maxZoom: 1.1 };
const proOptions = { hideAttribution: true };
const defaultEdgeOptions = { type: "default" };
const minimapNodeColor = () => "rgb(var(--accent-rgb) / 0.4)";
const minimapNodeStrokeColor = () => "rgb(var(--accent-rgb) / 0.6)";

// Edges read accent from a CSS var so they update live with the theme.
// `boldEdges` thickens & brightens lines when grid is in bold mode.
function buildEdges(
  animate: boolean,
  visibleIds: Set<string>,
  boldEdges: boolean
): Edge[] {
  return initialEdges
    .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "default",
      animated: false,
      style: {
        stroke:
          e.animated && animate
            ? boldEdges
              ? "rgb(var(--accent-rgb) / 0.75)"
              : "rgb(var(--accent-rgb) / 0.45)"
            : boldEdges
            ? "rgba(255,255,255,0.32)"
            : "rgba(255,255,255,0.12)",
        strokeWidth: boldEdges ? 1.8 : 1.1,
      },
      className: e.animated && animate ? "flow-dash" : undefined,
    }));
}

type AnyStickerData = StickerNodeData | StickyNodeData | TodoNodeData;

// Build a React Flow node from a Sticker store record.
function stickerToNode(s: Sticker): Node<AnyStickerData> {
  const base = {
    id: s.id,
    position: s.position,
    draggable: true,
    selectable: true,
    width: s.width,
    height: s.height,
  };
  if (s.kind === "text") {
    return {
      ...base,
      type: "text-sticker",
      data: {
        kind: "text",
        stickerId: s.id,
        text: s.text,
        color: s.color,
        fontSize: s.fontSize,
        bold: s.bold,
        italic: s.italic,
        underline: s.underline,
        bare: s.bare,
        width: s.width,
        height: s.height,
      },
    };
  }
  if (s.kind === "image") {
    return {
      ...base,
      type: "image-sticker",
      data: {
        kind: "image",
        stickerId: s.id,
        localFileId: s.localFileId,
        mimeType: s.mimeType,
        alt: s.alt,
        bare: s.bare,
        width: s.width,
        height: s.height,
      },
    };
  }
  if (s.kind === "sticky") {
    return {
      ...base,
      type: "sticky-note",
      data: {
        kind: "sticky",
        stickerId: s.id,
        text: s.text,
        color: s.color,
        fontSize: s.fontSize,
        width: s.width,
        height: s.height,
      },
    };
  }
  // todo
  return {
    ...base,
    type: "todo-sticker",
    data: {
      kind: "todo",
      stickerId: s.id,
      title: s.title,
      items: s.items,
      width: s.width,
      height: s.height,
    },
  };
}

function NodeGraphInner() {
  const animateEdges = useCitadel((s) => s.prefs.animateEdges);
  const showMinimap = useCitadel((s) => s.prefs.showMinimap);
  const gridIntensity = useCitadel((s) => s.prefs.gridIntensity ?? "normal");
  const minimalNodes = useCitadel((s) => s.prefs.minimalNodes);
  const setSelectedNodeId = useCitadel((s) => s.setSelectedNodeId);
  const storedPositions = useCitadel((s) => s.nodePositions);
  const setNodePosition = useCitadel((s) => s.setNodePosition);
  const hidden = useCitadel((s) => s.hiddenNodes);
  const stickers = useCitadel((s) => s.stickers);
  const addTextSticker = useCitadel((s) => s.addTextSticker);
  const addImageSticker = useCitadel((s) => s.addImageSticker);
  const addStickyNote = useCitadel((s) => s.addStickyNote);
  const addTodoSticker = useCitadel((s) => s.addTodoSticker);
  const moveSticker = useCitadel((s) => s.moveSticker);
  const router = useRouter();

  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropHint, setDropHint] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  // Two-step placement: T/I arms a mode, the next canvas click drops the
  // sticker at the click point. Cursor follower previews the intent.
  const [placementMode, setPlacementMode] = useState<"text" | "image" | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  // For image placement: the files chosen via the picker are queued here and
  // consumed by the next canvas click.
  const pendingImageFiles = useRef<File[] | null>(null);
  // Right-click menu — anchored in screen coords, carries the canvas-space
  // position so created stickers land where the user actually right-clicked.
  const [ctxMenu, setCtxMenu] = useState<{
    screen: { x: number; y: number };
    flow: { x: number; y: number };
  } | null>(null);

  const visibleIds = useMemo(
    () => new Set(initialNodes.filter((n) => !hidden[n.id]).map((n) => n.id)),
    [hidden]
  );

  // Build the initial citadel nodes once — React Flow then owns their drag
  // state and writes back via onNodeDragStop.
  const initialCitadels: Node<NodeData>[] = useMemo(
    () =>
      initialNodes.map((n) => {
        const pos = storedPositions[n.id] ?? n.position;
        return {
          id: n.id,
          type: "citadel",
          position: pos,
          data: {
            label: n.label,
            kind: n.kind,
            icon: n.icon,
            description: n.description,
            connected: n.connected,
            category: n.category,
            minimal: minimalNodes,
          },
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const boldEdges = gridIntensity === "bold";

  // Mix sticker nodes alongside citadels so React Flow drags both uniformly.
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData | AnyStickerData>([
    ...initialCitadels,
    ...stickers.map(stickerToNode),
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    buildEdges(animateEdges, visibleIds, boldEdges)
  );

  useEffect(() => {
    setEdges(buildEdges(animateEdges && !isInteracting, visibleIds, boldEdges));
  }, [animateEdges, visibleIds, boldEdges, isInteracting, setEdges]);

  // Push current minimal flag and visibility into each citadel node.
  useEffect(() => {
    setNodes((curr) =>
      curr.map((n) => {
        if (n.type !== "citadel") return n;
        return {
          ...n,
          hidden: !visibleIds.has(n.id),
          data: { ...n.data, minimal: minimalNodes } as NodeData,
        };
      })
    );
  }, [visibleIds, minimalNodes, setNodes]);

  // Sync sticker store → React Flow. We patch existing sticker nodes in place
  // (preserving React Flow's internal node identity + selection) and only
  // rebuild for adds / removes. Replacing the whole array on every store
  // update would tear down sticker selection mid-interaction.
  useEffect(() => {
    setNodes((curr) => {
      const storeIds = new Set(stickers.map((s) => s.id));
      const existingById = new Map(
        curr.filter((n) => n.type !== "citadel").map((n) => [n.id, n] as const)
      );
      const citadels = curr.filter((n) => n.type === "citadel");
      const merged = stickers.map((s) => {
        const exist = existingById.get(s.id);
        const fresh = stickerToNode(s);
        if (!exist) return fresh;
        // Preserve React Flow's live position + selection; only patch data.
        return { ...exist, data: fresh.data };
      });
      // Drop nodes whose stickers were removed from the store.
      void storeIds;
      return [...citadels, ...merged];
    });
  }, [stickers, setNodes]);

  // When placement mode is armed, a click anywhere on the canvas drops the
  // sticker at the click point and exits the mode. We share one handler for
  // both pane clicks and node clicks so the user can drop a sticker on top
  // of another node without it being swallowed.
  const placeAtScreenPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rf = rfInstance.current;
      if (!rf) return;
      const position = rf.screenToFlowPosition({ x: clientX, y: clientY });
      if (placementMode === "text") {
        addTextSticker({ position, text: "" });
        setPlacementMode(null);
      } else if (placementMode === "image") {
        const files = pendingImageFiles.current;
        if (!files || files.length === 0) {
          setPlacementMode(null);
          return;
        }
        // Place files at click point, slightly offsetting multiples so they
        // don't sit perfectly stacked.
        files.forEach(async (file, i) => {
          const m = await import("@/lib/local-files");
          const rec = await m.saveLocalFile(file);
          addImageSticker({
            position: { x: position.x + i * 24, y: position.y + i * 24 },
            localFileId: rec.id,
            mimeType: rec.mimeType,
            alt: file.name,
            // Bare by default — preserves PNG transparency + native aspect.
            // The user can flip to card style from the edit toolbar.
            bare: true,
          });
        });
        pendingImageFiles.current = null;
        setPlacementMode(null);
      }
    },
    [placementMode, addTextSticker, addImageSticker]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (e, node) => {
      if (placementMode) {
        placeAtScreenPoint(e.clientX, e.clientY);
        return;
      }
      // Only citadel nodes open the side panel — stickers stay quiet.
      if (node.type === "citadel") setSelectedNodeId(node.id);
    },
    [setSelectedNodeId, placementMode, placeAtScreenPoint]
  );

  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      // Clicking the canvas dismisses the right-click menu first.
      if (ctxMenu) {
        setCtxMenu(null);
        return;
      }
      if (placementMode) placeAtScreenPoint(e.clientX, e.clientY);
    },
    [placementMode, placeAtScreenPoint, ctxMenu]
  );

  // Right-click anywhere on the network → contextual menu of insertions.
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rf = rfInstance.current;
    if (!rf) return;
    setCtxMenu({
      screen: { x: e.clientX, y: e.clientY },
      flow: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }),
    });
  }, []);

  // Close the menu on any unrelated click.
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_e, node) => {
      setIsInteracting(false);
      if (node.type === "citadel") setNodePosition(node.id, node.position);
      else if (node.type === "text-sticker" || node.type === "image-sticker") {
        moveSticker(node.id, node.position);
      }
    },
    [setNodePosition, moveSticker]
  );

  const startInteraction = useCallback(() => setIsInteracting(true), []);
  const endInteraction = useCallback(() => setIsInteracting(false), []);

  // Track mouse position whenever placement mode is armed so the cursor
  // follower indicator can render at the right spot.
  useEffect(() => {
    if (!placementMode) return;
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [placementMode]);

  // Keyboard shortcuts:
  //   T → arm text-placement (next click drops a text sticker)
  //   I → open file picker, then arm image-placement
  //   Esc → cancel
  // Suppressed when the user is typing in an input so it doesn't trigger
  // mid-message in the search bar etc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (e.key === "Escape" && placementMode) {
        setPlacementMode(null);
        pendingImageFiles.current = null;
        e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave Cmd-T etc alone
      if (e.key === "t" || e.key === "T") {
        setPlacementMode("text");
        e.preventDefault();
      } else if (e.key === "i" || e.key === "I") {
        // File picker first; placement mode arms after files are chosen.
        fileInputRef.current?.click();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementMode]);

  // Used by drag-drop (which carries its own drop coords) — bypasses
  // placement mode entirely.
  const handleDroppedImages = useCallback(
    async (files: FileList | File[], dropClientX: number, dropClientY: number) => {
      const rf = rfInstance.current;
      if (!rf) return;
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (arr.length === 0) return;
      for (const [i, file] of arr.entries()) {
        const rec = await saveLocalFile(file);
        const position = rf.screenToFlowPosition({
          x: dropClientX + i * 24,
          y: dropClientY + i * 24,
        });
        addImageSticker({
          position,
          localFileId: rec.id,
          mimeType: rec.mimeType,
          alt: file.name,
          // Bare by default — same reasoning as the click-to-place path.
          bare: true,
        });
      }
    },
    [addImageSticker]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      e.preventDefault();
      setDropHint(true);
    }
  }, []);
  const onDragLeave = useCallback(() => setDropHint(false), []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropHint(false);
      const files = e.dataTransfer.files;
      if (files && files.length) handleDroppedImages(files, e.clientX, e.clientY);
    },
    [handleDroppedImages]
  );

  const gridOff = gridIntensity === "off";

  return (
    <div
      className={cn(
        "absolute inset-0",
        // Crosshair feedback while waiting for the placement click.
        placementMode && "cursor-crosshair"
      )}
      ref={wrapperRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          // Queue chosen files for the next canvas click. Cancel if the user
          // backed out of the picker (no files).
          const files = e.target.files;
          if (files && files.length > 0) {
            pendingImageFiles.current = Array.from(files).filter((f) =>
              f.type.startsWith("image/")
            );
            if (pendingImageFiles.current.length > 0) setPlacementMode("image");
          }
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onInit={(inst) => {
          rfInstance.current = inst;
        }}
        fitView
        fitViewOptions={fitViewOptions}
        proOptions={proOptions}
        onlyRenderVisibleElements
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.4}
        maxZoom={1.5}
        panOnDrag
        zoomOnScroll
        onMoveStart={startInteraction}
        onMoveEnd={endInteraction}
        onNodeDragStart={startInteraction}
        // Disable React Flow's default Delete/Backspace key removal. The
        // user reported nodes disappearing with no way to recover except a
        // page reload — that was the auto-delete behavior. Citadel-style
        // nodes are now only "hideable" (toggleable via the gear menu);
        // stickers have their own explicit delete buttons.
        deleteKeyCode={null}
        defaultEdgeOptions={defaultEdgeOptions}
      >
        {!gridOff && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={gridIntensity === "bold" ? 18 : 22}
            size={gridIntensity === "bold" ? 1.6 : 1}
            color={
              gridIntensity === "veryLight"
                ? "rgba(255,255,255,0.025)"
                : gridIntensity === "normal"
                ? "rgba(255,255,255,0.06)"
                : "rgba(255,255,255,0.18)" /* bold */
            }
          />
        )}
        {/* Default ReactFlow Controls removed in favour of a single,
            clearly-labelled "Reset" button rendered below. Cuts the
            top-right gear menu / bottom-right zoom-stack visual collision
            entirely. */}
        {showMinimap && (
          <MiniMap
            position="bottom-left"
            maskColor="rgba(0,0,0,0.5)"
            nodeColor={minimapNodeColor}
            nodeStrokeColor={minimapNodeStrokeColor}
          />
        )}
      </ReactFlow>

      {/* corner labels — capped width so the subtitle can never bleed
          across the canvas and read like it's "behind" the top-right
          Reset / Nodes buttons. */}
      <div className="pointer-events-none absolute left-5 top-4 z-10 max-w-[320px]">
        <div className="mono-tag">citadel · network</div>
        <div className="mt-1 text-[18px] font-medium tracking-tight text-white">
          <span className="text-accent">Citadel Screen</span>
        </div>
        <div className="mt-0.5 text-[12px] leading-snug text-muted">
          {minimalNodes
            ? "Minimal mode — hover for names."
            : "Drag nodes. Click to inspect."}
        </div>
      </div>

      {/* Sticker shortcut hint */}
      <div className="pointer-events-none absolute bottom-5 left-5 z-10 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-ink-50/70 px-3 py-1.5 text-[10.5px] text-muted backdrop-blur-md">
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white">
            T
          </kbd>
          <StickyNote className="h-3 w-3" />
          text
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white">
            I
          </kbd>
          <ImagePlus className="h-3 w-3" />
          image
        </span>
        <span className="text-muted-soft">or drop images on the canvas</span>
      </div>

      {/* Drop indicator */}
      {dropHint && (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent/50 bg-accent/[0.04]">
          <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-ink-50/80 px-3 py-2 text-[12px] text-white shadow-glow-sm">
            <ImagePlus className="h-3.5 w-3.5 text-accent" strokeWidth={1.7} />
            Drop to add as sticker
          </div>
        </div>
      )}

      {/* Top-right control cluster: Reset + Nodes, side-by-side in a
          single row so they share a stacking context and can never overlap
          each other. Both are z-50 so the cluster sits above the minimap. */}
      <div className="pointer-events-auto absolute right-5 top-4 z-50 flex items-center gap-2">
        <button
          onClick={() => {
            rfInstance.current?.fitView({
              padding: 0.25,
              duration: 350,
              minZoom: 0.5,
              maxZoom: 1.1,
            });
          }}
          title="Reset view"
          aria-label="Reset network view to fit"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-ink-100/80 px-2.5 py-1.5 text-[11.5px] tracking-tight text-white backdrop-blur-md transition-all hover:border-accent/30 hover:bg-accent/[0.05] hover:shadow-glow-sm"
        >
          <RotateCcw className="h-[13px] w-[13px] text-accent" strokeWidth={1.8} />
          Reset
        </button>
        <NodeVisibilityMenu />
      </div>

      {/* Placement-mode cursor follower — small pill anchored to the mouse so
          the user knows they're armed to drop a sticker on the next click. */}
      {placementMode && mousePos && (
        <div
          className="pointer-events-none fixed z-[60] flex items-center gap-1.5 rounded-md border border-accent/40 bg-ink-100/95 px-2 py-1 text-[10.5px] tracking-tight text-white shadow-glow-sm backdrop-blur-md"
          style={{
            left: mousePos.x + 14,
            top: mousePos.y + 14,
          }}
        >
          {placementMode === "text" ? (
            <TypeIcon className="h-3 w-3 text-accent" strokeWidth={2} />
          ) : (
            <ImagePlus className="h-3 w-3 text-accent" strokeWidth={2} />
          )}
          <span>
            Click to place {placementMode === "text" ? "text" : "image"}
          </span>
          <span className="text-muted-soft">·</span>
          <kbd className="rounded border border-white/[0.10] bg-white/[0.04] px-1 py-0 text-[9px] text-muted">
            Esc
          </kbd>
        </div>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          // Stop click bubbling so the global handler doesn't close the menu
          // before our item handlers fire.
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-[80] w-[210px] overflow-hidden rounded-lg border border-white/[0.08] bg-ink-100/95 shadow-panel backdrop-blur-md"
          style={{ left: ctxMenu.screen.x + 2, top: ctxMenu.screen.y + 2 }}
        >
          <div className="mono-tag border-b border-white/[0.05] px-3 py-1.5">insert</div>
          <ul className="py-1 text-[12px]">
            <CtxItem
              icon={<Puzzle className="h-3.5 w-3.5" />}
              label="Add integration"
              hint="Open Apps"
              onClick={() => {
                setCtxMenu(null);
                router.push("/apps");
              }}
            />
            <CtxItem
              icon={<ImagePlus className="h-3.5 w-3.5" />}
              label="Add image..."
              hint="I"
              onClick={() => {
                setCtxMenu(null);
                fileInputRef.current?.click();
              }}
            />
            <CtxItem
              icon={<TypeIcon className="h-3.5 w-3.5" />}
              label="Text"
              hint="T"
              onClick={() => {
                addTextSticker({ position: ctxMenu.flow, text: "" });
                setCtxMenu(null);
              }}
            />
            <CtxItem
              icon={<StickyNote className="h-3.5 w-3.5 text-amber-300" />}
              label="Sticky note"
              onClick={() => {
                addStickyNote({
                  position: ctxMenu.flow,
                  text: "",
                  color: "yellow",
                });
                setCtxMenu(null);
              }}
            />
            <CtxItem
              icon={<CheckSquare className="h-3.5 w-3.5 text-accent" />}
              label="To-do panel"
              onClick={() => {
                addTodoSticker({ position: ctxMenu.flow, items: [], title: "" });
                setCtxMenu(null);
              }}
            />
          </ul>
        </div>
      )}

      {/* Placement-mode banner at top center — also a click target to bail out. */}
      {placementMode && (
        <button
          onClick={() => {
            setPlacementMode(null);
            pendingImageFiles.current = null;
          }}
          className="absolute left-1/2 top-4 z-[50] flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent/40 bg-ink-100/95 px-3 py-1 text-[11px] tracking-tight text-white shadow-glow-sm backdrop-blur-md hover:border-accent/60"
        >
          {placementMode === "text" ? (
            <TypeIcon className="h-3 w-3 text-accent" strokeWidth={2} />
          ) : (
            <ImagePlus className="h-3 w-3 text-accent" strokeWidth={2} />
          )}
          <span>
            Placing {placementMode === "text" ? "text sticker" : `${pendingImageFiles.current?.length ?? 0} image${(pendingImageFiles.current?.length ?? 0) === 1 ? "" : "s"}`}
          </span>
          <XIcon className="h-3 w-3 text-muted" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function CtxItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-white/85 hover:bg-white/[0.04] hover:text-white"
      >
        <span className="text-muted-soft">{icon}</span>
        <span className="flex-1">{label}</span>
        {hint && (
          <kbd className="rounded border border-white/[0.10] bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] text-muted">
            {hint}
          </kbd>
        )}
      </button>
    </li>
  );
}

export function NodeGraph() {
  return (
    <ReactFlowProvider>
      <NodeGraphInner />
    </ReactFlowProvider>
  );
}
