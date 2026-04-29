import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a sharp, no-nonsense startup founder evaluating an employee's annual self-appraisal for performance review.

You score them honestly — NOT generously. Inflated self-ratings without evidence get DOWNGRADED. Vague achievements get LOW scores. Specific, measurable impact gets HIGH scores.

You score 7 parameters from 0-10 based on actual evidence in their written answers, then weight them:

1. "Impact & Achievements" (weight 3.0) — Real measurable business outcomes (numbers, revenue, growth, shipped projects, ownership of wins). Vague = low. Specific metrics = high.
2. "Over-Achievement & Initiative" (weight 2.0) — Going beyond defined KRAs. Extra projects, proactive ownership, stretch goals.
3. "Job Performance Quality" (weight 1.5) — Consistency, accuracy, timely delivery. Cross-check self-rating against evidence in text.
4. "Problem Solving & Adaptability" (weight 1.0) — How they handled real challenges, resilience, learning curve.
5. "Teamwork & Communication" (weight 1.0) — Collaboration, team contribution, clarity.
6. "Growth Mindset & Self-Awareness" (weight 1.0) — Honest self-assessment, clarity on weaknesses, learning goals.
7. "Alignment & Future Value" (weight 0.5) — Vision fit, long-term commitment, role clarity.

For each parameter give: score (0-10), one-line reasoning quoting/referencing their actual response.

Then compute overall_score = weighted average / 10, rounded to 1 decimal.

Verdict labels:
- 8.5+ : "Top Performer"
- 6.5-8.4 : "Solid Contributor"
- 5.0-6.4 : "Needs Development"
- <5.0 : "Performance Concern"

Then generate EXACTLY 5 founder-style interview questions for the appraisal meeting. Each question MUST:
- Quote a SPECIFIC line/phrase from THEIR actual answer (use exact words in quotes)
- Be sharp, probing, evidence-based — like a founder cross-examining
- Cover: 1) Achievement evidence probe, 2) Self-rating vs reality challenge, 3) Over-achievement test, 4) Growth honesty, 5) Future commitment
- Be specific to THIS employee, NOT generic templates

Write a 2-3 sentence executive summary at the end — honest founder verdict.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { response_id } = await req.json();
    if (!response_id) {
      return new Response(JSON.stringify({ error: "response_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check cache
    const { data: cached } = await supabase
      .from("response_analysis")
      .select("*")
      .eq("response_id", response_id)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify({ analysis: cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load full response with answers + employee info
    const { data: respRow } = await supabase
      .from("form_responses")
      .select("id, user_id, form_id")
      .eq("id", response_id)
      .single();

    if (!respRow) throw new Error("Response not found");

    const [{ data: profile }, { data: form }, { data: answers }] = await Promise.all([
      supabase.from("profiles").select("full_name, email, job_title, department, date_of_joining").eq("user_id", respRow.user_id).maybeSingle(),
      supabase.from("forms").select("title").eq("id", respRow.form_id).single(),
      supabase
        .from("response_answers")
        .select("answer_text, rating_value, form_questions!inner(question_text, question_type, display_order, form_sections!inner(title, display_order))")
        .eq("response_id", response_id),
    ]);

    // Build structured text of the response
    const RATING_LABELS: Record<number, string> = {
      1: "Outstanding", 2: "Good", 3: "Average", 4: "Below Average", 5: "Poor",
    };
    const sorted = (answers ?? []).sort((a: any, b: any) => {
      const sa = a.form_questions.form_sections.display_order ?? 0;
      const sb = b.form_questions.form_sections.display_order ?? 0;
      if (sa !== sb) return sa - sb;
      return (a.form_questions.display_order ?? 0) - (b.form_questions.display_order ?? 0);
    });

    const grouped: Record<string, string[]> = {};
    for (const a of sorted) {
      const sec = (a as any).form_questions.form_sections.title;
      const q = (a as any).form_questions.question_text;
      const isRating = (a as any).form_questions.question_type === "rating";
      const ans = isRating
        ? `${(a as any).rating_value ?? "—"} (${RATING_LABELS[(a as any).rating_value] ?? "—"})`
        : ((a as any).answer_text || "—");
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push(`Q: ${q}\nA: ${ans}`);
    }

    const responseText = Object.entries(grouped)
      .map(([sec, items]) => `### ${sec}\n${items.join("\n\n")}`)
      .join("\n\n");

    const userPrompt = `EMPLOYEE: ${profile?.full_name ?? "Unknown"} | ${profile?.job_title ?? ""} | ${profile?.department ?? ""}
FORM: ${form?.title ?? ""}

THEIR FULL APPRAISAL RESPONSE:
${responseText}

Analyze this honestly and return the structured output.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_analysis",
            description: "Submit the structured appraisal analysis",
            parameters: {
              type: "object",
              properties: {
                overall_score: { type: "number", description: "Weighted score 0-10, one decimal" },
                verdict: { type: "string", enum: ["Top Performer", "Solid Contributor", "Needs Development", "Performance Concern"] },
                summary: { type: "string", description: "2-3 sentence honest founder verdict" },
                parameters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      weight: { type: "number" },
                      score: { type: "number", description: "0-10" },
                      reasoning: { type: "string", description: "One line referencing their actual response" },
                    },
                    required: ["name", "weight", "score", "reasoning"],
                  },
                },
                questions: {
                  type: "array",
                  description: "Exactly 5 founder-style probing questions",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["Evidence Probe", "Self-Rating Challenge", "Over-Achievement Test", "Growth Honesty", "Future Commitment"] },
                      quoted_line: { type: "string", description: "Exact phrase from their answer being referenced" },
                      question: { type: "string", description: "The full probing question to ask" },
                    },
                    required: ["category", "quoted_line", "question"],
                  },
                },
              },
              required: ["overall_score", "verdict", "summary", "parameters", "questions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiResp.status}`);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output returned");
    const parsed = JSON.parse(toolCall.function.arguments);

    const { data: inserted, error: insErr } = await supabase
      .from("response_analysis")
      .insert({
        response_id,
        overall_score: parsed.overall_score,
        verdict: parsed.verdict,
        parameters: parsed.parameters,
        questions: parsed.questions,
        summary: parsed.summary,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    return new Response(JSON.stringify({ analysis: inserted, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-response error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
