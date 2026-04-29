CREATE TABLE public.response_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID NOT NULL UNIQUE,
  overall_score NUMERIC(3,1) NOT NULL,
  verdict TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.response_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can view analysis"
ON public.response_analysis FOR SELECT
TO authenticated
USING (is_hr(auth.uid()));

CREATE POLICY "HR can insert analysis"
ON public.response_analysis FOR INSERT
TO authenticated
WITH CHECK (is_hr(auth.uid()));

CREATE POLICY "HR can update analysis"
ON public.response_analysis FOR UPDATE
TO authenticated
USING (is_hr(auth.uid()));

CREATE POLICY "HR can delete analysis"
ON public.response_analysis FOR DELETE
TO authenticated
USING (is_hr(auth.uid()));

CREATE TRIGGER update_response_analysis_updated_at
BEFORE UPDATE ON public.response_analysis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();