import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Star, User, ArrowLeft, BarChart3 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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
        answer_text: a.answer_text,
        rating_value: a.rating_value,
      }));
      // Sort by section then question order
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
                  <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                    {(resp.profile?.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {resp.profile?.full_name || "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {resp.profile?.email || ""}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Submitted {new Date(resp.submitted_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                {(selectedResponse?.profile?.full_name || "?").charAt(0).toUpperCase()}
              </div>
              {selectedResponse?.profile?.full_name || "Response Details"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{selectedResponse?.profile?.email}</p>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {(() => {
              const grouped: Record<string, AnswerDetail[]> = {};
              answerDetails.forEach((a) => {
                if (!grouped[a.section_title]) grouped[a.section_title] = [];
                grouped[a.section_title].push(a);
              });
              return Object.entries(grouped).map(([section, answers]) => (
                <div key={section}>
                  <h3 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wider text-muted-foreground">
                    {section}
                  </h3>
                  <div className="space-y-3">
                    {answers.map((a, idx) => (
                      <div key={idx} className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm font-medium text-foreground mb-1">{a.question_text}</p>
                        {a.question_type === "rating" ? (
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-5 w-5 ${s <= (a.rating_value ?? 0) ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{a.answer_text || "—"}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Responses;
