const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const MAX_CONTENT_LENGTH = 1200;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
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
  "개선",
  "개소리",
  "지옥",
  "쌍"
];

function normalizeContent(value) {
  return typeof value === "string" ? value.trim() : "";
}

function includesForbiddenFeedback(text) {
  return FORBIDDEN_FEEDBACK_TERMS.some((term) => text.includes(term));
}

function includesRewriteMarker(text) {
  return /-{1,2}>|→|원문\s*:|수정\s*:|수정본\s*:|polishedContent/i.test(text);
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
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    temperature: 0.4,
    max_output_tokens: 320,
    text: {
      format: {
        type: "json_schema",
        name: "polish_review",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            riskSummary: {
              type: "string"
            },
            polishedContent: {
              type: "string"
            }
          },
          required: ["riskSummary", "polishedContent"]
        }
      }
    },
    input: [
      {
        role: "system",
        content: [
          "너는 한국어 게시판 댓글을 실제 사람이 남길 법한 자연스러운 댓글로 다듬는 편집자야.",
          "원문의 모든 문장과 전체 흐름을 읽고, 공격적인 표현만 부드럽게 바꿔.",
          "공격적이지 않은 문장, 선의의 문장, 맥락을 만드는 문장은 절대 삭제하거나 요약하지 말고 최종문에 보존해.",
          "욕설, 조롱, 인신공격, 비꼼, 몰아붙이는 말투만 제거해.",
          "원문이 질문이면 부드러운 질문으로 유지하고, 반대 의견이면 부드러운 반대 의견으로 유지해.",
          "너무 착한 표어, 캠페인 문구, 홍보 문구처럼 만들지 마.",
          "의견을 나눠주셔서 고마워요, 서로 존중하며, 따뜻하게 이야기 나누면 좋겠어요, 함께 좋은 방향 같은 상투적인 표현을 반복하지 마.",
          "지나치게 공손하거나 과하게 긍정적인 문장으로 바꾸지 마.",
          "문제, 틀렸다, 잘못, 이상하다, 왜 그렇게, 부족하다, 고쳐라, 개선해라 같은 지적성 표현은 피하되 의미가 사라지지 않게 자연스럽게 바꿔.",
          "앞 문장과 뒤 문장의 감정이 충돌하면 '다만', '지금은', '선뜻' 같은 연결어로 자연스럽게 이어서 한 사람의 글처럼 만들어.",
          "riskSummary에는 원문 중 상대에게 부정적이거나 공격적으로 보일 수 있는 요소만 1문장으로 짧고 구체적으로 설명해.",
          "polishedContent에는 작성자가 바로 게시할 최종 글 전체만 써. 원문, 화살표, 비교 설명, 수정 전/후 형식은 절대 넣지 마.",
          "여러 문장으로 된 입력이면 여러 문장으로 된 최종 글을 만들고, 문제 없는 앞뒤 문장은 유지한 채 공격적인 문장만 바꿔.",
          "반드시 JSON만 출력해. 키는 riskSummary와 polishedContent만 사용해. 설명, 따옴표 밖 문장, 마크다운, 화살표는 출력하지 마.",
          "예시 입력: 이 세상 모든 사람이 행복하길 바랍니다. 그건 뭔 개소리야 다 지옥으로 가자 쌍",
          "예시 출력: {\"riskSummary\":\"상대의 말을 조롱하고 극단적으로 몰아붙이는 표현이 있어 공격적으로 느껴질 수 있어요.\",\"polishedContent\":\"이 세상 모든 사람이 행복하길 바랍니다. 다만 지금은 현실이 너무 답답하게 느껴져서, 그 말에 선뜻 공감하기 어렵습니다.\"}",
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

  const rawContent = response.output_text || "";

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

    if (
      review.polishedContent
      && (includesForbiddenFeedback(review.polishedContent) || includesRewriteMarker(review.polishedContent))
    ) {
      review = await createPolishReview(
        client,
        content,
        "다시 써. 공격적이지 않은 문장은 삭제하지 말고 그대로 살려. 원문과 수정문을 비교하지 말고, 화살표나 '수정:' 같은 표시 없이 최종 게시글 전체만 polishedContent에 넣어. 개소리, 지옥, 쌍 같은 욕설이나 극단적 표현은 부드러운 불일치나 답답함의 표현으로 바꿔. 앞뒤 감정이 충돌하면 '다만 지금은 현실이 너무 답답하게 느껴져서, 그 말에 선뜻 공감하기 어렵습니다'처럼 자연스럽게 연결해."
      );
    }

    if (includesForbiddenFeedback(review.polishedContent) || includesRewriteMarker(review.polishedContent)) {
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
