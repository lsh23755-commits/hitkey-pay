"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

const CATEGORIES = ["식비", "카페", "교통", "쇼핑", "구독", "기타"];
const EMOJI = { 식비: "🍙", 카페: "☕", 교통: "🚌", 쇼핑: "🛍️", 구독: "💌", 기타: "✨" };

const BUDGET_KEY = "monthly_budget";

const won = (n) => `${n.toLocaleString("ko-KR")}원`;

const monthLabel = (m) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;

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
  const [todayMonth, setTodayMonth] = useState("");
  const [viewMonth, setViewMonth] = useState("");
  const [memo, setMemo] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [budget, setBudget] = useState(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");

  // 현재 날짜는 프리렌더 시점이 아닌 브라우저에서 읽는다
  useEffect(() => {
    const today = todayString();
    setDate(today);
    setTodayMonth(today.slice(0, 7));
    setViewMonth(today.slice(0, 7));
    supabase
      .from("settings")
      .select("value")
      .eq("key", BUDGET_KEY)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setBudget(data.value);
      });
    supabase
      .from("expenses")
      .select("id, amount, place, category, date, memo")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError("지출을 불러오지 못했어요");
        else setExpenses(data);
      });
  }, []);

  const monthExpenses = expenses.filter(
    (e) => viewMonth && e.date.startsWith(viewMonth)
  );
  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryStats = CATEGORIES.map((c) => ({
    category: c,
    sum: monthExpenses
      .filter((e) => e.category === c)
      .reduce((s, e) => s + e.amount, 0),
  }))
    .filter((s) => s.sum > 0)
    .sort((a, b) => b.sum - a.sum);

  const budgetRatio = budget ? monthTotal / budget : 0;

  const groups = Object.entries(
    monthExpenses.reduce((acc, e) => {
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

  function shiftMonth(delta) {
    const [y, m] = viewMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  async function handleBudgetSave(ev) {
    ev.preventDefault();
    const value = Number(budgetInput);
    if (!Number.isInteger(value) || value < 0) return;
    const { error } = await supabase
      .from("settings")
      .upsert({ key: BUDGET_KEY, value });
    if (error) {
      setError("예산을 저장하지 못했어요");
      return;
    }
    setError("");
    setBudget(value);
    setBudgetOpen(false);
  }

  function resetForm() {
    setEditingId(null);
    setAmount("");
    setPlace("");
    setMemo("");
    setDate(todayString());
  }

  function startEdit(e) {
    setEditingId(e.id);
    setAmount(String(e.amount));
    setPlace(e.place);
    setCategory(e.category);
    setDate(e.date);
    setMemo(e.memo);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0 || !place.trim() || !date) return;
    const fields = {
      amount: value,
      place: place.trim(),
      category,
      date,
      memo: memo.trim(),
    };
    const query = editingId
      ? supabase.from("expenses").update(fields).eq("id", editingId)
      : supabase.from("expenses").insert(fields);
    const { data, error } = await query
      .select("id, amount, place, category, date, memo")
      .single();
    if (error) {
      setError("지출을 저장하지 못했어요");
      return;
    }
    setError("");
    setExpenses((prev) =>
      editingId
        ? prev.map((e) => (e.id === editingId ? data : e))
        : [...prev, data]
    );
    setViewMonth(date.slice(0, 7));
    resetForm();
  }

  async function handleDelete(id) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      setError("지출을 삭제하지 못했어요");
      return;
    }
    setError("");
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (id === editingId) resetForm();
  }

  return (
    <main className={styles.app}>
      <div className={styles.topbar}>
        <div className={styles.brand}>히트키</div>
        <Link href="/mcp" className={styles.mcpLink}>
          MCP 연동
        </Link>
      </div>

      <section className={styles.summary}>
        <div className={styles.monthNav}>
          <button
            type="button"
            className={styles.navBtn}
            aria-label="이전 달"
            onClick={() => shiftMonth(-1)}
            disabled={!viewMonth}
          >
            ‹
          </button>
          <span className={styles.summaryLabel}>
            {viewMonth && monthLabel(viewMonth)}
            {viewMonth === todayMonth ? " (이번 달)" : ""} 지출
          </span>
          <button
            type="button"
            className={styles.navBtn}
            aria-label="다음 달"
            onClick={() => shiftMonth(1)}
            disabled={!viewMonth}
          >
            ›
          </button>
        </div>
        <div className={styles.total}>{won(monthTotal)}</div>

        <div className={styles.budget}>
          {budgetOpen ? (
            <form className={styles.budgetForm} onSubmit={handleBudgetSave}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="월 예산(원)"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                autoFocus
              />
              <button type="submit">저장</button>
              <button type="button" onClick={() => setBudgetOpen(false)}>
                취소
              </button>
            </form>
          ) : (
            <>
              {budget ? (
                <>
                  <div className={styles.bar}>
                    <div
                      className={`${styles.barFill} ${
                        budgetRatio > 1 ? styles.over : ""
                      }`}
                      style={{ width: `${Math.min(budgetRatio, 1) * 100}%` }}
                    />
                  </div>
                  <div className={styles.budgetText}>
                    {budgetRatio > 1
                      ? `예산 ${won(monthTotal - budget)} 초과 😱`
                      : `예산 ${won(budget)} 중 ${won(budget - monthTotal)} 남음`}
                    {` (${Math.round(budgetRatio * 100)}%)`}
                  </div>
                </>
              ) : null}
              <button
                type="button"
                className={styles.budgetBtn}
                onClick={() => {
                  setBudgetInput(budget ? String(budget) : "");
                  setBudgetOpen(true);
                }}
              >
                {budget ? "예산 수정" : "+ 월 예산 설정"}
              </button>
            </>
          )}
        </div>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      {categoryStats.length > 0 && (
        <section className={styles.stats}>
          <h2 className={styles.statsTitle}>카테고리별 지출</h2>
          {categoryStats.map((s) => (
            <div key={s.category} className={styles.statRow}>
              <span className={styles.statName}>
                {EMOJI[s.category]} {s.category}
              </span>
              <div className={styles.statBar}>
                <div
                  className={styles.statFill}
                  style={{ width: `${(s.sum / monthTotal) * 100}%` }}
                />
              </div>
              <span className={styles.statSum}>{won(s.sum)}</span>
            </div>
          ))}
        </section>
      )}

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
                {EMOJI[c]} {c}
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
          {editingId ? "수정 완료" : "추가하기"}
        </button>
        {editingId && (
          <button type="button" className={styles.cancel} onClick={resetForm}>
            수정 취소
          </button>
        )}
      </form>

      {groups.length === 0 ? (
        <p className={styles.empty}>이 달에 입력한 지출이 없어요</p>
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
                      {EMOJI[e.category]} {e.category}
                      {e.memo ? ` · ${e.memo}` : ""}
                    </div>
                  </div>
                  <div className={styles.right}>
                    <span className={styles.amount}>{won(e.amount)}</span>
                    <button
                      type="button"
                      className={styles.del}
                      aria-label="수정"
                      onClick={() => startEdit(e)}
                    >
                      ✎
                    </button>
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
