import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AppRole = "hr_manager" | "hr" | "employee";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Tables<"profiles"> | null;
  roles: AppRole[];
  isHR: boolean;
  isProfileComplete: boolean;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const clearUserData = () => {
    setProfile(null);
    setRoles([]);
  };

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const fetchedProfile = profileRes.data ?? null;
    setProfile(fetchedProfile);
    setRoles((rolesRes.data ?? []).map((r) => r.role));
    return fetchedProfile;
  };

  const syncAuthState = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      clearUserData();
      setIsLoading(false);
      return;
    }

    clearUserData();
    setTimeout(() => {
      fetchUserData(nextSession.user.id).finally(() => {
        setIsLoading(false);
      });
    }, 0);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncAuthState(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const isHR = roles.includes("hr_manager") || roles.includes("hr");
  const isProfileComplete = !!(profile?.full_name && profile?.department && profile?.job_title && profile?.date_of_joining);

  return (
    <AuthContext.Provider value={{ session, user, profile, roles, isHR, isProfileComplete, isLoading, signInWithEmail, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
