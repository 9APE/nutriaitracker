import { NutriAIDemoPanel } from "@/components/nouri/NutriAIDemoPanel";

/**
 * Standalone demo panel page — no auth required.
 * Designed to be embedded as an <iframe> in an external portfolio.
 * URL: https://nutriaitracker.lovable.app/demo
 */
const Demo = () => (
  <NutriAIDemoPanel className="min-h-screen w-full" />
);

export default Demo;
