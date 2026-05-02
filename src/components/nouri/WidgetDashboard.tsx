import { useState, useEffect, useCallback, useMemo } from "react";
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
import { X, Plus, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type WidgetItem,
  type WidgetType,
  type WidgetSize,
  type WidgetLayout,
  WIDGET_META,
  WIDGET_TYPES,
  getWidgetLayout,
  saveWidgetLayout,
  onWidgetLayoutChange,
} from "@/lib/nouri-widget-layout";

/* ───────── Sortable wrapper per widget ───────── */

interface SortableWidgetProps {
  widget: WidgetItem;
  editing: boolean;
  onRemove: (id: string) => void;
  onResize: (id: string) => void;
  children: React.ReactNode;
}

function SortableWidget({ widget, editing, onRemove, onResize, children }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  const meta = WIDGET_META[widget.type];
  const sizeClass =
    widget.size === "large"
      ? "col-span-2"
      : "col-span-1";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-2xl transition-all duration-200",
        sizeClass,
        editing && "ring-2 ring-primary/30 cursor-grab active:cursor-grabbing",
        isDragging && "shadow-xl scale-[1.03]"
      )}
      {...attributes}
      {...listeners}
    >
      {/* Remove button */}
      {editing && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(widget.id);
          }}
          className="absolute -top-2 -left-2 z-10 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
          aria-label={`Remove ${meta.label}`}
        >
          <X size={12} />
        </button>
      )}

      {/* Resize button */}
      {editing && meta.allowedSizes.length > 1 && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onResize(widget.id);
          }}
          className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
          aria-label={`Resize ${meta.label}`}
        >
          <span className="text-[9px] font-bold leading-none">
            {widget.size === "small" ? "M" : widget.size === "medium" ? "L" : "S"}
          </span>
        </button>
      )}

      {children}
    </div>
  );
}

/* ───────── Add Widget Panel ───────── */

function AddWidgetPanel({
  available,
  onAdd,
  onClose,
}: {
  available: WidgetType[];
  onAdd: (type: WidgetType) => void;
  onClose: () => void;
}) {
  if (available.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl max-h-[70vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <span className="font-serif text-base font-medium">Add Widget</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={18} />
          </button>
        </div>
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
                <span className="text-xs font-medium text-foreground">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────── Main Dashboard ───────── */

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
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
    },
    []
  );

  const removeWidget = useCallback((id: string) => {
    setLayout((prev) => {
      const widget = prev.widgets.find((w) => w.id === id);
      if (!widget) return prev;
      const next: WidgetLayout = {
        widgets: prev.widgets.filter((w) => w.id !== id),
        removedWidgets: [...prev.removedWidgets, widget.type],
      };
      saveWidgetLayout(next);
      return next;
    });
  }, []);

  const resizeWidget = useCallback((id: string) => {
    setLayout((prev) => {
      const next = {
        ...prev,
        widgets: prev.widgets.map((w) => {
          if (w.id !== id) return w;
          const meta = WIDGET_META[w.type];
          const sizes = meta.allowedSizes;
          const idx = sizes.indexOf(w.size);
          const nextSize = sizes[(idx + 1) % sizes.length];
          return { ...w, size: nextSize };
        }),
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

  const availableToAdd = useMemo(
    () => layout.removedWidgets.filter((t) => !layout.widgets.some((w) => w.type === t)),
    [layout]
  );

  const widgetIds = useMemo(() => layout.widgets.map((w) => w.id), [layout.widgets]);

  return (
    <div className="space-y-[14px]">
      {headerSlot}

      {/* Edit mode controls */}
      <div className="flex items-center justify-end gap-2">
        {editing && availableToAdd.length > 0 && (
          <button
            type="button"
            onClick={() => setAddPanelOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-sm transition-transform active:scale-95"
          >
            <Plus size={14} />
            Add Widget
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing((p) => !p)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm transition-all active:scale-95",
            editing
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {/* Widget grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3">
            {layout.widgets.map((widget) => (
              <SortableWidget
                key={widget.id}
                widget={widget}
                editing={editing}
                onRemove={removeWidget}
                onResize={resizeWidget}
              >
                {renderWidget(widget)}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {footerSlot}

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
