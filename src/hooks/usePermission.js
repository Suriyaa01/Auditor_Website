import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { message } from "antd";

/**
 * ใช้ตรวจสิทธิ์ของ "ผู้ใช้ปัจจุบัน" ในหน้าใดหน้าหนึ่ง
 * @param {string} pageCode เช่น "projects"
 * @returns { loading, perms, can }
 *   perms = { can_view, can_add, can_edit, can_delete, can_print }
 *   can(action) => boolean
 */
export function usePermission(pageCode) {
  const [loading, setLoading] = useState(true);
  const [perms, setPerms] = useState({
    can_view: false,
    can_add: false,
    can_edit: false,
    can_delete: false,
    can_print: false,
  });

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      // 1) หา page_id
      const { data: pageRow, error: ep } = await supabase
        .from("pages")
        .select("id")
        .eq("code", pageCode)
        .maybeSingle();
      if (ep) {
        setLoading(false);
        return message.error(ep.message);
      }
      if (!pageRow) {
        setLoading(false);
        return; // หน้าไม่ถูกนิยาม
      }

      // 2) หา role ของ user ปัจจุบัน
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) { setLoading(false); return; }

      const { data: ur, error: eur } = await supabase
        .from("user_roles").select("role_id").eq("user_id", userId);
      if (eur) { setLoading(false); return message.error(eur.message); }

      const roleIds = (ur || []).map((x) => x.role_id);
      if (!roleIds.length) { setLoading(false); return; }

      // 3) รวมสิทธิ์ของทุก role (OR)
      const { data: rp, error: erp } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("page_id", pageRow.id)
        .in("role_id", roleIds);
      if (erp) { setLoading(false); return message.error(erp.message); }

      const merged = rp.reduce((acc, row) => ({
        can_view: acc.can_view || row.can_view,
        can_add: acc.can_add || row.can_add,
        can_edit: acc.can_edit || row.can_edit,
        can_delete: acc.can_delete || row.can_delete,
        can_print: acc.can_print || row.can_print,
      }), { can_view: false, can_add: false, can_edit: false, can_delete: false, can_print: false });

      setPerms(merged);
      setLoading(false);
    };
    run();
  }, [pageCode]);

  const can = (action) => !!perms[action];

  return { loading, perms, can };
}
