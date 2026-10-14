#!/usr/bin/env node

import { execSync } from "node:child_process";
import process from "node:process";

function hasEnv(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

function checkSupabaseCli() {
  try {
    const version = execSync("npx.cmd supabase --version", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
    return { ok: true, version };
  } catch {
    return { ok: false, version: null };
  }
}

const projectRef = "hapazbmcpqcjkaqoejbb";
const checks = {
  supabaseCli: checkSupabaseCli(),
  supabaseAccessToken: hasEnv("SUPABASE_ACCESS_TOKEN"),
  discordWebhook: hasEnv("DISCORD_WEBHOOK"),
  brevoApiKey: hasEnv("BREVO_API_KEY"),
  resendApiKey: hasEnv("RESEND_API_KEY"),
  feedbackFromEmail: hasEnv("FEEDBACK_FROM_EMAIL"),
  feedbackToEmail: hasEnv("FEEDBACK_TO_EMAIL"),
  maintenanceKey: hasEnv("NUTRI_AI_MAINTENANCE_KEY"),
};

const hasDeliveryProvider = checks.discordWebhook || checks.brevoApiKey || checks.resendApiKey;

const summary = {
  projectRef,
  checks,
  nextSteps: [
    checks.supabaseAccessToken
      ? `Link project: npx supabase link --project-ref ${projectRef}`
      : "Set SUPABASE_ACCESS_TOKEN before deploying feedback functions.",
    "Deploy functions: npx supabase functions deploy feedback-prompt-state submit-feedback feedback-stats",
    "Push database migration: npx supabase db push",
    hasDeliveryProvider
      ? "Verify delivery envs in Supabase. Discord-only needs DISCORD_WEBHOOK; email needs FEEDBACK_FROM_EMAIL plus BREVO_API_KEY or RESEND_API_KEY."
      : "Set DISCORD_WEBHOOK or an email provider pair (BREVO_API_KEY or RESEND_API_KEY, plus FEEDBACK_FROM_EMAIL) in Supabase secrets",
    "Verify owner stats env in Supabase: NUTRI_AI_MAINTENANCE_KEY",
  ],
};

console.log(JSON.stringify(summary, null, 2));
