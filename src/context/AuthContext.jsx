import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null); // 'admin' | 'user' | null
  const [loading, setLoading] = useState(true);

  async function loadSessionAndProfile() {
    // โหลด session
    const { data } = await supabase.auth.getSession();
    const sess = data?.session ?? null;
    setSession(sess);

    // โหลด role จาก profiles (ถ้ามี session)
    if (sess?.user?.id) {
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sess.user.id)
        .maybeSingle();
      if (!error && prof?.role) setRole(prof.role);
      else setRole(null);
    } else {
      setRole(null);
    }
  }

  useEffect(() => {
    loadSessionAndProfile().finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
      // โหลดโปรไฟล์ใหม่เมื่อเปลี่ยน session
      if (sess?.user?.id) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", sess.user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (!error && data?.role) setRole(data.role);
            else setRole(null);
          });
      } else {
        setRole(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    role,                         // <-- ใช้ role ได้จาก context
    isAdmin: role === "admin",    // helper
    signOut: () => supabase.auth.signOut(),
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
