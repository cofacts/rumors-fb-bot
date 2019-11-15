import { t, ngettext, msgid } from 'ttag';
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
  if (positive + negative === 0) return '[' + t`No rating for this reply` + ']';
  let result = '';
  if (positive)
    result +=
      ngettext(
        msgid`${positive} user considers this helpful`,
        `${positive} users consider this helpful`,
        positive
      ) + '\n';
  if (negative)
    result +=
      ngettext(
        msgid`${negative} user considers this not useful`,
        `${negative} users consider this not useful`,
        negative
      ) + '\n';
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
      return '❌ ' + t`CONTAINS MISINFO`;
    case 'NOT_RUMOR':
      return '⭕ ' + t`CONTAINS TRUE INFO`;
    case 'OPINIONATED':
      return '💬 ' + t`OPINIONATED`;
    case 'NOT_ARTICLE':
      return '⚠️️ ' + t`OFF TOPIC`;
  }
  return 'Undefined!';
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
  const prompt = type === 'OPINIONATED' ? t`Other replies` : t`References`;

  if (reference) return `${prompt}：${reference}`;
  let warning = t`This reply doesn't have any reference so it may not be credible.`;
  if (type === 'OPINIONATED') {
    warning = t`This is the only reply to this issue and it may be biased.`;
  }
  return `\uDBC0\uDC85 ⚠️️ ${warning} ⚠️️  \uDBC0\uDC85`;
}

/**
 * Text template for article submission confirmation
 * @param {number} issuedAt The "issuedAt" to put in postback action
 * @returns {array} an array of reply message instances
 */
export function createAskArticleSubmissionReply() {
  const replyText =
    '【' +
    t`Submit this message?` +
    '】\n' +
    t`If you think this can be a rumor, please submit it such that other people can help fact-check and clarify.` +
    '\n\n' +
    t`Though you don't receive the result of fact-checking soon, this is a big help to those who receive similar messages in the future.`;
  const promptText = t`Please tell us WHY YOU CONSIDER THIS A RUMOR so that we can understand the problem of this suspicious message.`;

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
            text: t`Discard`,
            buttons: [createPostbackAction(t`Discard`, 'n')],
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
