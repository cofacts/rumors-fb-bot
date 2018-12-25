import gql from '../gql';
import {
  createPostbackAction,
  createReferenceWords,
  createTypeWords,
  ellipsis,
  getArticleURL,
} from './utils';
import ga from '../ga';

/**
 * The state that a user is choosing which reply to read
 * if she hasn't chosen one, we ask her to select the number of desired reply
 * if she has, we query the reply and render
 */
export default async function choosingReply(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  if (!data.foundReplyIds) {
    throw new Error('foundReplyIds not set in data');
  }

  const visitor = ga('FB-' + userId, data.selectedArticleText);
  visitor.screenview({ screenName: state });

  const selectedReplyId = data.foundReplyIds[event.input - 1];

  if (!selectedReplyId) {
    replies = [
      {
        type: 'text',
        content: {
          // Please enter 1 - {length} to choose a reply
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
          // Someone marked this message as "{type}" because
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
          // These messages are provided by some nice volunteers. Please refer to
          // {articleURL} for more information, replies and references.
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
              // Is this reply helpful?
              text: '請問上面回應是否有幫助？',
              buttons: [
                // Yes
                createPostbackAction('是', 'y'),
                // No
                createPostbackAction('否', 'n'),
              ],
            },
          },
        },
      },
    ];
    // Track when user select a reply.
    visitor.event({ ec: 'Reply', ea: 'Selected', el: selectedReplyId });
    // Track which reply type reply to user.
    visitor.event({ ec: 'Reply', ea: 'Type', el: GetReply.type });

    data.selectedReplyId = selectedReplyId;
    state = 'ASKING_REPLY_FEEDBACK';
  }

  visitor.send();
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
