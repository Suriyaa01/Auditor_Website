import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, Checkbox, Divider, Typography, message } from "antd";
import { MailOutlined, LockOutlined, GoogleOutlined, LoadingOutlined } from "@ant-design/icons";
import { supabase } from "../lib/supabase";

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [mailSending, setMailSending] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(null); // timestamp (ms) เมื่อล็อกอยู่
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0); // เพิ่ม state เพื่อบังคับ re-render ทุกวินาทีเมื่อล็อก

  // เช็กว่ากำลังถูกล็อกปุ่มอยู่ไหม
  const isLocked = !!(lockUntil && Date.now() < lockUntil);
  const lockRemainSec = isLocked
    ? Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000))
    : 0;

  // ให้เวลาเดินลงทุก 1 วิ (ไว้แสดง “ลองใหม่ใน Xs”)
  useEffect(() => {
    if (!isLocked) return;
    const t = setInterval(() => setTick((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isLocked]);

  const normalizeAuthError = (err) => {
    const msg = (err?.message || "").toLowerCase();
    if (msg.includes("email not confirmed")) {
      return "อีเมลนี้ยังไม่ได้ยืนยัน โปรดเช็คกล่องจดหมายแล้วกดยืนยันก่อน";
    }
    if (msg.includes("invalid login credentials")) {
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    }
    if (msg.includes("provider is not enabled")) {
      return "ยังไม่ได้เปิดใช้งานผู้ให้บริการ OAuth (เช่น Google) ใน Supabase → Auth → Providers";
    }
    return err?.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
  };

  const handlePasswordChange = () => {
    // เคลียร์ error ของช่อง password ทันทีเมื่อผู้ใช้พิมพ์ใหม่
    form.setFields([{ name: "password", errors: [] }]);
  };

  const onFinish = async ({ email, password }) => {
    setLoading(true);
    try {
      // supabase v2 (preferred)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      // supabase v1 (if above throws) use:
      // const { user, session, error } = await supabase.auth.signIn({ email, password });

      if (error) {
        console.error("Sign-in error:", error);
        message.error(error.message || "เข้าสู่ระบบไม่สำเร็จ");
        // ช่วยบอกผู้ใช้ถ้าเป็นปัญหาเรื่องยืนยันอีเมล
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("confirm") || msg.includes("verify") || msg.includes("confirmed")) {
          message.info("อีเมลยังไม่ยืนยัน — ตรวจสอบกล่องจดหมาย หรือปิด email confirmations ใน Supabase (เฉพาะตอนพัฒนา)");
        }
        return;
      }

      const user = data?.user || (typeof user !== "undefined" ? user : null); // รองรับ v2/v1
      // ตรวจสอบฟิลด์ยืนยันอีเมล (ชื่อฟิลด์อาจต่างกัน ขึ้นกับเวอร์ชัน)
      const emailConfirmed =
        user?.email_confirmed_at || user?.confirmed_at || user?.identities?.length > 0;
      if (user && !emailConfirmed) {
        message.info("บัญชียังไม่ได้ยืนยันอีเมล");
        return;
      }

      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      message.error("เกิดข้อผิดพลาด โปรดลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        // options: { redirectTo: window.location.origin }
      });
      setLoading(false);
      if (error) {
        console.error("OAuth error:", error);
        message.error(normalizeAuthError(error));
      }
      // OAuth จะ redirect เอง
    } catch (e) {
      setLoading(false);
      message.error("ไม่สามารถเริ่มการเข้าสู่ระบบด้วย Google ได้");
    }
  };

  const handleResetPassword = async () => {
    const email = (form.getFieldValue("email") || "").trim();
    if (!email) {
      message.info("กรุณากรอกอีเมลในช่อง Email ก่อน");
      return;
    }
    setMailSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/login",
    });
    setMailSending(false);
    if (error) return message.error(error.message || "ส่งลิงก์ไม่สำเร็จ");
    message.success("ส่งลิงก์รีเซ็ตไปที่อีเมลแล้ว");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4">
      <Card style={{ width: 420, borderRadius: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Title level={3} style={{ marginBottom: 0 }}>
            Welcome Back
          </Title>
          <Text type="secondary">
            เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน หรือ Google
          </Text>
        </div>

        <Form
          layout="vertical"
          form={form}
          name="login"
          onFinish={onFinish}
          initialValues={{ remember: true }}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "กรุณากรอกอีเมล" },
              { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
            ]}
          >
            <Input
              size="large"
              prefix={<MailOutlined />}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "กรุณากรอกรหัสผ่าน" }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder="••••••••"
              autoComplete="current-password"
              onChange={handlePasswordChange}
            />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>จดจำฉันไว้ในเครื่องนี้</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              disabled={loading || isLocked}
              icon={loading ? <LoadingOutlined /> : null}
            >
              {isLocked ? `ลองใหม่ใน ${lockRemainSec}s` : "เข้าสู่ระบบ"}
            </Button>
          </Form.Item>
        </Form>

        <Button
          icon={<GoogleOutlined />}
          size="large"
          block
          onClick={handleGoogle}
          disabled={loading}
        >
          เข้าสู่ระบบด้วย Google
        </Button>

        <Divider />

        <div style={{ display: "grid", gap: 8 }}>
          <Button onClick={handleResetPassword} disabled={mailSending}>
            {mailSending ? "กำลังส่งลิงก์รีเซ็ต…" : "ลืมรหัสผ่าน? ส่งลิงก์รีเซ็ต"}
          </Button>
          <Button type="link" block>
            <Link to="/register">ยังไม่มีบัญชี? สมัครสมาชิก</Link>
          </Button>
        </div>

        <Divider />

        <Text type="secondary" style={{ fontSize: 12 }}>
          เคล็ดลับดีบัก: ถ้าขึ้น “อีเมลยังไม่ยืนยัน” ให้ไปที่ Supabase → Auth → Providers → Email
          แล้วปิด <em>Enable email confirmations</em> ชั่วคราว (เฉพาะตอนพัฒนา) หรือยืนยันอีเมลก่อน
        </Text>
      </Card>
    </div>
  );
}
