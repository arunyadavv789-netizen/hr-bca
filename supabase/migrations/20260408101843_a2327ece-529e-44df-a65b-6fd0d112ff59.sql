
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('hr_manager', 'hr', 'employee');

-- Create form status enum
CREATE TYPE public.form_status AS ENUM ('draft', 'published', 'closed');

-- Create question type enum
CREATE TYPE public.question_type AS ENUM ('text', 'textarea', 'dropdown', 'rating');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  department TEXT DEFAULT '',
  job_title TEXT DEFAULT '',
  date_of_joining DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create forms table
CREATE TABLE public.forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status form_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create form_sections table
CREATE TABLE public.form_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create form_questions table
CREATE TABLE public.form_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES public.form_sections(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  display_order INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create form_responses table
CREATE TABLE public.form_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (form_id, user_id)
);

-- Create response_answers table
CREATE TABLE public.response_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID REFERENCES public.form_responses(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.form_questions(id) ON DELETE CASCADE NOT NULL,
  answer_text TEXT DEFAULT '',
  rating_value INT CHECK (rating_value IS NULL OR (rating_value >= 1 AND rating_value <= 5)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_answers ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Helper: check if user is HR (hr_manager or hr)
CREATE OR REPLACE FUNCTION public.is_hr(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('hr_manager', 'hr')
  )
$$;

-- Profiles policies
CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Anyone authenticated can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR managers can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'hr_manager'));

-- Forms policies
CREATE POLICY "Anyone authenticated can view published forms" ON public.forms FOR SELECT TO authenticated USING (status = 'published' OR public.is_hr(auth.uid()));
CREATE POLICY "HR can create forms" ON public.forms FOR INSERT TO authenticated WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "HR can update forms" ON public.forms FOR UPDATE TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "HR can delete forms" ON public.forms FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));

-- Form sections policies
CREATE POLICY "Anyone can view sections of accessible forms" ON public.form_sections FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.forms WHERE forms.id = form_id AND (forms.status = 'published' OR public.is_hr(auth.uid()))));
CREATE POLICY "HR can manage sections" ON public.form_sections FOR INSERT TO authenticated WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "HR can update sections" ON public.form_sections FOR UPDATE TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "HR can delete sections" ON public.form_sections FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));

-- Form questions policies
CREATE POLICY "Anyone can view questions of accessible forms" ON public.form_questions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.form_sections fs JOIN public.forms f ON f.id = fs.form_id WHERE fs.id = section_id AND (f.status = 'published' OR public.is_hr(auth.uid()))));
CREATE POLICY "HR can manage questions" ON public.form_questions FOR INSERT TO authenticated WITH CHECK (public.is_hr(auth.uid()));
CREATE POLICY "HR can update questions" ON public.form_questions FOR UPDATE TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "HR can delete questions" ON public.form_questions FOR DELETE TO authenticated USING (public.is_hr(auth.uid()));

-- Form responses policies
CREATE POLICY "HR can view all responses" ON public.form_responses FOR SELECT TO authenticated USING (public.is_hr(auth.uid()));
CREATE POLICY "Users can view own responses" ON public.form_responses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can submit responses" ON public.form_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Response answers policies
CREATE POLICY "HR can view all answers" ON public.response_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.form_responses fr WHERE fr.id = response_id AND public.is_hr(auth.uid())));
CREATE POLICY "Users can view own answers" ON public.response_answers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.form_responses fr WHERE fr.id = response_id AND fr.user_id = auth.uid()));
CREATE POLICY "Users can submit answers" ON public.response_answers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.form_responses fr WHERE fr.id = response_id AND fr.user_id = auth.uid()));

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, '')
  );
  -- Default role: employee
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
