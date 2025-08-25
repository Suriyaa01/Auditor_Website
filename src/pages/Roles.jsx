// src/pages/Roles.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserSwitchOutlined,
  SearchOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "user", label: "User" },
];

function displayNameOf(row) {
  // เลือก field ที่มีจริง
  return row.email || row.username || row.handle || row.name || row.full_name || row.id;
}

export default function Roles() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);           // current user's profile row
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");
  const aliveRef = useRef(true);

  const isAdmin = me?.role === "admin";

  const fetchMe = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) {
      setMe(null);
      return;
    }
    // ใช้ select("*") เพื่อไม่พังถ้าบางคอลัมน์ไม่อยู่
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw error;
    setMe(data || null);
  };

  const fetchAll = async () => {
    setLoading(true);
    setErr("");
    try {
      // ดึงทุกคอลัมน์ที่มีจริง แล้วค่อยกรอง/จัดรูปฝั่ง client
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("id", { ascending: true }); // order ด้วย id ที่ชัวร์ว่ามี
      if (error) throw error;
      if (aliveRef.current) setRows(data || []);
    } catch (e) {
      console.error(e);
      if (aliveRef.current) setErr(e.message || String(e));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      await fetchMe();
      await fetchAll();
    })();
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // กรองฝั่ง client (เลี่ยงใส่ OR กับคอลัมน์ที่อาจไม่มี)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (displayNameOf(r) || "").toLowerCase();
      const role = (r.role || "").toLowerCase();
      return name.includes(q) || role.includes(q);
    });
  }, [rows, search]);

  const updateRole = async (targetUserId, newRole) => {
    try {
      if (!isAdmin) {
        return message.warning("เฉพาะ Admin เท่านั้นที่แก้สิทธิผู้ใช้อื่นได้");
      }
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", targetUserId);
      if (error) throw error;
      message.success("อัปเดตสิทธิสำเร็จ");
      fetchAll();
    } catch (e) {
      console.error(e);
      message.error(e.message || "อัปเดตสิทธิไม่สำเร็จ");
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "User",
        dataIndex: "email",
        render: (_, row) => (
          <Space>
            {row.id === me?.id && <Tag color="blue">You</Tag>}
            <Text>{displayNameOf(row)}</Text>
          </Space>
        ),
      },
      {
        title: "Role",
        dataIndex: "role",
        width: 260,
        render: (role, row) => {
          const canEdit = isAdmin && row.id !== me?.id;
          if (!canEdit) {
            const color =
              role === "admin" ? "red" : role === "editor" ? "gold" : "default";
            return <Tag color={color}>{role || "user"}</Tag>;
          }
          return (
            <Select
              style={{ width: 200 }}
              value={role || "user"}
              options={ROLE_OPTIONS}
              onChange={(val) => updateRole(row.id, val)}
            />
          );
        },
      },
    ],
    [isAdmin, me]
  );

  return (
    <>
      <Space
        style={{
          width: "100%",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Space direction="vertical" size={0}>
          <Title level={3} style={{ margin: 0 }}>
            Roles & Access
          </Title>
          <Text type="secondary">Admin สามารถเปลี่ยนสิทธิของผู้ใช้อื่นได้</Text>
        </Space>
        <Space wrap>
          <Input
            allowClear
            style={{ width: 260 }}
            prefix={<SearchOutlined />}
            placeholder="ค้นหา user/role"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>
            Refresh
          </Button>
          <Tag icon={<SafetyCertificateOutlined />} color={isAdmin ? "red" : "default"}>
            {isAdmin ? "You are ADMIN" : "You are not admin"}
          </Tag>
        </Space>
      </Space>

      {err && (
        <Alert
          type="error"
          showIcon
          message="เกิดข้อผิดพลาด"
          description={<pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{err}</pre>}
          style={{ marginBottom: 12 }}
        />
      )}

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Space direction="vertical" align="center">
                <UserSwitchOutlined />
                <Text type="secondary">ไม่พบข้อมูลผู้ใช้</Text>
              </Space>
            ),
          }}
        />
      </Card>
    </>
  );
}
