import gql from '../gql';
import {
  createPostbackAction,
  createReferenceWords,
  createTypeWords,
  ellipsis,
  getArticleURL,
} from './utils';
import ga from '../ga';

export default async function choosingReply(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  if (!data.foundReplyIds) {
    throw new Error('foundReplyIds not set in data');
  }

  const selectedReplyId = data.foundReplyIds[event.input - 1];

  if (!selectedReplyId) {
    replies = [
      {
        type: 'text',
        content: {
          text: `請輸入 1～${data.foundReplyIds.length} 的數字，來選擇回應。`,
        },
      },
    ];

    state = 'CHOOSING_REPLY';
  } else {
    const {
      data: { GetReply },
    } = await gql`
      query($id: String!) {
        GetReply(id: $id) {
          type
          text
          reference
          createdAt
        }
      }
    `({ id: selectedReplyId });

    replies = [
      {
        type: 'text',
        content: {
          text: `有人標記這個訊息 ${createTypeWords(GetReply.type)}，理由是：`,
        },
      },
      {
        type: 'text',
        content: {
          text: ellipsis(GetReply.text, 2000),
        },
      },
      {
        type: 'text',
        content: {
          text: ellipsis(createReferenceWords(GetReply), 2000),
        },
      },
      {
        type: 'text',
        content: {
          text: `💁 以上訊息由好心人提供。建議至 ${getArticleURL(
            data.selectedArticleId
          )} 觀看完整的訊息內容、其他鄉親的回應，以及他們各自所提出的理由與出處。`,
        },
      },
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: '請問上面回應是否有幫助？',
              buttons: [
                createPostbackAction('是', 'y'),
                createPostbackAction('否', 'n'),
              ],
            },
          },
        },
      },
    ];
    // Track when user select a reply.
    ga(userId, { ec: 'Reply', ea: 'Selected', el: selectedReplyId });
    // Track which reply type reply to user.
    ga(userId, { ec: 'Reply', ea: 'Type', el: GetReply.type });

    data.selectedReplyId = selectedReplyId;
    state = 'ASKING_REPLY_FEEDBACK';
  }

  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
