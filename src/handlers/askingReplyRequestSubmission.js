import gql from '../gql';
import { getArticleURL } from './utils';

/**
 * The state that the user is going to submit a new article. We tell them if anyone
 * else also submitted similar articles.
 */
export default async function askingArticleSubmission(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;
  const { selectedArticleId } = data;

  if (!data.searchedText) {
    throw new Error('searchText not set in data');
  }

  if (event.input === 'y') {
    const reason = data.reasonText;

    const {
      data: { CreateReplyRequest },
    } = await gql`
      mutation($id: String!, reason: String) {
        CreateReplyRequest(articleId: $id, reason: $reason) {
          replyRequestCount
        }
      }
    `({ id: selectedArticleId, reason }, { userId });

    replies = [
      {
        type: 'text',
        content: {
          text: `We've recorded your reason. ${
            CreateReplyRequest.replyRequestCount
          } other ${
            CreateReplyRequest.replyRequestCount > 1 ? 's are' : ' is'
          } waiting for clarification. Please refer to this page for updates: ${getArticleURL(
            selectedArticleId
          )}`,
        },
      },
    ];
    state = '__INIT__';
  } else if (event.input === 'n') {
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
          text: `We've recorded your reason. ${
            CreateReplyRequest.replyRequestCount
          } other user${
            CreateReplyRequest.replyRequestCount > 1 ? 's are' : ' is'
          } also waiting for clarification. Please refer to this page for updates: ${getArticleURL(
            selectedArticleId
          )}`,
        },
      },
    ];
    state = '__INIT__';
  } else if (event.input === 'r') {
    // Sure. You can revise your reason.
    replies = [{ type: 'text', content: { text: '好的，請重新填寫理由。' } }];
    state = 'ASKING_REPLY_REQUEST_REASON';
  }

  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
