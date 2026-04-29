import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Star, User, ArrowLeft, BarChart3, Building2, Briefcase, Calendar } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const RATING_LABELS: Record<number, string> = {
  1: "Outstanding",
  2: "Good",
  3: "Average",
  4: "Below Average",
  5: "Poor",
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

const Responses = () => {
  const [forms, setForms] = useState<Tables<"forms">[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [responses, setResponses] = useState<ResponseWithProfile[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<ResponseWithProfile | null>(null);
  const [answerDetails, setAnswerDetails] = useState<AnswerDetail[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

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
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      const mapped: ResponseWithProfile[] = resps.map((r) => ({
        ...r,
        profile: profiles?.find((p) => p.user_id === r.user_id) ?? null,
      }));
      setResponses(mapped);
    }
  };

  const viewResponse = async (resp: ResponseWithProfile) => {
    setSelectedResponse(resp);

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
      details.sort(
        (x, y) =>
          x.section_order - y.section_order ||
          x.question_order - y.question_order
      );
      setAnswerDetails(details);
    }
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Responses</h1>
          <p className="text-muted-foreground text-sm mt-1">View employee submissions</p>
        </div>
        <Select value={selectedFormId} onValueChange={setSelectedFormId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a form" />
          </SelectTrigger>
          <SelectContent>
            {forms.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.title}
              </SelectItem>
            ))}
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
            <Card
              key={resp.id}
              className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => viewResponse(resp)}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
                    {(resp.profile?.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {resp.profile?.full_name || "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {resp.profile?.email || ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {resp.profile?.job_title && (
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{resp.profile.job_title}</span>
                    </div>
                  )}
                  {resp.profile?.department && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{resp.profile.department}</span>
                    </div>
                  )}
                  {resp.profile?.date_of_joining && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Joined {new Date(resp.profile.date_of_joining).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/80 mt-3 pt-3 border-t border-border/50">
                  Submitted {new Date(resp.submitted_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-background shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
                {(selectedResponse?.profile?.full_name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate">{selectedResponse?.profile?.full_name || "Response Details"}</p>
                <p className="text-xs font-normal text-muted-foreground truncate">{selectedResponse?.profile?.email}</p>
              </div>
            </DialogTitle>
            {(selectedResponse?.profile?.job_title || selectedResponse?.profile?.department || selectedResponse?.profile?.date_of_joining) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-[52px] mt-1 text-xs text-muted-foreground">
                {selectedResponse?.profile?.job_title && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    {selectedResponse.profile.job_title}
                  </span>
                )}
                {selectedResponse?.profile?.department && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {selectedResponse.profile.department}
                  </span>
                )}
                {selectedResponse?.profile?.date_of_joining && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {new Date(selectedResponse.profile.date_of_joining).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 bg-muted/30">
            <div className="space-y-8">
              {(() => {
                const grouped: Record<string, AnswerDetail[]> = {};
                answerDetails.forEach((a) => {
                  if (!grouped[a.section_title]) grouped[a.section_title] = [];
                  grouped[a.section_title].push(a);
                });
                return Object.entries(grouped).map(([section, answers], sIdx) => (
                  <section
                    key={section}
                    className="bg-background rounded-xl border border-border shadow-sm overflow-hidden"
                  >
                    <header className="flex items-center gap-3 px-5 py-3 bg-secondary border-b border-border">
                      <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                        {sIdx + 1}
                      </div>
                      <h3 className="font-semibold text-secondary-foreground text-sm uppercase tracking-wide">
                        {section}
                      </h3>
                    </header>
                    <div className="divide-y divide-border">
                      {answers.map((a, idx) => (
                        <div key={idx} className="px-5 py-4">
                          <p className="text-sm font-medium text-foreground mb-2">{a.question_text}</p>
                          {a.question_type === "rating" ? (
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`h-5 w-5 ${s <= (a.rating_value ?? 0) ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                                  />
                                ))}
                              </div>
                              {a.rating_value ? (
                                <Badge variant="secondary" className="text-xs font-medium">
                                  {a.rating_value} = {RATING_LABELS[a.rating_value]}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Not rated</span>
                              )}
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Responses;
