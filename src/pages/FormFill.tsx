import { useEffect, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface FormSection {
  id: string;
  title: string;
  display_order: number;
  questions: Tables<"form_questions">[];
}

const RATING_LABELS: Record<number, string> = {
  1: "Outstanding",
  2: "Good",
  3: "Average",
  4: "Below Average",
  5: "Poor",
};

const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="space-y-2">
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
            star === value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-input hover:border-primary/50"
          }`}
        >
          {star}
        </button>
      ))}
    </div>
    {value > 0 && (
      <p className="text-xs text-muted-foreground">
        {value} = {RATING_LABELS[value]}
      </p>
    )}
  </div>
);

const FormFill = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, user, profile, isLoading: authLoading } = useAuth();

  const [form, setForm] = useState<Tables<"forms"> | null>(null);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [answers, setAnswers] = useState<Record<string, { text: string; rating: number | null }>>({});
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState(0);
  const [notEligible, setNotEligible] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    loadForm();
  }, [user, id]);

  const loadForm = async () => {
    const { data: formData } = await supabase.from("forms").select("*").eq("id", id!).single();
    if (!formData || formData.status !== "published") {
      toast.error("Form not available");
      navigate("/dashboard");
      return;
    }
    setForm(formData);

    // Check eligibility: must have joined on or before 30 Sep 2025
    const cutoffDate = new Date("2025-09-30");
    const doj = profile?.date_of_joining ? new Date(profile.date_of_joining) : null;
    if (!doj || doj > cutoffDate) {
      setNotEligible(true);
      setLoading(false);
      return;
    }

    // Check if already submitted
    const { data: existing } = await supabase
      .from("form_responses")
      .select("id")
      .eq("form_id", id!)
      .eq("user_id", user!.id)
      .maybeSingle();
    if (existing) {
      setAlreadySubmitted(true);
      setLoading(false);
      return;
    }

    // Load sections & questions
    const { data: secs } = await supabase
      .from("form_sections")
      .select("*")
      .eq("form_id", id!)
      .order("display_order");

    if (secs) {
      const loadedSections: FormSection[] = [];
      for (const sec of secs) {
        const { data: qs } = await supabase
          .from("form_questions")
          .select("*")
          .eq("section_id", sec.id)
          .order("display_order");
        loadedSections.push({ ...sec, questions: qs ?? [] });
      }
      setSections(loadedSections);

      // Init answers
      const initAnswers: Record<string, { text: string; rating: number | null }> = {};
      loadedSections.forEach((s) =>
        s.questions.forEach((q) => {
          initAnswers[q.id] = { text: "", rating: null };
        })
      );
      setAnswers(initAnswers);
    }
    setLoading(false);
  };

  const updateAnswer = (qId: string, field: "text" | "rating", val: any) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], [field]: val },
    }));
  };

  const handleSubmit = async () => {
    // Validate required
    for (const sec of sections) {
      for (const q of sec.questions) {
        if (q.required) {
          const ans = answers[q.id];
          if (q.question_type === "rating" && !ans?.rating) {
            toast.error(`Please rate: ${q.question_text}`);
            return;
          }
          if (q.question_type !== "rating" && !ans?.text?.trim()) {
            toast.error(`Please answer: ${q.question_text}`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      const { data: response, error } = await supabase
        .from("form_responses")
        .insert({ form_id: id!, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      const answerRows = Object.entries(answers).map(([questionId, ans]) => ({
        response_id: response.id,
        question_id: questionId,
        answer_text: ans.text || "",
        rating_value: ans.rating,
      }));

      const { error: ansError } = await supabase.from("response_answers").insert(answerRows);
      if (ansError) throw ansError;

      setSubmitted(true);
      toast.success("Form submitted successfully!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (alreadySubmitted || submitted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="border-0 shadow-lg max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">
              {submitted ? "Thank You!" : "Already Submitted"}
            </h2>
            <p className="text-muted-foreground">
              {submitted
                ? "Your response has been recorded successfully."
                : "You have already submitted this form."}
            </p>
            <Button onClick={() => navigate("/dashboard")} className="gradient-primary">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!form || sections.length === 0) return null;

  const totalQuestions = sections.reduce((acc, s) => acc + s.questions.length, 0);
  const answeredQuestions = Object.values(answers).filter(
    (a) => a.text?.trim() || a.rating
  ).length;
  const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

  const section = sections[currentSection];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Form Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{form.title}</h1>
        {form.description && <p className="text-muted-foreground">{form.description}</p>}
        {form.note && (
          <div className="bg-accent rounded-lg p-3 text-sm text-accent-foreground">
            <strong>Note:</strong> {form.note}
          </div>
        )}
      </div>

      {/* Auto-filled info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>{" "}
              <span className="font-medium">{profile?.full_name || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Department:</span>{" "}
              <span className="font-medium">{profile?.department || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Job Title:</span>{" "}
              <span className="font-medium">{profile?.job_title || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date of Joining:</span>{" "}
              <span className="font-medium">{profile?.date_of_joining || "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Section {currentSection + 1} of {sections.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Current Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{section.title}</CardTitle>
          {section.questions.some((q) => q.question_type === "rating") && (
            <div className="mt-2 rounded-lg bg-accent p-3 text-xs text-accent-foreground space-y-1">
              <p className="font-medium">Rating Scale (1–5):</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <span>1 = Outstanding</span>
                <span>4 = Below Average</span>
                <span>2 = Good</span>
                <span>5 = Poor</span>
                <span>3 = Average</span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {section.questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-sm font-medium">
                {q.question_text}
                {q.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {q.question_type === "text" && (
                <Input
                  value={answers[q.id]?.text ?? ""}
                  onChange={(e) => updateAnswer(q.id, "text", e.target.value)}
                  placeholder="Your answer"
                />
              )}

              {q.question_type === "textarea" && (
                <Textarea
                  value={answers[q.id]?.text ?? ""}
                  onChange={(e) => updateAnswer(q.id, "text", e.target.value)}
                  placeholder="Your answer"
                  rows={3}
                />
              )}

              {q.question_type === "dropdown" && (
                <Select
                  value={answers[q.id]?.text ?? ""}
                  onValueChange={(v) => updateAnswer(q.id, "text", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(q.options) ? (q.options as string[]) : []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {q.question_type === "rating" && (
                <StarRating
                  value={answers[q.id]?.rating ?? 0}
                  onChange={(v) => updateAnswer(q.id, "rating", v)}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentSection((c) => c - 1)}
          disabled={currentSection === 0}
        >
          Previous
        </Button>
        {currentSection < sections.length - 1 ? (
          <Button onClick={() => setCurrentSection((c) => c + 1)} className="gradient-primary">
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} className="gradient-primary">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Submit
          </Button>
        )}
      </div>
    </div>
  );
};

export default FormFill;
