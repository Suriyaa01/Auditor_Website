import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Button,
  Card,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Upload,
  Input,
  Progress,
  Alert,
  Modal,
  Select,
} from "antd";
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
  LinkOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ใช้ชื่อบัคเก็ตจาก .env หรือ fallback เป็น "documents"
const BUCKET = import.meta.env.VITE_STORAGE_BUCKET || "documents";

// helper เช็ค mime ว่าเป็นรูป/PDF ไหม
const isImage = (m) => m?.startsWith("image/");
const isPDF = (m) => m === "application/pdf";

export default function Documents() {
  const [searchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);

  const [search, setSearch] = useState("");
  const [lastError, setLastError] = useState("");

  const [realtimeOn] = useState(true);

  // โปรเจกต์
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(undefined); // filter
  const [projectIdForUpload, setProjectIdForUpload] = useState(undefined); // attach ตอนอัปโหลด

  // พรีวิว
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewMeta, setPreviewMeta] = useState({ name: "", mime: "" });

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      setLastError(`Load projects failed: ${error.message}`);
      message.error(`Load projects failed: ${error.message}`);
      return;
    }
    setProjects(data || []);
  };

  const fetchDocs = async () => {
    setLoading(true);
    let q = supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (projectId) q = q.eq("project_id", projectId);

    const { data, error } = await q;
    setLoading(false);
    if (error) {
      setLastError(`Load documents failed: ${error.message}`);
      return message.error(`Load documents failed: ${error.message}`);
    }
    setRows(data || []);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // ตั้งค่าเริ่มต้นจาก URL ?projectId=...
  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid && !Number.isNaN(Number(pid))) {
      setProjectId(Number(pid));
      setProjectIdForUpload(Number(pid));
    } else {
      fetchDocs(); // ถ้าไม่ได้กรองด้วย project ให้โหลดทันที
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // โหลดเอกสารใหม่เมื่อเลือกโปรเจกต์กรอง
  useEffect(() => {
    if (projectId !== undefined) fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // realtime sync documents
  useEffect(() => {
    if (!realtimeOn) return;
    const channel = supabase
      .channel("realtime:documents")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, fetchDocs)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [realtimeOn]); // eslint-disable-line

  const propsUpload = {
    multiple: true,
    showUploadList: false,
    accept: "*/*",
    customRequest: async ({ file, onSuccess, onError, onProgress }) => {
      try {
        setUploading(true);
        setPercent(0);
        setLastError("");

        // ต้องล็อกอิน
        const { data: u, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const uid = u?.user?.id;
        if (!uid) throw new Error("กรุณาเข้าสู่ระบบก่อนอัปโหลดไฟล์");

        // path: <uid>/<timestamp>-<original>
        const safeName = String(file.name).replace(/[^\w.\-]+/g, "_");
        const path = `${uid}/${Date.now()}-${safeName}`;

        // อัปโหลดขึ้น Storage
        const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (up.error) {
          console.error("Storage upload error:", up.error);
          throw up.error;
        }
        setPercent(65);
        onProgress?.({ percent: 65 });

        // insert meta (แนบ project_id ถ้าผู้ใช้เลือก)
        const ins = await supabase.from("documents").insert({
          user_id: uid,
          project_id: projectIdForUpload ?? null,
          storage_path: path,
          name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size ?? null,
        });
        if (ins.error) {
          console.error("DB insert error:", ins.error);
          // ลบไฟล์คืนถ้า insert fail
          await supabase.storage.from(BUCKET).remove([path]);
          throw ins.error;
        }

        setPercent(100);
        onProgress?.({ percent: 100 });
        message.success(`อัปโหลดสำเร็จ: ${file.name}`);
        onSuccess?.({}, file);
        fetchDocs();
      } catch (e) {
        console.error("Upload error:", e);
        setLastError(e?.message || String(e));
        message.error(`Upload failed: ${e.message || e}`);
        onError?.(e);
      } finally {
        setTimeout(() => {
          setUploading(false);
          setPercent(0);
        }, 600);
      }
    },
  };

  // สร้าง Signed URL แล้วเปิด preview modal
  const previewDoc = async (row) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 120); // 2 นาที
    if (error) {
      setLastError(`Preview failed: ${error.message}`);
      return message.error(`Preview failed: ${error.message}`);
    }
    setPreviewUrl(data.signedUrl);
    setPreviewMeta({ name: row.name, mime: row.mime_type });
    setPreviewOpen(true);
  };

  const downloadDoc = async (row) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 60);
    if (error) {
      setLastError(`Download failed: ${error.message}`);
      return message.error(`Download failed: ${error.message}`);
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const deleteDoc = async (row) => {
    const s = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (s.error) {
      setLastError(`Storage delete failed: ${s.error.message}`);
      return message.error(`Storage delete failed: ${s.error.message}`);
    }
    const d = await supabase.from("documents").delete().eq("id", row.id);
    if (d.error) {
      setLastError(`DB delete failed: ${d.error.message}`);
      return message.error(`DB delete failed: ${d.error.message}`);
    }
    message.success("ลบไฟล์สำเร็จ");
    fetchDocs();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.mime_type?.toLowerCase().includes(q) ||
        r.storage_path?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    { title: "Name", dataIndex: "name" },
    {
      title: "Type",
      dataIndex: "mime_type",
      width: 160,
      render: (m) => <Tag>{m || "unknown"}</Tag>,
    },
    {
      title: "Project",
      dataIndex: "project_id",
      width: 160,
      render: (pid) => projects.find((p) => p.id === pid)?.name || <Text type="secondary">-</Text>,
    },
    {
      title: "Size",
      dataIndex: "size_bytes",
      width: 120,
      render: (b) => (b ? `${(b / 1024).toFixed(1)} KB` : "-"),
      sorter: (a, b) => (a.size_bytes || 0) - (b.size_bytes || 0),
    },
    {
      title: "Uploaded",
      dataIndex: "created_at",
      width: 200,
      render: (t) => new Date(t).toLocaleString(),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      defaultSortOrder: "descend",
    },
    {
      title: "Actions",
      width: 260,
      render: (_, row) => (
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => previewDoc(row)}>
            Preview
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => downloadDoc(row)}>
            Download
          </Button>
          <Popconfirm title="ยืนยันลบไฟล์?" onConfirm={() => deleteDoc(row)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Header */}
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap" }}>
        <Space direction="vertical" size={0}>
          <Title level={3} style={{ margin: 0 }}>Documents</Title>
          <Text type="secondary">
            อัปโหลด/ดาวน์โหลด/พรีวิวไฟล์ ด้วย Supabase Storage — <strong>Bucket:</strong> <code>{BUCKET}</code>
          </Text>
        </Space>
        <Space wrap>
          <Input
            allowClear
            placeholder="ค้นหาเอกสาร..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            allowClear
            placeholder="กรองตามโปรเจกต์"
            style={{ width: 220 }}
            value={projectId}
            onChange={setProjectId}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchDocs}>Refresh</Button>
        </Space>
      </Space>

      {/* Error ล่าสุด */}
      {lastError && (
        <Alert
          type="error"
          showIcon
          message="เกิดข้อผิดพลาด"
          description={<pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{lastError}</pre>}
          style={{ marginBottom: 12 }}
          action={<Button size="small" onClick={() => setLastError("")}>เคลียร์</Button>}
        />
      )}

      {/* Upload + เลือกโปรเจกต์แนบ */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          <Space wrap>
            <Text strong>แนบเข้ากับโปรเจกต์:</Text>
            <Select
              allowClear
              placeholder="(ไม่ระบุได้)"
              style={{ minWidth: 240 }}
              value={projectIdForUpload}
              onChange={setProjectIdForUpload}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Space>

          <Dragger {...propsUpload} disabled={uploading}>
            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
            <p className="ant-upload-text">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</p>
            <p className="ant-upload-hint">ไฟล์ Private แจกผ่าน Signed URL เท่านั้น</p>
            {uploading && <Progress percent={percent} style={{ maxWidth: 360, margin: "12px auto 0" }} />}
          </Dragger>
        </Space>
      </Card>

      {/* Table */}
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Preview Modal */}
      <Modal
        title={
          <Space>
            <span>Preview</span>
            <a href={previewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              <LinkOutlined /> เปิดแท็บใหม่
            </a>
          </Space>
        }
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={isPDF(previewMeta.mime) ? 980 : 720}
        bodyStyle={{ padding: 0, textAlign: "center", background: "#000" }}
      >
        <div style={{ padding: isImage(previewMeta.mime) ? 0 : 16, background: isImage(previewMeta.mime) ? "#000" : "#fff" }}>
          {isImage(previewMeta.mime) && previewUrl && (
            <img src={previewUrl} alt={previewMeta.name} style={{ maxWidth: "100%", height: "auto" }} />
          )}
          {isPDF(previewMeta.mime) && previewUrl && (
            <iframe src={previewUrl} title={previewMeta.name} style={{ width: "100%", height: "80vh", border: 0 }} />
          )}
          {!isImage(previewMeta.mime) && !isPDF(previewMeta.mime) && previewUrl && (
            <div style={{ padding: 24 }}>
              <Alert
                type="info"
                message="ไม่รองรับการพรีวิวไฟล์ชนิดนี้"
                description={<span>กด “เปิดแท็บใหม่” ด้านบนเพื่อดาวน์โหลด/เปิดด้วยแอปภายนอก</span>}
                showIcon
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
