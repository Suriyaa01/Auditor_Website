import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Typography,
  Space,
  Divider,
  Skeleton,
  Alert,
  Button,
} from "antd";
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // สรุปตัวเลข
  const [projectCount, setProjectCount] = useState(0);
  const [projectByStatus, setProjectByStatus] = useState({ open: 0, in_progress: 0, done: 0 });

  const [docCount, setDocCount] = useState(0);
  const [docWeekCount, setDocWeekCount] = useState(0);
  const [docSize, setDocSize] = useState(0); // bytes

  // รายการล่าสุด
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);

  const refresh = async () => {
    try {
      setErr("");
      setLoading(true);

      // --- Projects: รวมจำนวนทั้งหมด (นับฝั่งเซิร์ฟเวอร์)
      {
        const res = await supabase.from("projects").select("id", { count: "exact", head: true });
        if (res.error) throw res.error;
        setProjectCount(res.count ?? 0);
      }

      // --- Projects: นับตามสถานะ (ดึง status ทั้งหมดแล้ว reduce ฝั่ง client)
      {
        const res = await supabase.from("projects").select("status");
        if (res.error) throw res.error;
        const agg = { open: 0, in_progress: 0, done: 0 };
        (res.data || []).forEach((r) => {
          const s = r.status || "open";
          if (agg[s] === undefined) agg[s] = 0;
          agg[s] += 1;
        });
        setProjectByStatus(agg);
      }

      // --- Projects: ล่าสุด 5 รายการ
      {
        const res = await supabase
          .from("projects")
          .select("id,name,status,updated_at")
          .order("updated_at", { ascending: false })
          .limit(5);
        if (res.error) throw res.error;
        setRecentProjects(res.data || []);
      }

      // --- Documents: รวมจำนวนทั้งหมด
      {
        const res = await supabase.from("documents").select("id", { count: "exact", head: true });
        if (res.error) throw res.error;
        setDocCount(res.count ?? 0);
      }

      // --- Documents: 7 วันล่าสุด
      {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const res = await supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .gte("created_at", sevenDaysAgo);
        if (res.error) throw res.error;
        setDocWeekCount(res.count ?? 0);
      }

      // --- Documents: รวมขนาดไฟล์ (ดึง size_bytes แล้ว reduce)
      {
        const res = await supabase
          .from("documents")
          .select("size_bytes")
          .not("size_bytes", "is", null)
          .limit(10000); // กันโหลดหนัก
        if (res.error) throw res.error;
        const totalBytes = (res.data || []).reduce(
          (acc, r) => acc + (Number(r.size_bytes) || 0),
          0
        );
        setDocSize(totalBytes);
      }

      // --- Documents: อัปโหลดล่าสุด 5 รายการ
      {
        const res = await supabase
          .from("documents")
          .select("id,name,mime_type,project_id,created_at,storage_path")
          .order("created_at", { ascending: false })
          .limit(5);
        if (res.error) throw res.error;
        setRecentDocs(res.data || []);
      }
    } catch (e) {
      console.error(e);
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtBytes = (b) => {
    if (!b) return "0 KB";
    const kb = b / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  const projColumns = [
    { title: "Name", dataIndex: "name" },
    {
      title: "Status",
      dataIndex: "status",
      width: 140,
      render: (s) => {
        const color = s === "done" ? "green" : s === "in_progress" ? "blue" : "default";
        return <Tag color={color}>{s}</Tag>;
      },
    },
    {
      title: "Updated",
      dataIndex: "updated_at",
      width: 200,
      render: (t) => new Date(t).toLocaleString(),
      defaultSortOrder: "descend",
    },
    {
      title: "Action",
      width: 140,
      render: (_, row) => (
        <Button
          size="small"
          icon={<FolderOpenOutlined />}
          onClick={() => navigate(`/documents?projectId=${row.id}`)}
        >
          Open docs
        </Button>
      ),
    },
  ];

  const docColumns = [
    { title: "Name", dataIndex: "name" },
    {
      title: "Type",
      dataIndex: "mime_type",
      width: 200,
      render: (m) => <Tag>{m || "unknown"}</Tag>,
    },
    {
      title: "Uploaded",
      dataIndex: "created_at",
      width: 200,
      render: (t) => new Date(t).toLocaleString(),
    },
  ];

  const statCards = useMemo(
    () => [
      {
        title: "Projects (All)",
        value: projectCount,
        icon: <FolderOpenOutlined />,
        extra: (
          <Space size={4}>
            <Tag>Open: {projectByStatus.open}</Tag>
            <Tag color="blue">In progress: {projectByStatus.in_progress}</Tag>
            <Tag color="green">Done: {projectByStatus.done}</Tag>
          </Space>
        ),
      },
      {
        title: "Documents (All)",
        value: docCount,
        icon: <FileTextOutlined />,
        extra: <Text type="secondary">Last 7 days: {docWeekCount}</Text>,
      },
      {
        title: "Storage Used",
        value: fmtBytes(docSize),
        icon: <CheckCircleOutlined />,
        extra: <Text type="secondary">sum of size_bytes</Text>,
      },
      {
        title: "Attention",
        value: Math.max(projectByStatus.open, 0),
        icon: <ExclamationCircleOutlined />,
        extra: <Text type="secondary">Open projects</Text>,
      },
    ],
    [projectCount, projectByStatus, docCount, docWeekCount, docSize]
  );

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;
  return (
    <div style={{ padding: 12 }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap" }}>
        <Space direction="vertical" size={0}>
          <Title level={3} style={{ margin: 0 }}>Dashboard</Title>
          <Text type="secondary">ภาพรวมโครงการและเอกสาร (Supabase)</Text>
        </Space>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={refresh}>Refresh</Button>
        </Space>
      </Space>

      {err && (
        <Alert
          type="error"
          showIcon
          message="โหลดข้อมูลไม่สำเร็จ"
          description={<pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{err}</pre>}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Summary */}
      <Row gutter={[12, 12]}>
        {statCards.map((s, i) => (
          <Col xs={24} sm={12} md={12} lg={6} key={i}>
            <Card>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                  <Text strong>{s.title}</Text>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                </Space>
                <Statistic value={s.value} />
                {s.extra}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider />

      {/* Recent lists */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card title="Recent Projects">
            <Table
              rowKey="id"
              size="small"
              dataSource={recentProjects}
              columns={projColumns}
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent Uploads">
            <Table
              rowKey="id"
              size="small"
              dataSource={recentDocs}
              columns={docColumns}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

async function refresh() {
  const { data, error } = await supabase
    .from("your_table")
    .select("*"); // ลบ .group()

  if (error) {
    console.error(error);
    return;
  }

  // ตัวอย่างการจัดกลุ่มผลลัพธ์ในฝั่งไคลเอนต์
  const grouped = data.reduce((acc, row) => {
    const key = row.category || "uncategorized";
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
  // ใช้ grouped ต่อไปใน state/UI
}
