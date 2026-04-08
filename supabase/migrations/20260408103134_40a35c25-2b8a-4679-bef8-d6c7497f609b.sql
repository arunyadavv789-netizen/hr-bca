
-- Fix 1: profiles SELECT — HR can view all, users only their own
DROP POLICY "Anyone authenticated can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or HR can view all" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_hr(auth.uid()));

-- Fix 2: user_roles SELECT — users see own role, HR sees all
DROP POLICY "Anyone authenticated can view roles" ON public.user_roles;
CREATE POLICY "Users can view own role or HR can view all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_hr(auth.uid()));
