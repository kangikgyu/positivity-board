const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const MAX_CONTENT_LENGTH = 1200;

function normalizeContent(value) {
  return typeof value === "string" ? value.trim() : "";
}

const FORBIDDEN_FEEDBACK_TERMS = [
  "문제",
  "틀렸",
  "잘못",
  "이상하",
  "왜 그렇게",
  "그 부분",
  "부족",
  "고쳐",
  "개선"
];

const SAFE_FALLBACK_COMMENT = "의견을 나눠주셔서 고마워요. 서로의 생각을 존중하며 따뜻하게 이야기 나누면 좋겠어요.";

function includesForbiddenFeedback(text) {
  return FORBIDDEN_FEEDBACK_TERMS.some((term) => text.includes(term));
}

async function createPolishedContent(client, content, extraInstruction = "") {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.55,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content: [
          "너는 한국어 게시판 댓글을 따뜻하고 긍정적으로 바꾸는 번역기야.",
          "상대방이 읽었을 때 비난받는다고 느끼지 않게 하는 것을 최우선으로 해.",
          "상대방을 평가하거나 지적하거나 문제 삼는 표현을 절대 쓰지 마.",
          "문제, 틀렸다, 잘못, 이상하다, 왜 그렇게, 그 부분, 부족하다, 고쳐라, 개선해라 같은 지적성 표현을 피해야 해.",
          "원문의 공격성, 비난, 조롱, 비꼼, 명령조를 모두 제거해.",
          "상대방의 좋은 점, 노력, 생각을 인정하는 느낌으로 바꿔.",
          "응원, 격려, 따뜻함, 존중, 배려가 느껴지게 만들어.",
          "질문을 하더라도 추궁처럼 보이지 않게 부드럽게 표현해.",
          "가능하면 짧고 자연스러운 한국어 댓글로 만들어.",
          "원문에 욕설이나 인신공격이 있으면 그 내용을 직접 반복하지 마.",
          "결과물은 게시판 댓글로 바로 사용할 수 있는 문장만 출력해.",
          "설명, 따옴표, 변환 이유, 부가 안내는 출력하지 마.",
          extraInstruction
        ].filter(Boolean).join(" ")
      },
      {
        role: "user",
        content: content
      }
    ]
  });

  return response.choices[0] && response.choices[0].message
    ? normalizeContent(response.choices[0].message.content)
    : "";
}

exports.polishText = onCall({ secrets: [openaiApiKey] }, async (request) => {
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
    let polishedContent = await createPolishedContent(client, content);

    if (polishedContent && includesForbiddenFeedback(polishedContent)) {
      polishedContent = await createPolishedContent(
        client,
        content,
        "금지 표현을 한 번 더 확인해. 문제, 잘못, 왜 그렇게, 그 부분처럼 상대를 지적하는 말은 절대 포함하지 마."
      );
    }

    if (!polishedContent) {
      throw new Error("OpenAI response did not include content.");
    }

    if (includesForbiddenFeedback(polishedContent)) {
      polishedContent = SAFE_FALLBACK_COMMENT;
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
