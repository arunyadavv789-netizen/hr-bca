CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
BEGIN
  IF NEW.email IN ('hr@bosscoderacademy.com', 'rajat.garg@bosscoderacademy.com', 'manish.garg@bosscoderacademy.com', 'harsh.bhardwaj@bosscoderacademy.com') THEN
    _role := 'hr_manager';
  ELSE
    _role := 'employee';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, department, job_title, date_of_joining)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'department', ''),
    COALESCE(NEW.raw_user_meta_data->>'job_title', ''),
    CASE 
      WHEN NEW.raw_user_meta_data->>'date_of_joining' IS NOT NULL 
        AND NEW.raw_user_meta_data->>'date_of_joining' != ''
      THEN (NEW.raw_user_meta_data->>'date_of_joining')::date
      ELSE NULL
    END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  RETURN NEW;
END;
$function$;

-- Upgrade existing harsh.bhardwaj account to hr_manager if it exists
UPDATE public.user_roles
SET role = 'hr_manager'
WHERE user_id IN (
  SELECT user_id FROM public.profiles WHERE email = 'harsh.bhardwaj@bosscoderacademy.com'
);