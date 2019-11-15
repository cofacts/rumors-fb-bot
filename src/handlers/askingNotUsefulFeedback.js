import { t, ngettext, msgid } from 'ttag';
import gql from '../gql';
import { getArticleURL, createPostbackAction } from './utils';

/**
 * The state that a user is telling us why she thinks our replies are not useful.
 * We also ask for confirmation.
 */
export default async function askingNotUsefulFeedback(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  if (!data.selectedReplyId) {
    throw new Error('selectedReply not set in data');
  }

  if (event.input === 'n') {
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
        comment: 'none',
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
            `If you have something to say about this article, feel free to submit us your own reply at ${articleUrl} :)`,
        },
      },
    ];
    state = '__INIT__';
  } else {
    data.comment = event.input;

    replies = [
      {
        type: 'text',
        content: {
          text: t`The following is your reason:` + `\n"${event.input}"`,
        },
      },
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: t`Fact checkers will see why you find this reply not helpful. Please confirm.`,
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

    state = 'ASKING_NOT_USEFUL_FEEDBACK_SUBMISSION';
  }
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
