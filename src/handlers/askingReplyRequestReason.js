import gql from '../gql';
import { createPostbackAction, getArticleURL } from './utils';

export default async function askingArticleSubmission(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;
  const { selectedArticleId } = data;

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
                createPostbackAction('我不想填理由', 'n'),
              ],
            },
          },
        },
      },
    ];
    data.reasonText = reason;
    state = 'ASKING_REPLY_REQUEST_SUBMISSION';
  } else {
    const {
      data: { CreateReplyRequest },
    } = await gql`
      mutation($id: String!) {
        CreateReplyRequest(articleId: $id) {
          replyRequestCount
        }
      }
    `({ id: selectedArticleId }, { userId });

    replies = [
      {
        type: 'text',
        content: {
          text: `已經將您的需求記錄下來了，共有 ${
            CreateReplyRequest.replyRequestCount
          } 人跟您一樣渴望看到針對這篇訊息的回應。若有最新回應，會寫在這個地方：${getArticleURL(
            selectedArticleId
          )}`,
        },
      },
    ];
    state = '__INIT__';
  }

  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
