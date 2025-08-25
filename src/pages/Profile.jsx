import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Row,
  Space,
  Typography,
  Upload,
} from "antd";
import {
  UserOutlined,
  UploadOutlined,
  SaveOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function Profile() {
  const [form] = Form.useForm();
  const [authUser, setAuthUser] = useState(null);   // auth session user
  const [profile, setProfile] = useState(null);     // row from public.profiles
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // ชื่อที่จะแสดง (ถ้าเว้นไว้ใช้ email/id แทน)
  const displayName = useMemo(() => {
    if (!profile) return "";
    const { first_name, last_name, nickname, email, id } = profile;
    if (first_name || last_name) return [first_name, last_name].filter(Boolean).join(" ");
    if (nickname) return nickname;
    return email || id;
  }, [profile]);

  const load = async () => {
    try {
      setLoading(true);
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = userData?.user;
      setAuthUser(user || null);

      if (!user) {
        setProfile(null);
        form.resetFields();
        return;
      }

      // โหลดโปรไฟล์ (select * เพื่อไม่พังถ้าบางคอลัมน์ไม่มี)
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;

      // ถ้าไม่มีแถว ให้เตรียมค่าเริ่มต้น
      const row =
        data || {
          id: user.id,
          email: user.email, // ใส่ค่าเริ่มต้นจาก auth
          first_name: "",
          last_name: "",
          nickname: "",
          tel: "",
          avatar_url: "",
        };

      setProfile(row);
      form.setFieldsValue({
        first_name: row.first_name || "",
        last_name: row.last_name || "",
        nickname: row.nickname || "",
        email: row.email || user.email || "",
        tel: row.tel || "",
      });
    } catch (e) {
      console.error(e);
      message.error(e.message || "โหลดโปรไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // อัปโหลดรูปโปรไฟล์ไปที่ bucket 'avatars' path: {user_id}/{timestamp-filename}
  const handleUpload = async ({ file, onSuccess, onError }) => {
    try {
      if (!authUser?.id) throw new Error("ยังไม่ได้ล็อกอิน");

      const isImage =
        file.type?.startsWith("image/") ||
        /\.(png|jpg|jpeg|webp|gif|bmp)$/i.test(file.name);
      if (!isImage) {
        throw new Error("กรุณาเลือกรูปภาพเท่านั้น");
      }

      setUploading(true);

      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `${authUser.id}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (upErr) throw upErr;

      // สร้าง public URL
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = pub?.publicUrl;

      // บันทึก avatar_url ลง profiles
      const { error: upProfileErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", authUser.id);
      if (upProfileErr) throw upProfileErr;

      setProfile((p) => ({ ...(p || {}), avatar_url: publicUrl }));
      message.success("อัปโหลดรูปโปรไฟล์สำเร็จ");
      onSuccess?.({});
    } catch (e) {
      console.error("Upload avatar error:", e);
      message.error(e.message || "อัปโหลดรูปไม่สำเร็จ");
      onError?.(e);
    } finally {
      setUploading(false);
    }
  };

  const onFinish = async (values) => {
    try {
      if (!authUser?.id) throw new Error("ยังไม่ได้ล็อกอิน");
      setLoading(true);

      const payload = {
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        nickname: values.nickname || null,
        email: values.email || null,
        tel: values.tel || null,
      };

      // ส่งเป็น array และเรียก select() เพื่อให้ได้ row ที่บันทึกกลับมา
      const { data, error } = await supabase
        .from("profiles")
        .upsert([{ id: authUser.id, ...payload }])
        .select()
        .single();

      console.log("profiles.upsert ->", { data, error });
      if (error) throw error;

      message.success("บันทึกโปรไฟล์สำเร็จ");
      setProfile(data);
      form.setFieldsValue({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        nickname: data.nickname || "",
        email: data.email || "",
        tel: data.tel || "",
      });
    } catch (e) {
      console.error("Save profile error:", e);
      message.error(e.message || "บันทึกโปรไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Space
        style={{
          width: "100%",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Space direction="vertical" size={0}>
          <Title level={3} style={{ margin: 0 }}>My Profile</Title>
          <Text type="secondary">จัดการรูปภาพโปรไฟล์และข้อมูลติดต่อ</Text>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Space>
      </Space>

      <Card loading={loading}>
        <Row gutter={[16, 16]}>
          {/* ซ้าย: รูปโปรไฟล์ */}
          <Col xs={24} md={8} lg={6}>
            <Space direction="vertical" align="center" style={{ width: "100%" }}>
              <Avatar
                size={128}
                src={profile?.avatar_url || undefined}
                icon={!profile?.avatar_url ? <UserOutlined /> : undefined}
              />
              <Upload
                accept="image/*"
                maxCount={1}
                showUploadList={false}
                customRequest={handleUpload}
              >
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  loading={uploading}
                >
                  อัปโหลดรูปใหม่
                </Button>
              </Upload>
              <Text type="secondary">
                แสดงชื่อ: <b>{displayName || "-"}</b>
              </Text>
            </Space>
          </Col>

          {/* ขวา: ฟอร์มข้อมูล */}
          <Col xs={24} md={16} lg={18}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              disabled={loading || uploading}
            >
              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item label="ชื่อ (First name)" name="first_name">
                    <Input placeholder="เช่น Somchai" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="นามสกุล (Last name)" name="last_name">
                    <Input placeholder="เช่น Jaidee" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item label="ชื่อเล่น (Nickname)" name="nickname">
                    <Input placeholder="เช่น Tom" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="เบอร์โทร (TEL)"
                    name="tel"
                    rules={[
                      {
                        pattern: /^[0-9+\-\s]{6,20}$/,
                        message: "รูปแบบเบอร์ไม่ถูกต้อง",
                      },
                    ]}
                  >
                    <Input placeholder="เช่น 0812345678" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Email (โปรไฟล์)"
                name="email"
                rules={[
                  { type: "email", message: "อีเมลไม่ถูกต้อง" },
                ]}
              >
                <Input placeholder="example@email.com" />
              </Form.Item>

              <Space>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                  บันทึก
                </Button>
              </Space>
            </Form>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
