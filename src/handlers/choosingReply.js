import { t } from 'ttag';
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
          text: t`Please enter 1～${data.foundReplyIds.length} to choose a reply.`,
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

    const articleUrl = getArticleURL(data.selectedArticleId);
    const articleType = createTypeWords(GetReply.type);
    replies = [
      {
        type: 'text',
        content: {
          text: t`Someone marked this message as "${articleType}" because:`,
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
          text:
            '💁 ' +
            t`These replies are provided by some nice volunteers. Please refer to ${articleUrl} for more information, replies and references.`,
        },
      },
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: t`Is this reply helpful?`,
              buttons: [
                createPostbackAction(t`Yes`, 'y'),
                createPostbackAction(t`No`, 'n'),
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
