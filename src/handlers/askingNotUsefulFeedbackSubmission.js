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

    replies = [
      {
        type: 'text',
        content: {
          text:
            // ? We've received feedback from you and {count - 1} other person(s)!
            // : Thanks. You're the first one who gave feedback on this reply!
            feedbackCount > 1
              ? `感謝您與其他 ${feedbackCount - 1} 人的回饋。`
              : '感謝您的回饋，您是第一個評論這個回應的人 :)',
        },
      },
      {
        type: 'text',
        content: {
          // If you have something to say about this article,
          // feel free to submit your own reply!
          text: `💁 若您認為自己能回應得更好，歡迎到 ${getArticleURL(
            data.selectedArticleId
          )} 提交新的回應唷！`,
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
              // okay. Please revise your reason.
              text: '好的，請重新填寫理由',
              // Skip
              buttons: [createPostbackAction('我不想填了', 'n')],
            },
          },
        },
      },
    ];
    state = 'ASKING_NOT_USEFUL_FEEDBACK';
  }

  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
