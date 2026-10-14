/**
 * useNouriChat  all data + AI orchestration for the Nouri chat surface.
 *
 * Responsibilities:
 *    Load + realtime-subscribe to `chat_messages`
 *    Always-fresh user profile (Supabase merged with localStorage)
 *    Classify a message as a meal log vs. a question
 *    Start background `ai_jobs` and resolve them when realtime fires
 *    Manage the `pendingPreview` state for the editable meal sheet
 *
 * Returns plain values + handlers  UI components stay dumb.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { startAiJob } from "@/hooks/useAiJob";
import { todayISO, type Goals, type Meal } from "@/lib/nouri-storage";
import { getLanguage, getLanguageName } from "@/lib/nouri-i18n";
import type { AnalyzedMeal } from "@/lib/nouri-api";
import type { ChatRow, PendingClarification, PendingPreview } from "@/components/nouri/chat/types";
import { getFamilyContext } from "@/lib/family-context";
import { buildNutritionistContext } from "@/lib/nutri-ai/nutritionist-context";
import { detectMessageIntent } from "@/lib/nutri-ai/message-intent";

const DEFAULT_CLARIFICATION_QUESTION =
  "Roughly how much did you have? A handful, bowl, pieces, grams, or cups all work.";
const DEFAULT_CLARIFICATION_OPTIONS = [
  "A few bites",
  "Small portion",
  "Medium portion",
  "Large portion",
];

interface UseNouriChatArgs {
  goals: Goals;
  meals: Meal[];
}

export function useNouriChat({ goals, meals }: UseNouriChatArgs) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [pendingPreview, setPendingPreview] = useState<PendingPreview | null>(null);
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(null);

  const today = todayISO();
  const todayMeals = meals.filter((m) => m.date === today);
  const todaySoFar = todayMeals.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  // Load + realtime subscription on chat_messages.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled && data) setRows(data as unknown as ChatRow[]);
    })();

    const channel = supabase
      .channel(`chat-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setRows((prev) => {
            const row = payload.new as unknown as ChatRow;
            if (prev.some((r) => r.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.old as unknown as ChatRow;
          setRows((prev) => prev.filter((r) => r.id !== row.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  /** Always merge Supabase + localStorage so restriction arrays are never lost. */
  const getFreshProfile = useCallback(async (): Promise<Record<string, any> | null> => {
    let local: Record<string, any> | null = null;
    try { const r = localStorage.getItem("userProfile"); local = r ? JSON.parse(r) : null; } catch {}
    try {
      if (!user) return local;
      const { data } = await supabase.from("profiles").select("user_profile_json").eq("id", user.id).maybeSingle();
      if (data?.user_profile_json) {
        const r = data.user_profile_json as Record<string, any>;
        return {
          ...(local ?? {}),
          ...r,
          restrictions: Array.isArray(r.restrictions) && r.restrictions.length ? r.restrictions : (local?.restrictions ?? []),
          conditions: Array.isArray(r.conditions) && r.conditions.length ? r.conditions : (local?.conditions ?? []),
          allergies: Array.isArray(r.allergies) && r.allergies.length ? r.allergies : (local?.allergies ?? []),
          dislikes: Array.isArray(r.dislikes) && r.dislikes.length ? r.dislikes : (local?.dislikes ?? []),
        };
      }
    } catch {}
    return local;
  }, [user]);

  /** Build a normalized AnalyzedMeal from a raw analyze-meal output. */
  const buildPreviewMeal = useCallback((m: any): AnalyzedMeal => {
    const micros = (m.micros && typeof m.micros === "object") ? m.micros : {};
    return {
      meal_name: m.meal_name,
      type: m.type,
      calories: m.calories ?? 0,
      protein: m.protein ?? 0,
      carbs: m.carbs ?? 0,
      fat: m.fat ?? 0,
      date: m.date ?? today,
      tip: typeof m.tip === "string" ? m.tip : undefined,
      micros: {
        fiber: micros.fiber ?? m.fiber,
        sugar: micros.sugar ?? m.sugar,
        saturated_fat: micros.saturated_fat ?? m.saturated_fat,
        sodium: micros.sodium ?? m.sodium,
        potassium: micros.potassium ?? m.potassium,
        cholesterol: micros.cholesterol ?? m.cholesterol,
        calcium: micros.calcium ?? m.calcium,
        iron: micros.iron ?? m.iron,
        vitamin_c: micros.vitamin_c ?? m.vitamin_c,
        vitamin_a: micros.vitamin_a ?? m.vitamin_a,
        vitamin_d: micros.vitamin_d ?? m.vitamin_d,
      },
    };
  }, [today]);

  /** Resolve a finished nutrition-chat job by appending the assistant row. */
  const resolveChatJob = useCallback(async (
    pendingRowId: string,
    output: any,
    status: "done" | "failed",
    error?: string,
  ) => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("id", pendingRowId);

    if (status === "failed") {
      await supabase.from("chat_messages").insert({
        user_id: user.id, role: "assistant",
        content: `Sorry  ${error ?? "something went wrong"}.`,
      });
      return;
    }

    const content = output?.content ?? "Sorry, no answer was returned.";
    await supabase.from("chat_messages").insert({
      user_id: user.id, role: "assistant",
      content, citations: output?.citations ?? null,
    });
  }, [user]);

  /** Resolve a finished analyze-meal job by filling the open preview sheet. */
  const resolveMealJob = useCallback((
    output: any,
    status: "done" | "failed",
    error?: string,
  ) => {
    if (status === "failed") {
      setPendingClarification(null);
      setPendingPreview((p) => p ? { ...p, error: error ?? "AI request failed" } : p);
      return;
    }
    if (output?.clarification) {
      setPendingPreview(null);
      setPendingClarification((current) => {
        if (!current) return null;
        return {
          ...current,
          question: String(output.clarification.question ?? DEFAULT_CLARIFICATION_QUESTION),
          options: Array.isArray(output.clarification.options)
            ? output.clarification.options.slice(0, 4).map(String)
            : DEFAULT_CLARIFICATION_OPTIONS,
        };
      });
      if (user) {
        void supabase.from("chat_messages").insert({
          user_id: user.id, role: "assistant",
          content: output.clarification.question ?? DEFAULT_CLARIFICATION_QUESTION,
        });
      }
      return;
    }
    if (output?.meal) {
      const previewMeal = buildPreviewMeal(output.meal);
      setPendingClarification(null);
      setPendingPreview((p) => p ? { ...p, meal: previewMeal, error: null } : { jobId: null, meal: previewMeal, error: null });
      return;
    }
    setPendingClarification(null);
    setPendingPreview((p) => p ? { ...p, error: "No meal could be parsed." } : p);
  }, [user, buildPreviewMeal]);

  /** Send a message: classifies, persists user row, dispatches an ai_job. */
  const send = useCallback(async (text: string, source: "voice" | "text" = "text") => {
    if (!user) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const clarificationContext = pendingClarification;
    const detectedIntent = clarificationContext
      ? { intent: "meal" as const, mealText: trimmed }
      : detectMessageIntent(trimmed);
    const mealText = clarificationContext
      ? trimmed
      : detectedIntent.intent === "question"
        ? ""
        : detectedIntent.mealText ?? trimmed;
    const questionText = detectedIntent.intent === "meal"
      ? ""
      : detectedIntent.questionText ?? trimmed;
    const shouldAnalyzeMeal = clarificationContext || detectedIntent.intent === "meal" || detectedIntent.intent === "mixed";
    const shouldAskQuestion = !clarificationContext && (detectedIntent.intent === "question" || detectedIntent.intent === "mixed");

    // 1. Insert user message
    await supabase.from("chat_messages").insert({
      user_id: user.id, role: "user", content: trimmed,
    });

    const profile = await getFreshProfile();
    const family = await getFamilyContext(profile, user.id);
    const nutritionistContext = buildNutritionistContext({
      meals,
      goals,
      userProfile: {
        ...(profile ?? {}),
        familyMembers: family.memberProfiles,
        familyRestrictions: family.mergedRestrictions,
      },
    }).aiContext;

    // 2. Build input for the jobs
    let mealJobInput: any = null;
    let chatJobInput: any = null;
    if (shouldAnalyzeMeal) {
      const effectiveMealText = clarificationContext?.originalText
        ? `${clarificationContext.originalText}\n\nClarifying answer: ${trimmed}`
        : mealText;
      const recent = rows
        .slice(-6)
        .map((r) => `${r.role === "user" ? "User" : "Assistant"}: ${r.content}`)
        .join("\n");
      const contextualText = clarificationContext
        ? effectiveMealText
        : recent
          ? `Recent conversation:\n${recent}\n\nUser now says: ${effectiveMealText}\n\nIf the user is referring to a meal mentioned above (e.g. "add it", "log this"), use that meal. Otherwise parse the new message.`
          : effectiveMealText;
      mealJobInput = {
        text: contextualText,
        profile,
        goals,
        nutritionistContext,
        eatenToday: {
          totals: todaySoFar,
          meals: todayMeals.map((m) => ({
            meal_name: m.meal_name, type: m.type,
            calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat,
          })),
        },
        alreadyClarified: !!clarificationContext,
        language: getLanguage() ?? "en",
        languageName: getLanguageName(),
      };
    }
    if (shouldAskQuestion) {
      const history = rows
        .filter((r) => r.role === "user" || r.role === "assistant")
        .slice(-8)
        .map((r) => ({ role: r.role, content: r.content }));
      history.push({
        role: "user",
        content: detectedIntent.intent === "mixed"
          ? `Meal I just described: ${mealText}\n\nQuestion: ${questionText}`
          : questionText,
      });
      chatJobInput = {
        messages: history,
        profile,
        goals,
        todayMeals,
        nutritionistContext,
        familyMode: family.familyMode,
        familyRestrictions: family.mergedRestrictions,
        familyMembers: family.memberProfiles,
        language: getLanguage() ?? "en",
        languageName: getLanguageName(),
      };
    }

    // 3. Open preview instantly for meal logs.
    if (shouldAnalyzeMeal) {
      setPendingPreview({ jobId: null, meal: null, error: null });
      if (!clarificationContext) {
        setPendingClarification({
          question: "",
          options: [],
          originalText: mealText,
          source,
          askedAt: Date.now(),
        });
      }
    }

    // 4. Start the background jobs
    if (shouldAnalyzeMeal && mealJobInput) {
      let mealJobId: string;
      try {
        mealJobId = await startAiJob("analyze-meal", mealJobInput);
      } catch (e: any) {
        setPendingPreview({ jobId: null, meal: null, error: e?.message ?? "network error" });
        setPendingClarification(null);
        return;
      }
      setPendingPreview((p) => p ? { ...p, jobId: mealJobId } : { jobId: mealJobId, meal: null, error: null });
    }

    if (shouldAskQuestion && chatJobInput) {
      let chatJobId: string;
      try {
        chatJobId = await startAiJob("nutrition-chat", chatJobInput);
      } catch (e: any) {
        await supabase.from("chat_messages").insert({
          user_id: user.id, role: "assistant",
          content: `Couldn't reach the AI  ${e?.message ?? "network error"}.`,
        });
        return;
      }
      await supabase.from("chat_messages").insert({
        user_id: user.id, role: "assistant",
        content: "", active_job_id: chatJobId, kind: "nutrition-chat",
      });
    }
  }, [user, rows, meals, goals, todayMeals, todaySoFar, getFreshProfile, pendingClarification]);

  const clearConversation = useCallback(async () => {
    if (!user) return;
    if (!confirm("Clear this conversation? Logged meals will not be deleted.")) return;
    await supabase.from("chat_messages").delete().eq("user_id", user.id);
    setRows([]);
  }, [user]);

  return {
    user,
    rows,
    todayMeals,
    todaySoFar,
    pendingPreview,
    pendingClarification,
    setPendingPreview,
    setPendingClarification,
    getFreshProfile,
    send,
    resolveChatJob,
    resolveMealJob,
    clearConversation,
  };
}
