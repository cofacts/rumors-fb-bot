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
            // ? We've received feedback from you and other {count - 1} person(s)!
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
          // feel free to submit us your own reply!
          text: `💁 若您認為自己能回應得更好，歡迎到 ${getArticleURL(
            data.selectedArticleId
          )} 提交新的回應唷！`,
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
          // The following is your reason: {reason}
          text: `以下是您所填寫的理由：「${event.input}」`,
        },
      },
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              // Fact checkers will see why you find this reply not helpful.
              // Please confirm.
              text: '我們會把您覺得回應沒幫助的原因呈現給編輯們看。請確認：',
              buttons: [
                // OK. Submit now!
                createPostbackAction('明白，我要送出', 'y'),
                // Revise my reason
                createPostbackAction('重寫送出的理由', 'r'),
                // Skip
                createPostbackAction('算了，我不想填', 'n'),
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
