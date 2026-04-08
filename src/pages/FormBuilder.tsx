import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, Save, Send, ArrowLeft, Copy } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type QuestionType = Database["public"]["Enums"]["question_type"];

interface Question {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  required: boolean;
  display_order: number;
}

interface Section {
  id?: string;
  title: string;
  display_order: number;
  questions: Question[];
}

const FormBuilder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = !!id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [sections, setSections] = useState<Section[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) loadForm();
  }, [id]);

  const loadForm = async () => {
    const { data: form } = await supabase.from("forms").select("*").eq("id", id!).single();
    if (!form) return navigate("/forms");
    setTitle(form.title);
    setDescription(form.description ?? "");
    setNote(form.note ?? "");
    setStatus(form.status as "draft" | "published");

    const { data: secs } = await supabase.from("form_sections").select("*").eq("form_id", id!).order("display_order");

    if (secs) {
      const sectionsWithQuestions: Section[] = [];
      for (const sec of secs) {
        const { data: qs } = await supabase
          .from("form_questions")
          .select("*")
          .eq("section_id", sec.id)
          .order("display_order");
        sectionsWithQuestions.push({
          id: sec.id,
          title: sec.title,
          display_order: sec.display_order,
          questions: (qs ?? []).map((q) => ({
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
            required: q.required,
            display_order: q.display_order,
          })),
        });
      }
      setSections(sectionsWithQuestions);
    }
  };

  const addSection = () => {
    setSections([...sections, { title: "", display_order: sections.length, questions: [] }]);
  };

  const removeSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
  };

  const updateSection = (idx: number, field: string, val: string) => {
    const updated = [...sections];
    (updated[idx] as any)[field] = val;
    setSections(updated);
  };

  const addQuestion = (secIdx: number) => {
    const updated = [...sections];
    updated[secIdx].questions.push({
      question_text: "",
      question_type: "text",
      options: [],
      required: true,
      display_order: updated[secIdx].questions.length,
    });
    setSections(updated);
  };

  const removeQuestion = (secIdx: number, qIdx: number) => {
    const updated = [...sections];
    updated[secIdx].questions = updated[secIdx].questions.filter((_, i) => i !== qIdx);
    setSections(updated);
  };

  const updateQuestion = (secIdx: number, qIdx: number, field: string, val: any) => {
    const updated = [...sections];
    (updated[secIdx].questions[qIdx] as any)[field] = val;
    setSections(updated);
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) return toast.error("Form title is required");
    if (sections.length === 0) return toast.error("Add at least one section");

    setSaving(true);
    try {
      let formId = id;
      const formStatus = publish ? "published" : status;

      if (isEdit) {
        await supabase.from("forms").update({ title, description, note, status: formStatus }).eq("id", id!);
        // Delete existing sections/questions to re-create
        await supabase.from("form_sections").delete().eq("form_id", id!);
      } else {
        const { data: newForm, error } = await supabase
          .from("forms")
          .insert({ title, description, note, status: formStatus, created_by: user!.id })
          .select()
          .single();
        if (error) throw error;
        formId = newForm.id;
      }

      // Insert sections & questions
      for (let si = 0; si < sections.length; si++) {
        const sec = sections[si];
        const { data: newSec } = await supabase
          .from("form_sections")
          .insert({ form_id: formId!, title: sec.title, display_order: si })
          .select()
          .single();

        if (newSec && sec.questions.length > 0) {
          await supabase.from("form_questions").insert(
            sec.questions.map((q, qi) => ({
              section_id: newSec.id,
              question_text: q.question_text,
              question_type: q.question_type,
              options: q.options,
              required: q.required,
              display_order: qi,
            })),
          );
        }
      }

      toast.success(publish ? "Form published!" : "Form saved!");
      navigate("/forms");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (id) {
      navigator.clipboard.writeText(`${window.location.origin}/form/${id}`);
      toast.success("Form link copied!");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/forms")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{isEdit ? "Edit Form" : "Create Form"}</h1>
        </div>
        <div className="flex gap-2">
          {isEdit && status === "published" && (
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="h-4 w-4 mr-1" /> Copy Link
            </Button>
          )}
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Save Draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="gradient-primary">
            <Send className="h-4 w-4 mr-1" /> Publish
          </Button>
        </div>
      </div>

      {/* Form Details */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Form Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual Appraisal 2026" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this form"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Note for employees</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. This form is only eligible for employees who have completed 6 months (who have joined in or before September 2025)"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {sections.map((section, si) => (
        <Card key={si} className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 pb-4">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <div className="flex-1">
              <Input
                value={section.title}
                onChange={(e) => updateSection(si, "title", e.target.value)}
                placeholder="Section title (e.g. Work Impact)"
                className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeSection(si)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.questions.map((q, qi) => (
              <div key={qi} className="flex gap-3 items-start p-4 rounded-lg bg-muted/50">
                <div className="flex-1 space-y-3">
                  <Input
                    value={q.question_text}
                    onChange={(e) => updateQuestion(si, qi, "question_text", e.target.value)}
                    placeholder="Question text"
                  />
                  <div className="flex gap-4 items-center flex-wrap">
                    <Select value={q.question_type} onValueChange={(v) => updateQuestion(si, qi, "question_type", v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Short Text</SelectItem>
                        <SelectItem value="textarea">Long Text</SelectItem>
                        <SelectItem value="dropdown">Dropdown</SelectItem>
                        <SelectItem value="rating">Star Rating (1-5)</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <Checkbox checked={q.required} onCheckedChange={(c) => updateQuestion(si, qi, "required", !!c)} />
                      <span className="text-sm text-muted-foreground">Required</span>
                    </div>
                  </div>

                  {q.question_type === "dropdown" && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Options (comma separated)</Label>
                      <Input
                        value={q.options.join(", ")}
                        onChange={(e) =>
                          updateQuestion(
                            si,
                            qi,
                            "options",
                            e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          )
                        }
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeQuestion(si, qi)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={() => addQuestion(si)} className="gap-2">
              <Plus className="h-4 w-4" /> Add Question
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addSection} className="gap-2 w-full border-dashed h-12">
        <Plus className="h-4 w-4" /> Add Section
      </Button>
    </div>
  );
};

export default FormBuilder;
