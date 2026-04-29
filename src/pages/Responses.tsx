import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, BarChart3, Building2, Briefcase, Calendar, Sparkles, Loader2, MessageSquareQuote, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const RATING_LABELS: Record<number, string> = {
  1: "Outstanding", 2: "Good", 3: "Average", 4: "Below Average", 5: "Poor",
};

interface ResponseWithProfile {
  id: string;
  form_id: string;
  user_id: string;
  submitted_at: string;
  profile: Tables<"profiles"> | null;
}
interface AnswerDetail {
  question_text: string;
  question_type: string;
  section_title: string;
  section_order: number;
  question_order: number;
  answer_text: string | null;
  rating_value: number | null;
}
interface ParameterScore {
  name: string;
  weight: number;
  score: number;
  reasoning: string;
}
interface MeetingQuestion {
  category: string;
  quoted_line: string;
  question: string;
}
interface Analysis {
  overall_score: number;
  verdict: string;
  summary: string;
  parameters: ParameterScore[];
  questions: MeetingQuestion[];
}

const verdictStyle = (v: string) => {
  if (v === "Top Performer") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (v === "Solid Contributor") return "bg-blue-500/10 text-blue-700 border-blue-500/30";
  if (v === "Needs Development") return "bg-amber-500/10 text-amber-700 border-amber-500/30";
  return "bg-red-500/10 text-red-700 border-red-500/30";
};

const scoreColor = (s: number) => {
  if (s >= 8.5) return "text-emerald-600";
  if (s >= 6.5) return "text-blue-600";
  if (s >= 5) return "text-amber-600";
  return "text-red-600";
};

