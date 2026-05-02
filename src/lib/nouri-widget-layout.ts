/** Widget layout system — persisted in localStorage */

export const WIDGET_TYPES = [
  "calorie-arc",
  "macros",
  "macro-protein",
  "macro-carbs",
  "macro-fat",
  "macro-fiber",
  "micros",
  "tip",
  "training",
  "meals",
  "log-button",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetItem {
  id: string;
  type: WidgetType;
  size: WidgetSize;
}

export interface WidgetLayout {
  widgets: WidgetItem[];
  removedWidgets: WidgetType[];
}

export const WIDGET_META: Record<WidgetType, { label: string; icon: string; defaultSize: WidgetSize; allowedSizes: WidgetSize[] }> = {
  "calorie-arc":   { label: "Calories Overview",   icon: "🔥", defaultSize: "large",  allowedSizes: ["small", "medium", "large"] },
  "macros":        { label: "Macro Summary",        icon: "📊", defaultSize: "large",  allowedSizes: ["small", "medium", "large"] },
  "macro-protein": { label: "Protein Detail",       icon: "🥩", defaultSize: "small",  allowedSizes: ["small", "medium", "large"] },
  "macro-carbs":   { label: "Carbs Detail",         icon: "🍞", defaultSize: "small",  allowedSizes: ["small", "medium", "large"] },
  "macro-fat":     { label: "Fat Detail",           icon: "🥑", defaultSize: "small",  allowedSizes: ["small", "medium", "large"] },
  "macro-fiber":   { label: "Fiber Detail",         icon: "🥦", defaultSize: "small",  allowedSizes: ["small", "medium", "large"] },
  "micros":        { label: "Micronutrients",       icon: "💊", defaultSize: "large",  allowedSizes: ["small", "medium", "large"] },
  "tip":           { label: "AI Tip",               icon: "🌿", defaultSize: "large",  allowedSizes: ["small", "medium", "large"] },
  "training":      { label: "Training",             icon: "🏋️", defaultSize: "large",  allowedSizes: ["small", "medium", "large"] },
  "meals":         { label: "Today's Meals",        icon: "🍽️", defaultSize: "large",  allowedSizes: ["small", "medium", "large"] },
  "log-button":    { label: "Log Meal Button",      icon: "🎤", defaultSize: "large",  allowedSizes: ["small", "medium", "large"] },
};

const KEY = "nouri:widgetLayout";
const EVENT = "widget:layout-updated";

export const DEFAULT_WIDGET_LAYOUT: WidgetLayout = {
  widgets: [
    { id: "w-calorie-arc",   type: "calorie-arc",   size: "large" },
    { id: "w-macros",        type: "macros",         size: "large" },
    { id: "w-training",      type: "training",       size: "large" },
    { id: "w-tip",           type: "tip",            size: "large" },
    { id: "w-macro-protein", type: "macro-protein",  size: "small" },
    { id: "w-macro-carbs",   type: "macro-carbs",    size: "small" },
    { id: "w-macro-fat",     type: "macro-fat",      size: "small" },
    { id: "w-macro-fiber",   type: "macro-fiber",    size: "small" },
    { id: "w-micros",        type: "micros",         size: "large" },
    { id: "w-log-button",    type: "log-button",     size: "large" },
    { id: "w-meals",         type: "meals",          size: "large" },
  ],
  removedWidgets: [],
};

export function getWidgetLayout(): WidgetLayout {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_WIDGET_LAYOUT;
    const parsed = JSON.parse(raw);
    if (!parsed?.widgets || !Array.isArray(parsed.widgets)) return DEFAULT_WIDGET_LAYOUT;
    return parsed as WidgetLayout;
  } catch {
    return DEFAULT_WIDGET_LAYOUT;
  }
}

export function saveWidgetLayout(layout: WidgetLayout) {
  localStorage.setItem(KEY, JSON.stringify(layout));
  window.dispatchEvent(new Event(EVENT));
}

export function onWidgetLayoutChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
