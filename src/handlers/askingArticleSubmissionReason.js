import ga from '../ga';
import { createPostbackAction } from './utils';

/**
 * The state that a user is about to submit a new article. We ask for confirmation.
 * The user can modify her submission if she wants.
 */
export default async function askingArticleSubmission(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  const visitor = ga('FB-' + userId, data.searchedText);
  visitor.screenview({ screenName: state });

  if (event.input === 'n') {
    // Track whether user create Article or not if the Article is not found in DB.
    visitor.event({ ec: 'Article', ea: 'Create', el: 'No' });

    replies = [
      // The message is discarded. Thank you.
      { type: 'text', content: { text: '訊息沒有送出，謝謝您的使用。' } },
    ];
    state = '__INIT__';
  } else {
    const reason = event.input;

    replies = [
      {
        type: 'text',
        content: {
          // Your reason: {reason}
          text: `以下是您所填寫的理由：\n「\n${reason}\n」`,
        },
      },
      {
        type: 'text',
        content: {
          text:
            // You're about to submit this article and your reason. If they are
            // vague or improper, you may not be able to submit articles in the future.
            '我們即將把此訊息與您填寫的理由送至資料庫。若您送出的訊息或理由意味不明、' +
            '造成闢謠編輯的困擾，可能會影響到您未來送出文章的權利。',
        },
      },
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              // Please confirm:
              text: '請確認：',
              buttons: [
                // OK. Submit now!
                createPostbackAction('明白，我要送出', 'y'),
                // Revise my reason
                createPostbackAction('重寫送出的理由', 'r'),
                // Discard
                createPostbackAction('放棄送出', 'n'),
              ],
            },
          },
        },
      },
    ];
    data.reasonText = reason;
    state = 'ASKING_ARTICLE_SUBMISSION';
  }

  visitor.send();
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