const Responses = () => {
  const [forms, setForms] = useState<Tables<"forms">[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [responses, setResponses] = useState<ResponseWithProfile[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<ResponseWithProfile | null>(null);
  const [answerDetails, setAnswerDetails] = useState<AnswerDetail[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  useEffect(() => {
    supabase.from("forms").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setForms(data ?? []);
      if (data && data.length > 0) setSelectedFormId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedFormId) return;
    loadResponses();
  }, [selectedFormId]);

  const loadResponses = async () => {
    const { data: resps } = await supabase
      .from("form_responses")
      .select("*")
      .eq("form_id", selectedFormId)
      .order("submitted_at", { ascending: false });
    if (resps) {
      const userIds = resps.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      setResponses(resps.map((r) => ({ ...r, profile: profiles?.find((p) => p.user_id === r.user_id) ?? null })));
    }
  };

  const viewResponse = async (resp: ResponseWithProfile) => {
    setSelectedResponse(resp);
    setAnalysis(null);
    setDialogOpen(true);

    const { data: answersData } = await supabase
      .from("response_answers")
      .select("*, form_questions!inner(question_text, question_type, section_id, display_order, form_sections!inner(title, display_order))")
      .eq("response_id", resp.id);
    if (answersData) {
      const details: AnswerDetail[] = answersData.map((a: any) => ({
        question_text: a.form_questions.question_text,
        question_type: a.form_questions.question_type,
        section_title: a.form_questions.form_sections.title,
        section_order: a.form_questions.form_sections.display_order ?? 0,
        question_order: a.form_questions.display_order ?? 0,
        answer_text: a.answer_text,
        rating_value: a.rating_value,
      }));
      details.sort((x, y) => x.section_order - y.section_order || x.question_order - y.question_order);
      setAnswerDetails(details);
    }

    // Check if cached analysis exists
    const { data: cached } = await supabase
      .from("response_analysis")
      .select("*")
      .eq("response_id", resp.id)
      .maybeSingle();
    if (cached) {
      setAnalysis({
        overall_score: Number(cached.overall_score),
        verdict: cached.verdict,
        summary: cached.summary ?? "",
        parameters: (cached.parameters as unknown as ParameterScore[]) ?? [],
        questions: (cached.questions as unknown as MeetingQuestion[]) ?? [],
      });
    }
  };

  const generateAnalysis = async () => {
    if (!selectedResponse) return;
    setLoadingAnalysis(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-response", {
        body: { response_id: selectedResponse.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const a = data.analysis;
      setAnalysis({
        overall_score: Number(a.overall_score),
        verdict: a.verdict,
        summary: a.summary ?? "",
        parameters: a.parameters ?? [],
        questions: a.questions ?? [],
      });
      toast.success(data.cached ? "Loaded saved analysis" : "Analysis generated");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate analysis");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Responses</h1>
          <p className="text-muted-foreground text-sm mt-1">View employee submissions with AI-powered appraisal insights</p>
        </div>
        <Select value={selectedFormId} onValueChange={setSelectedFormId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Select a form" /></SelectTrigger>
          <SelectContent>
            {forms.map((f) => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {responses.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No responses yet for this form</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {responses.map((resp) => (
            <Card key={resp.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => viewResponse(resp)}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
                    {(resp.profile?.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{resp.profile?.full_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground truncate">{resp.profile?.email || ""}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {resp.profile?.job_title && <div className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{resp.profile.job_title}</span></div>}
                  {resp.profile?.department && <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{resp.profile.department}</span></div>}
                  {resp.profile?.date_of_joining && <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Joined {new Date(resp.profile.date_of_joining).toLocaleDateString()}</span></div>}
                </div>
                <p className="text-xs text-muted-foreground/80 mt-3 pt-3 border-t border-border/50">Submitted {new Date(resp.submitted_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[1400px] w-[95vw] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col [&>button]:hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b bg-background shrink-0 flex items-center gap-4">
            <div className="h-11 w-11 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-base font-semibold shrink-0">
              {(selectedResponse?.profile?.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">{selectedResponse?.profile?.full_name || "Response"}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                <span className="truncate">{selectedResponse?.profile?.email}</span>
                {selectedResponse?.profile?.job_title && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{selectedResponse.profile.job_title}</span>}
                {selectedResponse?.profile?.department && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{selectedResponse.profile.department}</span>}
                {selectedResponse?.profile?.date_of_joining && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Joined {new Date(selectedResponse.profile.date_of_joining).toLocaleDateString()}</span>}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDialogOpen(false)} className="shrink-0"><X className="h-5 w-5" /></Button>
          </div>

          {/* Split body */}
          <div className="flex-1 grid grid-cols-2 min-h-0 divide-x">
            {/* LEFT: response */}
            <div className="overflow-y-auto bg-muted/30">
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <MessageSquareQuote className="h-3.5 w-3.5" /> Employee Response
                </div>
                {(() => {
                  const grouped: Record<string, AnswerDetail[]> = {};
                  answerDetails.forEach((a) => { if (!grouped[a.section_title]) grouped[a.section_title] = []; grouped[a.section_title].push(a); });
                  return Object.entries(grouped).map(([section, answers], sIdx) => (
                    <section key={section} className="bg-background rounded-xl border border-border shadow-sm overflow-hidden">
                      <header className="flex items-center gap-3 px-4 py-2.5 bg-secondary border-b border-border">
                        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold shrink-0">{sIdx + 1}</div>
                        <h3 className="font-semibold text-secondary-foreground text-xs uppercase tracking-wide">{section}</h3>
                      </header>
                      <div className="divide-y divide-border">
                        {answers.map((a, idx) => (
                          <div key={idx} className="px-4 py-3">
                            <p className="text-sm font-medium text-foreground mb-1.5">{a.question_text}</p>
                            {a.question_type === "rating" ? (
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map((s) => (
                                    <Star key={s} className={`h-4 w-4 ${s <= (a.rating_value ?? 0) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                                  ))}
                                </div>
                                {a.rating_value ? <Badge variant="secondary" className="text-xs">{a.rating_value} = {RATING_LABELS[a.rating_value]}</Badge> : <span className="text-xs text-muted-foreground">Not rated</span>}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{a.answer_text || "—"}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  ));
                })()}
              </div>
            </div>

            {/* RIGHT: analysis */}
            <div className="overflow-y-auto bg-background">
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Appraisal Analysis
                  </div>
                  {analysis && (
                    <Button variant="ghost" size="sm" onClick={generateAnalysis} disabled={loadingAnalysis} className="h-7 text-xs">
                      {loadingAnalysis ? <Loader2 className="h-3 w-3 animate-spin" /> : "Regenerate"}
                    </Button>
                  )}
                </div>

                {!analysis && !loadingAnalysis && (
                  <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-xl">
                    <div className="h-14 w-14 rounded-full gradient-primary flex items-center justify-center mb-4">
                      <Sparkles className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">Generate Performance Analysis</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mb-4">Get a weighted score out of 10 across 7 parameters plus 5 founder-style questions for the appraisal meeting.</p>
                    <Button onClick={generateAnalysis} className="gradient-primary text-primary-foreground">
                      <Sparkles className="h-4 w-4 mr-2" /> Analyze Response
                    </Button>
                  </div>
                )}

                {loadingAnalysis && !analysis && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Reading response & scoring...</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">This takes ~15 seconds</p>
                  </div>
                )}

                {analysis && (
                  <>
                    {/* Score card */}
                    <div className="rounded-xl border border-border bg-gradient-to-br from-background to-muted/40 p-5">
                      <div className="flex items-center gap-5">
                        <div className="relative h-24 w-24 shrink-0">
                          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
                              strokeDasharray={`${(analysis.overall_score / 10) * 264} 264`} />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-2xl font-bold ${scoreColor(analysis.overall_score)}`}>{analysis.overall_score.toFixed(1)}</span>
                            <span className="text-[10px] text-muted-foreground -mt-1">out of 10</span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <Badge className={`${verdictStyle(analysis.verdict)} border font-medium`}>{analysis.verdict}</Badge>
                          <p className="text-sm text-foreground mt-2 leading-relaxed">{analysis.summary}</p>
                        </div>
                      </div>
                    </div>

                    {/* Parameter breakdown */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5" /> Parameter Breakdown
                      </div>
                      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                        {analysis.parameters.map((p, i) => (
                          <div key={i} className="p-3.5 bg-background">
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                                <p className="text-[11px] text-muted-foreground">Weight {p.weight.toFixed(1)}</p>
                              </div>
                              <div className={`text-base font-bold tabular-nums ${scoreColor(p.score)}`}>{p.score.toFixed(1)}<span className="text-xs text-muted-foreground font-normal">/10</span></div>
                            </div>
                            <Progress value={p.score * 10} className="h-1.5 mb-2" />
                            <p className="text-xs text-muted-foreground leading-relaxed">{p.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Meeting Questions */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <MessageSquareQuote className="h-3.5 w-3.5" /> 5 Questions for Appraisal Meeting
                      </div>
                      <div className="space-y-2.5">
                        {analysis.questions.map((q, i) => (
                          <div key={i} className="rounded-xl border border-border bg-background p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold shrink-0">{i + 1}</div>
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wide font-semibold">{q.category}</Badge>
                            </div>
                            <div className="pl-8 space-y-2">
                              <div className="rounded-md bg-muted/60 border-l-2 border-primary px-3 py-1.5">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">They wrote:</p>
                                <p className="text-xs text-foreground italic">"{q.quoted_line}"</p>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed">{q.question}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Responses;
