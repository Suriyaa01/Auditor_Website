import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useIsAdmin() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;

      // สำรอง: ถ้า user_metadata.is_admin === true ก็ถือว่า admin
      const metaAdmin = !!(user?.user_metadata?.is_admin);

      let profileAdmin = false;
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        profileAdmin = prof?.role === "admin";
      }

      setIsAdmin(metaAdmin || profileAdmin);
      setLoading(false);
    })();
  }, []);

  return { loading, isAdmin };
}
