import ga from '../ga';
import { createPostbackAction } from './utils';

export default async function askingArticleSubmission(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  if (event.input !== 'n') {
    const reason = event.input;

    replies = [
      {
        type: 'text',
        content: {
          text: `以下是您所填寫的理由：\n「\n${reason}\n」`,
        },
      },
      {
        type: 'text',
        content: {
          text:
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
              text: '請確認：',
              buttons: [
                createPostbackAction('明白，我要送出', 'y'),
                createPostbackAction('重寫送出的理由', 'r'),
                createPostbackAction('放棄送出', 'n'),
              ],
            },
          },
        },
      },
    ];
    data.reasonText = reason;
    state = 'ASKING_ARTICLE_SUBMISSION';
  } else {
    // Track whether user create Article or not if the Article is not found in DB.
    ga(userId, { ec: 'Article', ea: 'Create', el: 'No' });

    replies = [
      { type: 'text', content: { text: '訊息沒有送出，謝謝您的使用。' } },
    ];
    state = '__INIT__';
  }

  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
