const MODEL = "gemini-3.5-flash-lite";

const PROMPT = `영수증 사진에서 아래 세 가지를 읽어 JSON으로 답하세요.
- amount: 최종 결제 합계 금액(원, 정수). 부가세, 공급가액, 받은 돈, 거스름돈이 아니라 실제로 결제한 총액입니다.
- date: 결제 날짜(YYYY-MM-DD)
- place: 사용처(가게 이름)
사진에서 확실히 읽을 수 없는 항목은 추측하지 말고 null로 답하세요.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    amount: { type: "INTEGER", nullable: true },
    date: { type: "STRING", nullable: true },
    place: { type: "STRING", nullable: true },
  },
  required: ["amount", "date", "place"],
};

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY가 설정되지 않았어요" },
      { status: 500 }
    );
  }

  const { image, mimeType } = await request.json();
  if (!image || !mimeType) {
    return Response.json({ error: "이미지가 없어요" }, { status: 400 });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: image } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0,
        },
      }),
    }
  );

  if (!res.ok) {
    return Response.json(
      { error: `영수증을 읽지 못했어요 (${res.status})` },
      { status: 502 }
    );
  }

  let parsed = {};
  try {
    const data = await res.json();
    parsed = JSON.parse(data.candidates[0].content.parts[0].text);
  } catch {
    return Response.json({ error: "영수증을 읽지 못했어요" }, { status: 502 });
  }

  const amount =
    Number.isInteger(parsed.amount) && parsed.amount > 0 ? parsed.amount : null;
  const date =
    typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
      ? parsed.date
      : null;
  const place =
    typeof parsed.place === "string" && parsed.place.trim()
      ? parsed.place.trim()
      : null;

  return Response.json({ amount, date, place });
}
