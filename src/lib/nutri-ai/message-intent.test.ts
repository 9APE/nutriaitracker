import { describe, expect, it } from "vitest";
import { detectMessageIntent } from "@/lib/nutri-ai/message-intent";

describe("detectMessageIntent", () => {
  it("classifies plain meal logs as meals", () => {
    expect(detectMessageIntent("For breakfast I had oats with milk and a banana")).toMatchObject({
      intent: "meal",
      mealText: "For breakfast I had oats with milk and a banana",
    });
  });

  it("classifies plain questions as questions", () => {
    expect(detectMessageIntent("How much protein do I have left today?")).toMatchObject({
      intent: "question",
      questionText: "How much protein do I have left today?",
    });
  });

  it("keeps interrogative food questions as questions instead of meal logs", () => {
    expect(detectMessageIntent("What should I have for dinner?")).toMatchObject({
      intent: "question",
      questionText: "What should I have for dinner?",
    });
  });

  it("splits a meal log followed by a question", () => {
    expect(
      detectMessageIntent("For dinner I had chicken and rice, is that okay for my goals"),
    ).toMatchObject({
      intent: "mixed",
      mealText: "For dinner I had chicken and rice",
      questionText: "is that okay for my goals?",
    });
  });

  it("splits a mixed transcript without punctuation when the question cue is clear", () => {
    expect(
      detectMessageIntent("Today I ate salmon and potatoes can I still have dessert"),
    ).toMatchObject({
      intent: "mixed",
      mealText: "Today I ate salmon and potatoes",
      questionText: "can I still have dessert?",
    });
  });
});
