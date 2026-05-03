import { useState } from "react";
import { ArrowLeft, BookOpen, Trash2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSavedRecipes, removeRecipe, updateRecipeRating, type SavedRecipe } from "@/lib/nouri-recipes";

interface Props {
  onBack: () => void;
}

type SortKey = "recent" | "rating" | "protein" | "calories";
type FilterType = "all" | "Breakfast" | "Lunch" | "Dinner" | "Snack";

export function RecipeLibrary({ onBack }: Props) {
  const [recipes, setRecipes] = useState<SavedRecipe[]>(() => getSavedRecipes());
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterType>("all");

  const refresh = () => setRecipes(getSavedRecipes());

  const handleDelete = (id: string) => {
    removeRecipe(id);
    refresh();
  };

  const handleRate = (id: string, rating: number) => {
    updateRecipeRating(id, rating);
    refresh();
  };

  let filtered = filter === "all" ? recipes : recipes.filter((r) => r.meal_type === filter);

  filtered = [...filtered].sort((a, b) => {
    switch (sort) {
      case "rating": return (b.rating || 0) - (a.rating || 0);
      case "protein": return b.protein - a.protein;
      case "calories": return a.calories - b.calories;
      default: return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    }
  });

  return (
    <div className="px-4 pt-4 pb-28 max-w-md mx-auto space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to Plan
      </button>

      <div className="flex items-center gap-2">
        <BookOpen size={18} className="text-primary" />
        <h2 className="text-lg font-serif font-medium">Recipe Library</h2>
        <span className="text-xs text-muted-foreground ml-auto">{recipes.length} saved</span>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["all", "Breakfast", "Lunch", "Dinner", "Snack"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-primary/40"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-1.5">
        {([
          { key: "recent", label: "Recent" },
          { key: "rating", label: "Top rated" },
          { key: "protein", label: "High protein" },
          { key: "calories", label: "Low cal" },
        ] as { key: SortKey; label: string }[]).map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${
              sort === s.key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            {recipes.length === 0
              ? "No saved recipes yet. Save meals from your plan or recommendations!"
              : "No recipes match this filter."}
          </p>
        </div>
      )}

      {/* Recipe cards */}
      <div className="space-y-2">
        {filtered.map((recipe) => (
          <div key={recipe.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{recipe.meal_name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {recipe.meal_type} · {recipe.source}
                </div>
              </div>
              <button
                onClick={() => handleDelete(recipe.id)}
                className="p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span>{recipe.calories} kcal</span>
              <span>{recipe.protein}g P</span>
              <span>{recipe.carbs}g C</span>
              <span>{recipe.fat}g F</span>
              {recipe.prep_time && <span>⏱ {recipe.prep_time}</span>}
            </div>

            {recipe.badges && recipe.badges.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {recipe.badges.map((b, i) => (
                  <Badge key={i} variant="outline" className="text-[9px]">{b}</Badge>
                ))}
              </div>
            )}

            {/* Rating */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRate(recipe.id, star)}
                  className="p-0.5"
                >
                  <Star
                    size={13}
                    className={
                      (recipe.rating || 0) >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    }
                  />
                </button>
              ))}
            </div>

            {recipe.why && (
              <p className="text-[10px] text-muted-foreground/70">{recipe.why}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
