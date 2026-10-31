import { supabase } from "@/lib/supabase";

const CATEGORIES = ["식비", "카페", "교통", "쇼핑", "구독", "기타"];
const COLUMNS = "id, amount, place, category, date, memo";

const TOOLS = [
  {
    name: "list_expenses",
    description:
      "지출 목록을 날짜 최신순으로 조회합니다. month(YYYY-MM)를 주면 그 달만 보여줍니다.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "조회할 달, 예: 2026-10" },
        limit: { type: "integer", description: "최대 개수 (기본 50)" },
      },
    },
  },
  {
    name: "get_month_total",
    description: "한 달 지출 합계와 카테고리별 합계를 알려줍니다. month 생략 시 이번 달.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "조회할 달, 예: 2026-10" },
      },
    },
  },
  {
    name: "add_expense",
    description: "지출을 추가합니다.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "integer", description: "금액(원)" },
        place: { type: "string", description: "사용처" },
        category: { type: "string", enum: CATEGORIES },
        date: { type: "string", description: "YYYY-MM-DD, 생략 시 오늘" },
        memo: { type: "string" },
      },
      required: ["amount", "place", "category"],
    },
  },
  {
    name: "delete_expense",
    description: "id로 지출 하나를 삭제합니다. id는 list_expenses로 확인하세요.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

function monthRange(month) {
  const m = month ?? today().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new Error("month는 YYYY-MM 형식이어야 해요");
  const [y, mo] = m.split("-").map(Number);
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  return { start: `${m}-01`, end: `${next}-01` };
}

async function callTool(name, args = {}) {
  if (name === "list_expenses") {
    let q = supabase.from("expenses").select(COLUMNS);
    if (args.month) {
      const { start, end } = monthRange(args.month);
      q = q.gte("date", start).lt("date", end);
    }
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const { data, error } = await q
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "get_month_total") {
    const { start, end } = monthRange(args.month);
    const { data, error } = await supabase
      .from("expenses")
      .select("amount, category")
      .gte("date", start)
      .lt("date", end);
    if (error) throw new Error(error.message);
    const byCategory = {};
    let total = 0;
    for (const e of data) {
      total += e.amount;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }
    return { month: start.slice(0, 7), total, count: data.length, byCategory };
  }

  if (name === "add_expense") {
    const { amount, place, category, memo } = args;
    const date = args.date ?? today();
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("amount는 1 이상의 정수여야 해요");
    if (typeof place !== "string" || !place.trim()) throw new Error("place가 필요해요");
    if (!CATEGORIES.includes(category)) throw new Error(`category는 ${CATEGORIES.join(", ")} 중 하나여야 해요`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date는 YYYY-MM-DD 형식이어야 해요");
    const { data, error } = await supabase
      .from("expenses")
      .insert({ amount, place: place.trim(), category, date, memo: (memo ?? "").trim() })
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  if (name === "delete_expense") {
    if (typeof args.id !== "string" || !args.id) throw new Error("id가 필요해요");
    const { data, error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", args.id)
      .select(COLUMNS);
    if (error) throw new Error(error.message);
    if (!data.length) throw new Error("해당 id의 지출이 없어요");
    return { deleted: data[0] };
  }

  throw new Error(`알 수 없는 도구: ${name}`);
}

const reply = (id, result) => Response.json({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } });

export async function POST(request) {
  let msg;
  try {
    msg = await request.json();
  } catch {
    return fail(null, -32700, "Parse error");
  }
  if (Array.isArray(msg) || typeof msg?.method !== "string") {
    return fail(msg?.id ?? null, -32600, "Invalid Request");
  }
  const { id, method, params } = msg;

  // 알림(id 없음)은 응답 본문 없이 수락만 한다
  if (id === undefined) return new Response(null, { status: 202 });

  if (method === "initialize") {
    return reply(id, {
      protocolVersion: params?.protocolVersion ?? "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "heatkey", version: "1.0.0" },
    });
  }
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") return reply(id, { tools: TOOLS });
  if (method === "tools/call") {
    try {
      const result = await callTool(params?.name, params?.arguments);
      return reply(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      });
    } catch (e) {
      return reply(id, {
        content: [{ type: "text", text: e.message }],
        isError: true,
      });
    }
  }
  return fail(id, -32601, `Method not found: ${method}`);
}

// 서버가 먼저 보내는 스트림은 지원하지 않는다
export function GET() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
