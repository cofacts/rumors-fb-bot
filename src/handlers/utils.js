/**
 * @param {string} label The label of a postback action
 * @param {string} input The value returned of a postback action
 * @returns {object} The postback action object
 */
export function createPostbackAction(label, input) {
  return {
    type: 'postback',
    title: label,
    payload: input,
  };
}

/**
 * Text template describing how many users consider this reply useful or not.
 * @param {number} positive - Count of positive feedbacks
 * @param {number} negative - Count of negative feedbacks
 * @return {string} Description of feedback counts
 */
export function createFeedbackWords(positive, negative) {
  // No one has rated this reply yet
  if (positive + negative === 0) return '[還沒有人針對此回應評價]';
  let result = '';
  // {positive count} user(s) consider this helpful
  if (positive) result += `有 ${positive} 人覺得此回應有幫助\n`;
  // {negative count} user(s) consider this not useful
  if (negative) result += `有 ${negative} 人覺得此回應沒幫助\n`;
  return `[${result.trim()}]`;
}

/**
 * Text template for different types of a reply.
 * @param {string} type the type of a reply
 * @return {string} Description of the type
 */
export function createTypeWords(type) {
  switch (type) {
    case 'RUMOR':
      // it looks like a rumor
      return '❌ 含有不實訊息';
    case 'NOT_RUMOR':
      // it may be credible
      return '⭕ 含有真實訊息';
    case 'OPINIONATED':
      // it is simply a personal opinion
      return '💬 含有個人意見';
    case 'NOT_ARTICLE':
      // it is off-topic and Cofacts doesn't handle it
      return '⚠️️ 不在查證範圍';
  }
  return '回應的狀態未定義！';
}

/**
 * Text template containing references for a reply.
 * If there's no reply, a warning is returned.
 * @param {object} reply The reply object
 * @param {string} reply.reference
 * @param {string} reply.type
 * @returns {string} The reference message to send
 */
export function createReferenceWords({ reference, type }) {
  const prompt = type === 'OPINIONATED' ? '不同觀點請見' : '出處';

  if (reference) return `${prompt}：${reference}`;
  // This reply has no other opinions or references and it may be biased
  return `\uDBC0\uDC85 ⚠️️ 此回應沒有${prompt}，請自行斟酌回應之可信度。⚠️️  \uDBC0\uDC85`;
}

/**
 * Text template for article submission confirmation
 * @param {number} issuedAt The "issuedAt" to put in postback action
 * @returns {array} an array of reply message instances
 */
export function createAskArticleSubmissionReply() {
  const replyText =
    // Submit this message?
    '【送出訊息到公開資料庫？】\n' +
    // If you think this can be a rumor, please submit it for fact-checking.
    '若這是「轉傳訊息」，而且您覺得這很可能是一則「謠言」，請將這則訊息送進公開資料庫建檔，讓好心人查證與回覆。\n' +
    '\n' +
    // Although you don't receive the result immediately, it can be a big help to those who
    // receive the same suspicious message in the future.
    '雖然您不會立刻收到查證結果，但可以幫助到未來同樣收到這份訊息的人。';
  const promptText =
    // Please tell us WHY YOU CONSIDER THIS A RUMOR so that we can understand the problem of this suspicious message.
    '請把「為何您會覺得這是一則謠言」的理由傳給我們，幫助闢謠編輯釐清您有疑惑之處。';

  return [
    {
      type: 'text',
      content: {
        text: replyText,
      },
    },
    {
      type: 'text',
      content: {
        text: promptText,
      },
    },
    {
      type: 'buttons',
      content: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            // Discard
            text: '若要放棄，請按「放棄送出」。',
            // Discard
            buttons: [createPostbackAction('放棄送出', 'n')],
          },
        },
      },
    },
  ];
}

export function isNonsenseText(/*text*/) {
  return false;
}

const ELLIPSIS = '⋯⋯';

/**
 * If the text length is lower than limit, return text; else, return
 * text with ellipsis.
 * @param {string} text
 * @param {number} limit
 * @return {string}
 */
export function ellipsis(text, limit) {
  if (text.length < limit) return text;

  return text.slice(0, limit - ELLIPSIS.length) + ELLIPSIS;
}

const SITE_URL = process.env.SITE_URL || 'https://cofacts.g0v.tw';

/**
 * @param {string} articleId
 * @returns {string} The article's full URL
 */
export function getArticleURL(articleId) {
  return `${SITE_URL}/article/${articleId}`;
}
