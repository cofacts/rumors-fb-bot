import { t, ngettext, msgid } from 'ttag';
import gql from '../gql';
import { createPostbackAction, getArticleURL } from './utils';

/**
 * The state that a user is submitting a new article and we ask for confirmation.
 */
export default async function askingArticleSubmission(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;
  const { selectedArticleId } = data;

  if (event.input !== 'n') {
    const reason = event.input;

    replies = [
      {
        type: 'text',
        content: {
          text: t`Reason you just input:\n"${reason}"`,
        },
      },
      {
        type: 'text',
        content: {
          text: t`You are about to submit this article and your reason. If they are vague or improper, you may not be able to submit articles in the future.`,
        },
      },
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: t`Please confirm`,
              buttons: [
                createPostbackAction(t`Submit`, 'y'),
                createPostbackAction(t`Revise`, 'r'),
                createPostbackAction(t`Skip`, 'n'),
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
          text: ngettext(
            msgid`We've recorded your reason. ${
              CreateReplyRequest.replyRequestCount
            } other user is also waiting for clarification. Please refer to this page for updates: ${getArticleURL(
              selectedArticleId
            )}`,
            `We've recorded your reason. ${
              CreateReplyRequest.replyRequestCount
            } other users are also waiting for clarification. Please refer to this page for updates: ${getArticleURL(
              selectedArticleId
            )}`,
            CreateReplyRequest.replyRequestCount
          ),
        },
      },
    ];
    state = '__INIT__';
  }

  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
