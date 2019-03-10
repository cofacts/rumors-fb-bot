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

    replies = [
      {
        type: 'text',
        content: {
          text:
            feedbackCount > 1
              ? `We've received feedback from you and ${feedbackCount -
                  1} other user${feedbackCount > 2 ? 's' : ''}!`
              : 'Thanks. You are the first one who gave feedback on this reply :)',
        },
      },
      {
        type: 'text',
        content: {
          text: `💁 If you have something to say about this article, feel free to submit us your own reply at ${getArticleURL(
            data.selectedArticleId
          )} :)`,
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
          text: `The following is your reason:\n"${event.input}"`,
        },
      },
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text:
                'Fact checkers will see why you find this reply not helpful. Please confirm.',
              buttons: [
                createPostbackAction('Submit', 'y'),
                createPostbackAction('Revise', 'r'),
                createPostbackAction('Skip', 'n'),
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
