// Shared evidence-source instruction appended to nutrition-related system prompts.
// Forces Claude to cite ONLY trusted medical sources for users with health conditions.

export const EVIDENCE_SOURCES_INSTRUCTION = `

When recommending meals or analysing food for users with specific health conditions (diabetes, hypertension, celiac, high cholesterol, etc.), ALWAYS include a one-line evidence note referencing ONLY these trusted sources: American Diabetes Association (diabetes.org), Mayo Clinic (mayoclinic.org), NHS (nhs.uk), or PubMed (pubmed.ncbi.nlm.nih.gov). Format it as: '[Recommendation]. Source: [Source name] — [link]'. Never invent or guess sources. If unsure about a recommendation for their condition, say so honestly.`;
