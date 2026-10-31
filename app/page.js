"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

const CATEGORIES = ["식비", "카페", "교통", "쇼핑", "구독", "기타"];

const won =(n) => `${n.toLocaleString("ko-KR")}원`;

function todayString() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${week})`;
}

// 업로드 용량을 줄이기 위해 긴 변 1600px 이하 JPEG로 줄인다
async function toJpegBase64(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export default function Home() {
  const [expenses, setExpenses] = useState([]);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState("");
  const [amount, setAmount] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState("");
  const [thisMonth, setThisMonth] = useState("");
  const [memo, setMemo] = useState("");

  // 현재 날짜는 프리렌더 시점이 아닌 브라우저에서 읽는다
  useEffect(() => {
    const today = todayString();
    setDate(today);
    setThisMonth(today.slice(0, 7));
    supabase
      .from("expenses")
      .select("id, amount, place, category, date, memo")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError("지출을 불러오지 못했어요");
        else setExpenses(data);
      });
  }, []);

  const monthTotal = expenses
    .filter((e) => thisMonth && e.date.startsWith(thisMonth))
    .reduce((sum, e) => sum + e.amount, 0);

  const groups = Object.entries(
    expenses.reduce((acc, e) => {
      (acc[e.date] ||= []).push(e);
      return acc;
    }, {})
  ).sort(([a], [b]) => (a < b ? 1 : -1));

  async function handleReceipt(ev) {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    setScanning(true);
    setNotice("");
    try {
      const image = await toJpegBase64(file);
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mimeType: "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 읽은 값은 저장하지 않고 입력 칸만 채운다. 못 읽은 칸은 비워 둔다.
      setAmount(data.amount ? String(data.amount) : "");
      setPlace(data.place ?? "");
      if (data.date) setDate(data.date);
      const missing = [
        !data.amount && "금액",
        !data.place && "사용처",
        !data.date && "날짜",
      ].filter(Boolean);
      setNotice(
        missing.length
          ? `${missing.join(", ")}은(는) 읽지 못했어요. 직접 입력해 주세요.`
          : "영수증을 읽었어요. 내용을 확인하고 추가해 주세요."
      );
    } catch (e) {
      setNotice(e.message || "영수증을 읽지 못했어요. 직접 입력해 주세요.");
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0 || !place.trim() || !date) return;
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        amount: value,
        place: place.trim(),
        category,
        date,
        memo: memo.trim(),
      })
      .select("id, amount, place, category, date, memo")
      .single();
    if (error) {
      setError("지출을 저장하지 못했어요");
      return;
    }
    setError("");
    setExpenses((prev) => [...prev, data]);
    setAmount("");
    setPlace("");
    setMemo("");
  }

  async function handleDelete(id) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      setError("지출을 삭제하지 못했어요");
      return;
    }
    setError("");
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <main className={styles.app}>
      <div className={styles.brand}>히트키</div>

      <section className={styles.summary}>
        <div className={styles.summaryLabel}>이번 달 지출</div>
        <div className={styles.total}>{won(monthTotal)}</div>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.scan}>
          {scanning ? "영수증 읽는 중..." : "📷 영수증으로 채우기"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleReceipt}
            disabled={scanning}
            hidden
          />
        </label>
        {notice && <p className={styles.notice}>{notice}</p>}
        <div className={styles.field}>
          <label htmlFor="amount">금액</label>
          <input
            id="amount"
            type="number"
            inputMode="numeric"
            min="1"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="place">사용처</label>
          <input
            id="place"
            type="text"
            placeholder="예: 스타벅스"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label>카테고리</label>
          <div className={styles.chips}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.chip} ${
                  c === category ? styles.chipActive : ""
                }`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="date">날짜</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="memo">메모</label>
          <input
            id="memo"
            type="text"
            placeholder="선택 사항"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
        <button type="submit" className={styles.submit}>
          추가하기
        </button>
      </form>

      {groups.length === 0 ? (
        <p className={styles.empty}>아직 입력한 지출이 없어요</p>
      ) : (
        groups.map(([d, items]) => (
          <section key={d} className={styles.group}>
            <div className={styles.groupHead}>
              <span>{formatDate(d)}</span>
              <span>{won(items.reduce((s, e) => s + e.amount, 0))}</span>
            </div>
            <ul className={styles.list}>
              {items.map((e) => (
                <li key={e.id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <div className={styles.place}>{e.place}</div>
                    <div className={styles.meta}>
                      {e.category}
                      {e.memo ? ` · ${e.memo}` : ""}
                    </div>
                  </div>
                  <div className={styles.right}>
                    <span className={styles.amount}>{won(e.amount)}</span>
                    <button
                      type="button"
                      className={styles.del}
                      aria-label="삭제"
                      onClick={() => handleDelete(e.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
