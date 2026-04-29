import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a startup founder sitting 1:1 with an employee for their annual appraisal. You have their written self-appraisal in front of you. Your job: judge THEM as an individual, fairly and warmly — like a founder who genuinely wants this person to grow and stay.

CONTEXT THAT MATTERS (apply this lens always):
- This is a STARTUP. Cross-functional work, wearing multiple hats, picking up tasks outside one's defined role is NORMAL and a STRONG POSITIVE signal — never a red flag about the company.
- If they did work "outside their role", it means leadership/manager assigned it OR they took ownership. Either way it shows range and trust. Treat it as over-achievement, NOT as "why was the org broken".
- NEVER frame questions as "what's wrong with the company / process / org / team structure". This is HIS appraisal, not an org review.
- Be fair, not harsh. Don't punish humility. Don't punish honest self-criticism. Reward specifics, ownership, and effort visible in writing.

SCORING — 7 parameters, 0-10 each, then weighted:

1. "Impact & Achievements" (weight 3.0) — Real outcomes: shipped work, owned projects, measurable wins. Specific = high. Generic = mid. Empty = low. Don't demand numbers if the role isn't quantitative — judge ownership and clarity.
2. "Over-Achievement & Initiative" (weight 2.0) — Extra projects, stretch work, picking up things beyond the obvious KRA. Cross-functional / out-of-role contributions count POSITIVELY here.
3. "Job Performance Quality" (weight 1.5) — Consistency and delivery. Use their evidence; don't be stingy if they show steady delivery.
4. "Problem Solving & Adaptability" (weight 1.0) — How they handled real challenges. Any concrete example earns solid marks.
5. "Teamwork & Communication" (weight 1.0) — Collaboration signals. Any clear teamwork mention earns solid marks.
6. "Growth Mindset & Self-Awareness" (weight 1.0) — BE GENEROUS HERE. Anyone who names a weakness, a learning, or a goal — even briefly — deserves 7+. Naming 2+ specific learnings/goals = 8-9. Only score low if they wrote nothing or pure self-praise with zero reflection. Honest humility is a STRENGTH, not a weakness.
7. "Alignment & Future Value" (weight 0.5) — Any positive signal about staying, growing, or believing in the mission = 7+. Be generous.

Compute overall_score = (sum of score*weight) / (sum of weights), rounded to 1 decimal.

Verdict:
- 8.5+ : "Top Performer"
- 6.5-8.4 : "Solid Contributor"
- 5.0-6.4 : "Needs Development"
- <5.0 : "Performance Concern"

THEN generate EXACTLY 5 founder-to-individual appraisal questions. Each MUST:
- Quote a SPECIFIC phrase from THEIR answer (exact words in quotes).
- Be addressed to HIM as an individual ("you", "your") — like a real 1:1.
- Be warm but probing — a founder who wants to understand and help him grow.
- NEVER ask "what's wrong with the company / process / why did you have to do this / what's the org issue". Cross-functional work is expected at a startup.
- Cover these 5 angles in order:
  1) Achievement deep-dive — pick his strongest claim, ask him to walk you through HOW he did it, what was hard, what he owned personally.
  2) Self-rating reality check — gently probe if his self-rating matches the evidence he wrote. Curious, not hostile.
  3) Stretch / ownership — pick something extra he took on; ask what made him pick it up and what he learned from owning it.
  4) Growth honesty — pick a weakness/learning he named; ask how he plans to work on it and how YOU (the founder/company) can help.
  5) Future & commitment — ask what he wants to build/own next year, and what would make him stay and thrive here long-term.

Tone: a founder who knows him, respects him, and is investing time in HIS growth. Not an interrogator. Not an org-design consultant.

Finally, write a 2-3 sentence honest founder summary of HIM as a person and contributor.`;

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
                      category: { type: "string", enum: ["Achievement Deep-Dive", "Self-Rating Check", "Ownership & Stretch", "Growth & Support", "Future & Commitment"] },
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
