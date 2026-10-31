"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

const TOOLS = [
  ["list_expenses", "지출 목록 조회 (월·개수 지정 가능)"],
  ["get_month_total", "한 달 합계와 카테고리별 합계"],
  ["add_expense", "지출 추가"],
  ["delete_expense", "id로 지출 삭제"],
];

export default function McpGuide() {
  const [origin, setOrigin] = useState("https://hitkey-pay.vercel.app");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/api/mcp`;

  const claudeCode = `claude mcp add --transport http heatkey ${url}`;
  const jsonConfig = JSON.stringify(
    { mcpServers: { heatkey: { command: "npx", args: ["-y", "mcp-remote", url] } } },
    null,
    2
  );

  return (
    <main className={styles.app}>
      <Link href="/" className={styles.back}>
        ← 가계부로 돌아가기
      </Link>
      <h1 className={styles.title}>히트키 MCP 연동</h1>
      <p className={styles.lead}>
        Claude 같은 AI 앱에서 내 가계부를 조회하고 지출을 추가·삭제할 수 있어요.
      </p>

      <section className={styles.card}>
        <h2>서버 주소</h2>
        <pre>{url}</pre>
        <p className={styles.note}>Streamable HTTP 방식이며 로그인(토큰)이 없어요.</p>
      </section>

      <section className={styles.card}>
        <h2>Claude (웹·데스크톱)</h2>
        <ol>
          <li>설정 → 커넥터(Connectors)로 이동</li>
          <li>&quot;커스텀 커넥터 추가&quot;를 선택</li>
          <li>이름은 히트키, 주소에 위 서버 주소를 붙여넣고 추가</li>
        </ol>
      </section>

      <section className={styles.card}>
        <h2>Claude Code</h2>
        <pre>{claudeCode}</pre>
      </section>

      <section className={styles.card}>
        <h2>그 밖의 앱 (설정 파일 방식)</h2>
        <p className={styles.note}>
          원격 주소를 직접 받지 못하는 앱은 mcp-remote로 연결해요.
        </p>
        <pre>{jsonConfig}</pre>
      </section>

      <section className={styles.card}>
        <h2>사용할 수 있는 도구</h2>
        <ul>
          {TOOLS.map(([name, desc]) => (
            <li key={name}>
              <code>{name}</code> — {desc}
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          예: &quot;이번 달 카페에 얼마 썼어?&quot;, &quot;오늘 점심 12,000원 식비로 추가해줘&quot;
        </p>
      </section>

      <section className={styles.card}>
        <h2>주의</h2>
        <p className={styles.note}>
          주소를 아는 누구나 지출을 읽고 쓰고 지울 수 있어요. 주소를 공개하지 마세요.
        </p>
      </section>
    </main>
  );
}
