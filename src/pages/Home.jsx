import { Button, Card, Typography, message } from 'antd';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

export default function Home() {
  const { user, signOut } = useAuth();

  const onLogout = async () => {
    const { error } = await signOut();
    if (error) message.error(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-6">
      <Card style={{ width: 520, borderRadius: 16 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Dashboard</Title>
        <Text>ยินดีต้อนรับ, {user?.email}</Text>
        <div style={{ marginTop: 16 }}>
          <Button danger onClick={onLogout}>ออกจากระบบ</Button>
        </div>
      </Card>
    </div>
  );
}
