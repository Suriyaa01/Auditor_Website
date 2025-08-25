import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, PrinterOutlined, SearchOutlined } from "@ant-design/icons";
// (ตัวเลือก) ถ้าใช้ระบบสิทธิ์หน้า
// import { usePermission } from "../hooks/usePermission";

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

function StatusTag({ s }) {
  const color = s === "done" ? "green" : s === "in_progress" ? "blue" : "default";
  const label = STATUS_OPTIONS.find(o => o.value === s)?.label || s;
  return <Tag color={color}>{label}</Tag>;
}

export default function Projects() {
  // (ตัวเลือก) ถ้าคุณใช้สิทธิ์หน้า “projects” จริง ให้เปิดสองบรรทัดนี้
  // const { loading: permLoading, can } = usePermission("projects");

  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);    // modal
  const [editing, setEditing] = useState(null); // row object กำลังแก้ไข
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  // ตาราง: ค้นหา + แพจิเนชัน + เรียง
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const latestQuery = useRef({});

  // Realtime (ทางเลือก)
  const [realtimeOn] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    let query = supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (search.trim()) {
      // ค้นหาง่าย ๆ: name ILIKE %search% OR description ILIKE %search%
      query = query.ilike("name", `%${search}%`);
      // หมายเหตุ: ถ้าต้องการ OR with description ให้ใช้ RPC/วิว หรือ filter ฝั่ง FE
    }

    // (ย้ำ) RLS จะกรองตาม user/role ให้เอง
    const { data, error } = await query;
    setLoading(false);
    if (error) return message.error(error.message);
    setRows(data || []);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [search]);

  // Supabase Realtime: subscribe ตาราง projects
  useEffect(() => {
    if (!realtimeOn) return;
    const channel = supabase
      .channel("realtime:projects")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        (_payload) => {
          // sync ใหม่แบบง่ายสุด
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeOn]); // eslint-disable-line

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ status: "open" });
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      status: record.status,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      status: values.status,
    };

    if (!editing) {
      // CREATE
      const { error } = await supabase.from("projects").insert([payload]);
      if (error) return message.error(error.message);
      message.success("สร้างโปรเจกต์สำเร็จ");
    } else {
      // UPDATE
      const { error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", editing.id);
      if (error) return message.error(error.message);
      message.success("แก้ไขโปรเจกต์สำเร็จ");
    }

    setOpen(false);
    setEditing(null);
    form.resetFields();
    fetchData();
  };

  const handleDelete = async (record) => {
    const { error } = await supabase.from("projects").delete().eq("id", record.id);
    if (error) return message.error(error.message);
    message.success("ลบสำเร็จ");
    fetchData();
  };

  const columns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", width: 80 },
      { 
        title: "Name",
        dataIndex: "name",
        sorter: (a, b) => a.name.localeCompare(b.name),
      },
      {
        title: "Status",
        dataIndex: "status",
        width: 140,
        filters: STATUS_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
        onFilter: (val, rec) => rec.status === val,
        render: (s) => <StatusTag s={s} />,
      },
      {
        title: "Updated",
        dataIndex: "updated_at",
        width: 200,
        render: (t) => new Date(t).toLocaleString(),
        sorter: (a, b) => new Date(a.updated_at) - new Date(b.updated_at),
        defaultSortOrder: "descend",
      },
      {
        title: "Actions",
        width: 200,
        render: (_, row) => (
          <Space>
            {/* (ตัวเลือก) ตรวจสิทธิ์: can('can_edit') */}
            <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>
              Edit
            </Button>

            {/* (ตัวเลือก) ตรวจสิทธิ์: can('can_delete') */}
            <Popconfirm
              title="ยืนยันการลบ?"
              onConfirm={() => handleDelete(row)}
            >
              <Button danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>

            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print
            </Button>
          </Space>
        ),
      },
    ],
    [] // eslint-disable-line
  );

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }, [rows, page, pageSize]);

  return (
    <>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap" }}>
        <Space direction="vertical" size={0}>
          <Title level={3} style={{ margin: 0 }}>Projects</Title>
          <Text type="secondary">CRUD ตัวอย่างด้วย Ant Design + Supabase</Text>
        </Space>

        <Space wrap>
          <Input
            allowClear
            placeholder="ค้นหาชื่อโปรเจกต์..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
          {/* (ตัวเลือก) ตรวจสิทธิ์: can('can_add') */}
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Project
          </Button>
        </Space>
      </Space>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={paged}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            pageSizeOptions: [5, 10, 20, 50],
          }}
        />
      </Card>

      <Modal
        title={editing ? "Edit Project" : "Add Project"}
        open={open}
        onOk={handleSubmit}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        okText={editing ? "Save" : "Create"}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Name"
            name="name"
            rules={[
              { required: true, message: "กรุณากรอกชื่อโปรเจกต์" },
              { max: 120, message: "ยาวเกินไป (สูงสุด 120 ตัวอักษร)" },
            ]}
          >
            <Input placeholder="เช่น Audit 2025" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={4} placeholder="รายละเอียด (ไม่บังคับ)" />
          </Form.Item>

          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
