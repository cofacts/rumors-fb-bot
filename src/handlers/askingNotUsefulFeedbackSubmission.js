import { t, ngettext, msgid } from 'ttag';
import gql from '../gql';
import { getArticleURL, createPostbackAction } from './utils';

/**
 * The state that a user has told us why she thinks our replies are not useful.
 */
export default async function askingNotUsefulFeedbackSubmission(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  if (!data.selectedReplyId) {
    throw new Error('selectedReply not set in data');
  }

  if (event.input !== 'r') {
    const {
      data: {
        action: { feedbackCount },
      },
    } = await gql`
      mutation(
        $comment: String!
        $vote: FeedbackVote!
        $articleId: String!
        $replyId: String!
      ) {
        action: CreateOrUpdateArticleReplyFeedback(
          comment: $comment
          articleId: $articleId
          replyId: $replyId
          vote: $vote
        ) {
          feedbackCount
        }
      }
    `(
      {
        articleId: data.selectedArticleId,
        replyId: data.selectedReplyId,
        comment: event.input === 'n' ? 'none' : data.comment,
        vote: 'DOWNVOTE',
      },
      { userId }
    );

    const otherFeedbackCount = feedbackCount - 1;
    const articleUrl = getArticleURL(data.selectedArticleId);
    replies = [
      {
        type: 'text',
        content: {
          text:
            otherFeedbackCount > 0
              ? ngettext(
                  msgid`We've received feedback from you and {otherFeedbackCount} other user!`,
                  `We've received feedback from you and {otherFeedbackCount} other users!`,
                  otherFeedbackCount
                )
              : t`Thanks. You're the first one who gave feedback on this reply!`,
        },
      },
      {
        type: 'text',
        content: {
          text:
            '💁 ' +
            t`If you have something to say about this article, feel free to submit your own reply at ${articleUrl} :)`,
        },
      },
    ];

    state = '__INIT__';
  } else {
    replies = [
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: t`Okay. Please revise your reason.`,
              buttons: [createPostbackAction(t`Skip`, 'n')],
            },
          },
        },
      },
    ];
    state = 'ASKING_NOT_USEFUL_FEEDBACK';
  }

  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
