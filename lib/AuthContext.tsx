import React, { createContext, useState, useEffect, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserProfile = {
  id: string;
  email: string;
  nickname: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  points: number;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

// 类型守卫函数，确保布尔值
function ensureBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return false;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isAdmin: false as boolean,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        const falseValue: boolean = false;
        setIsAdmin(falseValue);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    // 1. Fetch basic profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return;
    }

    // 2. Calculate total points from history
    const { data: historyData, error: historyError } = await supabase
      .from('points_history')
      .select('amount')
      .eq('user_id', userId);

    let totalPoints = 0;
    if (historyData) {
      totalPoints = historyData.reduce((sum, record) => sum + record.amount, 0);
    }

    if (profileData) {
      const fullProfile = { ...profileData, points: totalPoints } as UserProfile;
      setProfile(fullProfile);
      // 明确转换为布尔值
      const adminStatus: boolean = ensureBoolean(profileData.is_admin);
      setIsAdmin(adminStatus);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    const falseValue: boolean = false;
    setIsAdmin(falseValue);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isAdmin, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
