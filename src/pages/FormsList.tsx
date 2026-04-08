import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Copy, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const FormsList = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<Tables<"forms">[]>([]);

  useEffect(() => {
    supabase.from("forms").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setForms(data ?? []);
    });
  }, []);

  const copyLink = (formId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/form/${formId}`);
    toast.success("Form link copied!");
  };

  const statusColor = (s: string) => {
    if (s === "published") return "bg-green-50 text-green-700 border-green-200";
    if (s === "closed") return "bg-red-50 text-red-700 border-red-200";
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Forms</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your appraisal forms</p>
        </div>
        <Button onClick={() => navigate("/forms/new")} className="gap-2 gradient-primary">
          <Plus className="h-4 w-4" /> New Form
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No forms created yet</p>
            <Button onClick={() => navigate("/forms/new")} className="mt-4 gradient-primary">
              Create your first form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {forms.map((form) => (
            <Card key={form.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{form.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Created {new Date(form.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={statusColor(form.status)}>
                    {form.status}
                  </Badge>
                  {form.status === "published" && (
                    <Button variant="ghost" size="icon" onClick={() => copyLink(form.id)} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${form.id}`)}>
                    <ExternalLink className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormsList;
