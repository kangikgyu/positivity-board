const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const MAX_CONTENT_LENGTH = 1200;
const OPENAI_MODEL = "gpt-5.4-mini";
const SAFE_FALLBACK_COMMENT = "저는 조금 다르게 느꼈어요. 어떤 점에서 그렇게 생각했는지 더 들어보고 싶어요.";
const SAFE_FALLBACK_RISK_SUMMARY = "원문이 상대에게 다소 강하게 느껴질 수 있어 표현을 조금 부드럽게 조정했어요.";

const FORBIDDEN_FEEDBACK_TERMS = [
  "문제",
  "틀렸",
  "잘못",
  "이상하",
  "왜 그렇게",
  "부족",
  "고쳐",
  "개선"
];

function normalizeContent(value) {
  return typeof value === "string" ? value.trim() : "";
}

function includesForbiddenFeedback(text) {
  return FORBIDDEN_FEEDBACK_TERMS.some((term) => text.includes(term));
}

function stripJsonFence(value) {
  return normalizeContent(value)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parsePolishReview(rawContent) {
  const normalized = stripJsonFence(rawContent);
  const parsed = JSON.parse(normalized);
  const polishedContent = normalizeContent(parsed.polishedContent);
  const riskSummary = normalizeContent(parsed.riskSummary);

  if (!polishedContent) {
    throw new Error("OpenAI response did not include polishedContent.");
  }

  return {
    polishedContent,
    riskSummary: riskSummary || "상대에게 강하게 느껴질 수 있는 표현을 조금 부드럽게 조정했어요."
  };
}

async function createPolishReview(client, content, extraInstruction = "") {
  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    max_tokens: 320,
    messages: [
      {
        role: "system",
        content: [
          "너는 한국어 게시판 댓글을 실제 사람이 남길 법한 자연스러운 댓글로 다듬는 편집자야.",
          "원문의 핵심 의미와 대화 의도는 유지하고, 공격적인 표현만 부드럽게 바꿔.",
          "욕설, 조롱, 인신공격, 비꼼, 몰아붙이는 말투만 제거해.",
          "원문이 질문이면 부드러운 질문으로 유지하고, 반대 의견이면 부드러운 반대 의견으로 유지해.",
          "너무 착한 표어, 캠페인 문구, 홍보 문구처럼 만들지 마.",
          "의견을 나눠주셔서 고마워요, 서로 존중하며, 따뜻하게 이야기 나누면 좋겠어요, 함께 좋은 방향 같은 상투적인 표현을 반복하지 마.",
          "지나치게 공손하거나 과하게 긍정적인 문장으로 바꾸지 마.",
          "문제, 틀렸다, 잘못, 이상하다, 왜 그렇게, 부족하다, 고쳐라, 개선해라 같은 지적성 표현은 피하되 의미가 사라지지 않게 자연스럽게 바꿔.",
          "riskSummary에는 원문이 상대에게 부정적이거나 공격적으로 보일 수 있는 요소를 1문장으로 짧고 구체적으로 설명해.",
          "polishedContent에는 작성자가 바로 게시할 수 있는 수정본만 1~2문장으로 써.",
          "반드시 JSON만 출력해. 키는 riskSummary와 polishedContent만 사용해. 설명, 따옴표 밖 문장, 마크다운은 출력하지 마.",
          "예시 입력: 멍멍텅구리야 너는 이게 문제야. 그걸 왜 그렇게 생각하냐?",
          "예시 출력: {\"riskSummary\":\"상대를 직접 지적하고 몰아붙이는 표현이 있어 방어적으로 느껴질 수 있어요.\",\"polishedContent\":\"멍멍텅구리님, 저는 조금 다르게 느꼈어요. 어떤 점에서 그렇게 생각했는지 더 들어보고 싶어요.\"}",
          "예시 입력: 아니 그건 말이 안 되잖아. 제대로 생각한 거 맞아?",
          "예시 출력: {\"riskSummary\":\"상대의 판단을 깎아내리는 듯한 표현이 있어 대화가 날카롭게 느껴질 수 있어요.\",\"polishedContent\":\"저는 그 부분이 조금 다르게 느껴졌어요. 어떤 기준으로 생각했는지 함께 이야기해 보면 좋겠어요.\"}",
          "예시 입력: 너 진짜 답답하다. 왜 일을 그렇게 처리해?",
          "예시 출력: {\"riskSummary\":\"상대방을 답답하다고 표현해 인신공격처럼 받아들여질 수 있어요.\",\"polishedContent\":\"그 상황이 조금 아쉽게 느껴졌어요. 다음에는 어떻게 하면 더 편하게 진행할 수 있을지 같이 이야기해 보면 좋겠어요.\"}",
          extraInstruction
        ].filter(Boolean).join(" ")
      },
      {
        role: "user",
        content: content
      }
    ]
  });

  const rawContent = response.choices[0] && response.choices[0].message
    ? response.choices[0].message.content
    : "";

  return parsePolishReview(rawContent);
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
    let review = await createPolishReview(client, content);

    if (review.polishedContent && includesForbiddenFeedback(review.polishedContent)) {
      review = await createPolishReview(
        client,
        content,
        "금지 표현을 한 번 더 확인해. 문제, 잘못, 왜 그렇게처럼 상대를 몰아붙이는 말은 피하고, 원문의 의도는 유지한 채 자연스러운 1~2문장으로 다시 써."
      );
    }

    if (includesForbiddenFeedback(review.polishedContent)) {
      review = {
        polishedContent: SAFE_FALLBACK_COMMENT,
        riskSummary: SAFE_FALLBACK_RISK_SUMMARY
      };
    }

    return review;
  } catch (error) {
    console.error("OpenAI 문장 다듬기 실패:", error);
    throw new HttpsError(
      "internal",
      "문장을 다듬는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
    );
  }
});
