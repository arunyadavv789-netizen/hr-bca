import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Plus, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

const Dashboard = () => {
  const { isHR, user } = useAuth();
  const navigate = useNavigate();
  const [formCount, setFormCount] = useState(0);
  const [responseCount, setResponseCount] = useState(0);
  const [employeeForms, setEmployeeForms] = useState<Tables<"forms">[]>([]);
  const [submittedFormIds, setSubmittedFormIds] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      if (isHR) {
        const [fc, rc] = await Promise.all([
          supabase.from("forms").select("id", { count: "exact", head: true }),
          supabase.from("form_responses").select("id", { count: "exact", head: true }),
        ]);
        setFormCount(fc.count ?? 0);
        setResponseCount(rc.count ?? 0);
      } else if (user) {
        const [formsRes, responsesRes] = await Promise.all([
          supabase.from("forms").select("*").eq("status", "published").order("created_at", { ascending: false }),
          supabase.from("form_responses").select("form_id").eq("user_id", user.id),
        ]);
        setEmployeeForms(formsRes.data ?? []);
        setSubmittedFormIds((responsesRes.data ?? []).map((r) => r.form_id));
      }
    };
    load();
  }, [isHR, user]);

  if (isHR) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Overview of your appraisal platform</p>
          </div>
          <Button onClick={() => navigate("/forms/new")} className="gap-2 gradient-primary">
            <Plus className="h-4 w-4" /> New Form
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/forms")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Forms</CardTitle>
              <FileText className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{formCount}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/responses")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Responses</CardTitle>
              <BarChart3 className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{responseCount}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Employee view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Forms</h1>
        <p className="text-muted-foreground text-sm mt-1">Available appraisal forms</p>
      </div>

      {employeeForms.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No forms available at the moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {employeeForms.map((form) => {
            const submitted = submittedFormIds.includes(form.id);
            return (
              <Card key={form.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <h3 className="font-semibold text-foreground">{form.title}</h3>
                    {form.description && (
                      <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
                    )}
                  </div>
                  {submitted ? (
                    <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                      Submitted ✓
                    </span>
                  ) : (
                    <Button
                      onClick={() => navigate(`/form/${form.id}`)}
                      className="gap-2 gradient-primary"
                    >
                      <ExternalLink className="h-4 w-4" /> Fill Form
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
