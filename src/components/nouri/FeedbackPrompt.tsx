import { useMemo, useState } from "react";
import { Loader2, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitFeedback, type FeedbackPromptDecision } from "@/lib/feedback-prompt";
import { toast } from "sonner";

interface FeedbackPromptProps {
  decision: FeedbackPromptDecision;
  onClose: () => void;
  onSubmitted: () => void;
}

export function FeedbackPrompt({ decision, onClose, onSubmitted }: FeedbackPromptProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const heading = useMemo(
    () =>
      decision.reason === "monthly_follow_up"
        ? "How is Nutri AI feeling now?"
        : "Please give feedback",
    [decision.reason],
  );

  const canSubmit = rating > 0 && message.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await submitFeedback({
        rating,
        message,
        name,
        appOpenCountAtSubmit: decision.state.app_open_count,
      });
      if (!result.emailSent && result.emailReason === "delivery_not_configured") {
        toast.success("Feedback saved. Delivery will work once Discord or email sending is configured.");
      } else if (!result.emailSent && result.emailReason === "email_not_configured") {
        toast.success("Feedback saved. Delivery will work once the sender is configured.");
      } else if (!result.emailSent) {
        toast.success("Feedback saved, but delivery still needs attention.");
      } else {
        toast.success("Thanks - your feedback has been sent.");
      }
      onSubmitted();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't send feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <header className="border-b border-border px-5 py-4">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="font-serif text-lg font-medium">Nutri AI feedback</div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close feedback prompt"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-md space-y-5">
          <section className="nouri-section-card p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Early development
            </div>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-foreground">{heading}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We&apos;re still in early development, and the feedback you leave here is very likely
              to shape what we build next. You can stay unnamed if you prefer.
            </p>
          </section>

          <section className="nouri-section-card space-y-4 p-5">
            <div>
              <div className="text-sm font-medium text-foreground">Star rating</div>
              <div className="mt-3 flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = (hoverRating || rating) >= value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onMouseEnter={() => setHoverRating(value)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(value)}
                      className="rounded-full p-1"
                      aria-label={`Rate ${value} stars`}
                    >
                      <Star
                        size={26}
                        className={active ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="feedback-name">
                Name (optional)
              </label>
              <Input
                id="feedback-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Stay unnamed if you want"
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="feedback-message">
                What should we improve?
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary"
                placeholder="Tell us what feels good, what feels rough, and what you'd love us to add."
                maxLength={2000}
              />
              <div className="text-right text-xs text-muted-foreground">{message.length}/2000</div>
            </div>
          </section>
        </div>
      </div>

      <div className="border-t border-border bg-background px-5 py-4">
        <div className="mx-auto flex max-w-md gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Maybe later
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : "Send feedback"}
          </Button>
        </div>
      </div>
    </div>
  );
}
