import React, { useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, Avatar, Space, Typography, Dropdown, theme } from "antd";
import {
  AppstoreOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { supabase } from "../lib/supabase";

const { Header, Sider, Content, Footer } = Layout;
const { Text } = Typography;

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // กำหนดเมนูที่ active ตาม path ปัจจุบัน
  const selectedKeys = useMemo(() => {
    if (location.pathname.startsWith("/projects")) return ["projects"];
    if (location.pathname.startsWith("/documents")) return ["documents"];
    if (location.pathname.startsWith("/roles")) return ["roles"];
    if (location.pathname.startsWith("/profile")) return ["profile"];
    return ["dashboard"];
  }, [location.pathname]);

  // ✅ ใช้ menu={{ items }} แทน overlay
  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: <Link to="/profile">Profile</Link>,
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings (coming soon)",
      disabled: true,
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
    },
  ];

  const sideItems = [
    {
      key: "dashboard",
      icon: <AppstoreOutlined />,
      label: <Link to="/">Dashboard</Link>,
    },
    {
      key: "projects",
      icon: <FolderOpenOutlined />,
      label: <Link to="/projects">Projects</Link>,
    },
    {
      key: "documents",
      icon: <FileTextOutlined />,
      label: <Link to="/documents">Documents</Link>,
    },
    {
      key: "roles",
      icon: <SettingOutlined />,
      label: <Link to="/roles">Roles</Link>,
    },
  ];

  const handleMenuClick = async (e) => {
    if (e.key === "logout") {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth={64}>
        <div
          style={{
            height: 56,
            margin: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: 0.3,
            userSelect: "none",
          }}
        >
          Audit&nbsp;Tracker
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={sideItems}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <Space>
            <Text strong>Ant Design + Supabase</Text>
          </Space>

          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            menu={{
              items: userMenuItems,
              onClick: handleMenuClick,
            }}
          >
            <Space style={{ cursor: "pointer" }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <Text type="secondary">Account</Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ padding: 16 }}>
          <div
            style={{
              background: colorBgContainer,
              padding: 16,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>

        <Footer style={{ textAlign: "center" }}>
          © {new Date().getFullYear()} Audit Tracker — Built with Ant Design &
          Supabase
        </Footer>
      </Layout>
    </Layout>
  );
}
