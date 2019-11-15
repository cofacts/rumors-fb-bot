import { t, ngettext, msgid } from 'ttag';
import gql from '../gql';
import { getArticleURL } from './utils';

/**
 * The state that the user is going to submit a new article. We tell them if anyone
 * else also submitted similar articles.
 */
export default async function askingArticleSubmission(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;
  const { selectedArticleId } = data;
  const articleUrl = getArticleURL(selectedArticleId);

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
          text: ngettext(
            msgid`We've recorded your reason. ${
              CreateReplyRequest.replyRequestCount
            } other user is also waiting for clarification. Please refer to this page for updates: ${articleUrl}`,
            `We've recorded your reason. ${
              CreateReplyRequest.replyRequestCount
            } other users are also waiting for clarification. Please refer to this page for updates: ${articleUrl}`,
            CreateReplyRequest.replyRequestCount
          ),
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
          text: ngettext(
            msgid`We've recorded your reason. ${
              CreateReplyRequest.replyRequestCount
            } other user is also waiting for clarification. Please refer to this page for updates: ${articleUrl}`,
            `We've recorded your reason. ${
              CreateReplyRequest.replyRequestCount
            } other users are also waiting for clarification. Please refer to this page for updates: ${articleUrl}`,
            CreateReplyRequest.replyRequestCount
          ),
        },
      },
    ];
    state = '__INIT__';
  } else if (event.input === 'r') {
    replies = [
      {
        type: 'text',
        content: { text: t`Sure. Please revise your reason.` },
      },
    ];
    state = 'ASKING_REPLY_REQUEST_REASON';
  }

  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
