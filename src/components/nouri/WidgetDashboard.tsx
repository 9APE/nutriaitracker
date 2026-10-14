import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type WidgetItem,
  type WidgetType,
  type WidgetSize,
  type WidgetLayout,
  WIDGET_META,
  getWidgetLayout,
  saveWidgetLayout,
  onWidgetLayoutChange,
} from "@/lib/nouri-widget-layout";

const SIZE_LABEL: Record<WidgetSize, string> = { small: "Small", medium: "Medium", large: "Large" };

/*  Sortable wrapper per widget  */

interface SortableWidgetProps {
  widget: WidgetItem;
  editing: boolean;
  jiggleClass: string;
  onRemove: (id: string) => void;
  onResize: (id: string, size: WidgetSize) => void;
  onLongPress: () => void;
  children: React.ReactNode;
}

function SortableWidget({ widget, editing, jiggleClass, onRemove, onResize, onLongPress, children }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });
  const [sizeOpen, setSizeOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const pressedRef = useRef(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  const meta = WIDGET_META[widget.type];
  const sizeClass = widget.size === "large" || widget.size === "medium" ? "col-span-2" : "col-span-1";

  const startPress = () => {
    pressedRef.current = false;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      pressedRef.current = true;
      onLongPress();
      if (navigator.vibrate) navigator.vibrate(8);
    }, 450);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const dragHandlers = editing ? { ...attributes, ...listeners } : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-2xl",
        sizeClass,
        editing && [jiggleClass, "cursor-grab active:cursor-grabbing"],
        isDragging && "shadow-xl scale-[1.03] !animate-none"
      )}
      onPointerDown={editing ? undefined : startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onClickCapture={(e) => {
        if (pressedRef.current) {
          e.stopPropagation();
          e.preventDefault();
          pressedRef.current = false;
        }
      }}
      {...dragHandlers}
    >
      {/* Remove badge */}
      {editing && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(widget.id);
          }}
          className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center shadow-md ring-2 ring-background"
          aria-label={`Remove ${meta.label}`}
        >
          <X size={12} strokeWidth={3} />
        </button>
      )}

      {/* Size picker */}
      {editing && meta.allowedSizes.length > 1 && (
        <Popover open={sizeOpen} onOpenChange={setSizeOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setSizeOpen((p) => !p);
              }}
              className="absolute -top-2 -right-2 z-20 h-6 px-2 rounded-full bg-card border border-border text-foreground shadow-md ring-2 ring-background text-[10px] font-semibold"
              aria-label={`Resize ${meta.label}`}
            >
              {widget.size === "small" ? "S" : widget.size === "medium" ? "M" : "L"}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            className="w-40 p-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1.5">Size</div>
            {meta.allowedSizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResize(widget.id, s);
                  setSizeOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-2 rounded-md text-sm hover:bg-muted",
                  s === widget.size && "text-primary"
                )}
              >
                <span>{SIZE_LABEL[s]}</span>
                {s === widget.size && <Check size={14} />}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}

      <div className={cn(editing && "pointer-events-none select-none")}>{children}</div>
    </div>
  );
}

/*  Add Widget Sheet  */

