const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const MAX_CONTENT_LENGTH = 1200;

function normalizeContent(value) {
  return typeof value === "string" ? value.trim() : "";
}

exports.polishText = onCall({ secrets: [openaiApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인 후 문장을 다듬을 수 있습니다.");
  }

  const content = normalizeContent(request.data && request.data.content);

  if (!content) {
    throw new HttpsError("invalid-argument", "다듬을 내용을 입력해주세요.");
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `문장은 ${MAX_CONTENT_LENGTH}자 이하로 입력해주세요.`
    );
  }

  const client = new OpenAI({ apiKey: openaiApiKey.value() });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.6,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: [
            "너는 한국어 게시판 문장을 따뜻하게 옮기는 번역기야.",
            "상대방 마음에 대한 공감과 위로를 제1의 가치로 생각해.",
            "원문의 의미와 상황은 유지하되 공격적이거나 차가운 표현은 부드럽고 다정하게 바꿔.",

            "답변에는 다듬어진 본문만 출력해. 설명, 따옴표, 제목은 넣지 마."
          ].join(" ")
        },
        {
          role: "user",
          content: content
        }
      ]
    });

    const polishedContent = response.choices[0] && response.choices[0].message
      ? normalizeContent(response.choices[0].message.content)
      : "";

    if (!polishedContent) {
      throw new Error("OpenAI response did not include content.");
    }

    return { polishedContent };
  } catch (error) {
    console.error("OpenAI 문장 다듬기 실패:", error);
    throw new HttpsError(
      "internal",
      "문장을 다듬는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
    );
  }
});
