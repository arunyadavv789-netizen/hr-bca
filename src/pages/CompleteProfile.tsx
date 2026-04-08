import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const DEPARTMENTS = ["Tech", "Product", "Operations", "Sales", "Placement", "Marketing", "Design", "HR"];

const CompleteProfile = () => {
  const { session, user, profile, isLoading } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [department, setDepartment] = useState(profile?.department || "");
  const [jobTitle, setJobTitle] = useState(profile?.job_title || "");
  const [dateOfJoining, setDateOfJoining] = useState(profile?.date_of_joining || "");
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // If profile is already complete, redirect to dashboard
  if (profile?.full_name && profile?.department && profile?.job_title && profile?.date_of_joining) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !department || !jobTitle.trim() || !dateOfJoining) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          department,
          job_title: jobTitle.trim(),
          date_of_joining: dateOfJoining,
        })
        .eq("user_id", user!.id);

      if (error) throw error;

      toast.success("Profile completed!");
      // Force reload to refresh auth context
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Bosscoder Academy" className="h-14 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-center text-secondary">Complete Your Profile</h1>
            <p className="text-sm text-muted-foreground text-center mt-1">
              Please fill in your details to continue
            </p>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground text-center">
              Signed in as <span className="font-medium">{user?.email}</span>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department <span className="text-destructive">*</span></Label>
                <Select value={department} onValueChange={setDepartment} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title <span className="text-destructive">*</span></Label>
                <Input
                  id="jobTitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="doj">Date of Joining <span className="text-destructive">*</span></Label>
                <Input
                  id="doj"
                  type="date"
                  value={dateOfJoining}
                  onChange={(e) => setDateOfJoining(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full h-11 gradient-primary" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile;
