import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Divider,
  message,
} from "antd";
import { MailOutlined, LockOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function Register() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async ({ email, password }) => {
    const cleanEmail = (email || "").trim();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/login",
      },
    });

    if (error) {
      setLoading(false);
      message.error(error.message || "สมัครสมาชิกไม่สำเร็จ");
      return;
    }

    try {
      // สร้างแถวใน profiles (role เริ่มต้นเป็น 'user')
      if (data?.user) {
        const { error: perr } = await supabase.from("profiles").upsert({
          id: data.user.id,
          email: data.user.email,
          role: "user",
        });
        if (perr) console.warn("profiles upsert error:", perr);
      }
    } finally {
      setLoading(false);
    }

    if (!data.session) {
      message.success("สมัครสำเร็จ! โปรดยืนยันอีเมลก่อนเข้าสู่ระบบ (ถ้าเปิด Email confirmations)");
      navigate("/login");
    } else {
      message.success("สมัครและเข้าสู่ระบบสำเร็จ!");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4">
      <Card style={{ width: 420, borderRadius: 16 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Title level={3} style={{ marginBottom: 0 }}>Create your account</Title>
          <Text type="secondary">สมัครด้วยอีเมลและรหัสผ่าน</Text>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "กรุณากรอกอีเมล" },
              { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
            ]}
          >
            <Input size="large" prefix={<MailOutlined />} placeholder="you@example.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: true, message: "กรุณากรอกรหัสผ่าน" },
              { min: 6, message: "รหัสผ่านอย่างน้อย 6 ตัว" },
            ]}
            hasFeedback
          >
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="ขั้นต่ำ 6 ตัวอักษร" autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            label="Confirm password"
            name="confirm"
            dependencies={["password"]}
            hasFeedback
            rules={[
              { required: true, message: "กรุณายืนยันรหัสผ่าน" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject(new Error("รหัสผ่านไม่ตรงกัน"));
                },
              }),
            ]}
          >
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="พิมพ์รหัสผ่านซ้ำ" autoComplete="new-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" size="large" block loading={loading}>
            สมัครสมาชิก
          </Button>
        </Form>

        <Divider />
        <Text type="secondary">
          มีบัญชีอยู่แล้ว? <Link to="/login" style={{ fontWeight: 600 }}>เข้าสู่ระบบ</Link>
        </Text>
      </Card>
    </div>
  );
}