function AddWidgetPanel({
  available,
  onAdd,
  onClose,
}: {
  available: WidgetType[];
  onAdd: (type: WidgetType) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl max-h-[75vh] overflow-auto animate-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <span className="font-serif text-base font-medium">Add Widget</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={18} />
          </button>
        </div>
        {available.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">All widgets are already on your dashboard.</div>
        ) : (
          <div className="p-4 grid grid-cols-2 gap-3">
            {available.map((type) => {
              const meta = WIDGET_META[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAdd(type)}
                  className="rounded-2xl border border-border bg-card hover:bg-muted p-4 flex flex-col items-center gap-2 transition-colors active:scale-95"
                >
                  <span className="text-2xl">{meta.icon}</span>
                  <span className="text-xs font-medium text-foreground text-center">{meta.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/*  Main Dashboard  */

interface WidgetDashboardProps {
  renderWidget: (widget: WidgetItem) => React.ReactNode;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

export function WidgetDashboard({ renderWidget, headerSlot, footerSlot }: WidgetDashboardProps) {
  const [layout, setLayout] = useState<WidgetLayout>(getWidgetLayout);
  const [editing, setEditing] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  useEffect(() => {
    return onWidgetLayoutChange(() => setLayout(getWidgetLayout()));
  }, []);

  // Lock body scroll while editing? No  keep scroll. But add Esc to exit.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setEditing(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLayout((prev) => {
      const oldIdx = prev.widgets.findIndex((w) => w.id === active.id);
      const newIdx = prev.widgets.findIndex((w) => w.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const next = { ...prev, widgets: arrayMove(prev.widgets, oldIdx, newIdx) };
      saveWidgetLayout(next);
      return next;
    });
  }, []);

  const removeWidget = useCallback((id: string) => {
    setLayout((prev) => {
      const widget = prev.widgets.find((w) => w.id === id);
      if (!widget) return prev;
      const next: WidgetLayout = {
        widgets: prev.widgets.filter((w) => w.id !== id),
        removedWidgets: prev.removedWidgets.includes(widget.type)
          ? prev.removedWidgets
          : [...prev.removedWidgets, widget.type],
      };
      saveWidgetLayout(next);
      return next;
    });
  }, []);

  const setWidgetSize = useCallback((id: string, size: WidgetSize) => {
    setLayout((prev) => {
      const next = {
        ...prev,
        widgets: prev.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
      };
      saveWidgetLayout(next);
      return next;
    });
  }, []);

  const addWidget = useCallback((type: WidgetType) => {
    setLayout((prev) => {
      const meta = WIDGET_META[type];
      const next: WidgetLayout = {
        widgets: [...prev.widgets, { id: `w-${type}-${Date.now()}`, type, size: meta.defaultSize }],
        removedWidgets: prev.removedWidgets.filter((t) => t !== type),
      };
      saveWidgetLayout(next);
      return next;
    });
    setAddPanelOpen(false);
  }, []);

  const availableToAdd = useMemo(() => {
    const present = new Set(layout.widgets.map((w) => w.type));
    const fromRemoved = layout.removedWidgets.filter((t) => !present.has(t));
    // Also expose any non-present type the user could re-add
    const all = (Object.keys(WIDGET_META) as WidgetType[]).filter((t) => !present.has(t));
    return Array.from(new Set([...fromRemoved, ...all]));
  }, [layout]);

  const widgetIds = useMemo(() => layout.widgets.map((w) => w.id), [layout.widgets]);

  return (
    <div className="space-y-[14px]">
      {headerSlot}

      {/* Edit toggle (subtle when idle) */}
      {!editing && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1"
          >
            Edit
          </button>
        </div>
      )}

      {/* Widget grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3">
            {layout.widgets.map((widget, i) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                editing={editing}
                jiggleClass={i % 2 === 0 ? "animate-jiggle-a" : "animate-jiggle-b"}
                onRemove={removeWidget}
                onResize={setWidgetSize}
                onLongPress={() => setEditing(true)}
              >
                {renderWidget(widget)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {footerSlot}

      {/* Floating edit-mode toolbar */}
      {editing && (
        <div className="fixed left-0 right-0 z-[55] flex justify-center pointer-events-none"
             style={{ bottom: "calc(var(--tabbar-h, 64px) + env(safe-area-inset-bottom) + 12px)" }}>
          <div className="pointer-events-auto flex items-center gap-2 bg-background/90 backdrop-blur border border-border rounded-full shadow-lg px-2 py-1.5">
            <button
              type="button"
              onClick={() => setAddPanelOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium hover:bg-muted active:scale-95"
            >
              <Plus size={14} />
              Add Widget
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-sm active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {addPanelOpen && (
        <AddWidgetPanel
          available={availableToAdd}
          onAdd={addWidget}
          onClose={() => setAddPanelOpen(false)}
        />
      )}
    </div>
  );
}
