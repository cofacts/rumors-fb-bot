import gql from '../gql';
import ga from '../ga';
import {
  getArticleURL,
  createPostbackAction,
  createTypeWords,
  ellipsis,
} from './utils';

/**
 * The state that user has given feedback about the article and replies we displayed.
 * We ask them to send other people our replies if they're satisfied or tell us why
 * they think the replies are not useful.
 */
export default async function askingReplyFeedback(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  if (!data.selectedReplyId) {
    throw new Error('selectedReply not set in data');
  }

  const visitor = ga('FB-' + userId, data.selectedArticleText);
  visitor.screenview({ screenName: state });

  // Track when user give feedback.
  visitor.event({
    ec: 'UserInput',
    ea: 'Feedback-Vote',
    el: `${data.selectedArticleId}/${data.selectedReplyId}`,
  });

  if (event.input === 'y') {
    const {
      data: {
        action: { feedbackCount },
      },
    } = await gql`
      mutation($vote: FeedbackVote!, $articleId: String!, $replyId: String!) {
        action: CreateOrUpdateArticleReplyFeedback(
          vote: $vote
          articleId: $articleId
          replyId: $replyId
        ) {
          feedbackCount
        }
      }
    `(
      {
        articleId: data.selectedArticleId,
        replyId: data.selectedReplyId,
        vote: 'UPVOTE',
      },
      { userId }
    );
    const {
      data: { GetReply },
    } = await gql`
      query($replyId: String!, $articleId: String!) {
        GetReply(id: $replyId) {
          type
          text
          reference
        }
      }
    `({
      replyId: data.selectedReplyId,
    });

    const articleUrl = getArticleURL(data.selectedArticleId);

    const sharedContent = {
      title: `網路上有人說「${ellipsis(
        data.selectedArticleText,
        15
      )}」${createTypeWords(GetReply.type)}喔！`,
      subtitle: `請至 ${articleUrl} 看看鄉親們針對這則訊息的回應、理由，與所找的出處唷！`,
      buttons: [
        {
          type: 'web_url',
          url: articleUrl,
          title: '看看別人的回應',
        },
      ],
    };

    replies = [
      {
        type: 'text',
        content: {
          text:
            feedbackCount > 1
              ? `感謝您與其他 ${feedbackCount - 1} 人的回饋。`
              : '感謝您的回饋，您是第一個評論這個回應的人 :)',
        },
      },
      {
        type: 'generic',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text:
                '📲 別忘了把上面的回應轉傳回您的聊天室，給其他人也看看！\n💁 若您認為自己能回應得更好，歡迎提交新的回應唷！',
              buttons: [
                {
                  type: 'element_share',
                  share_contents: {
                    attachment: {
                      type: 'template',
                      payload: {
                        template_type: 'generic',
                        elements: [sharedContent],
                      },
                    },
                  },
                },
                {
                  type: 'web_url',
                  url: articleUrl,
                  title: '提出新回應',
                },
              ],
            },
          },
        },
      },
    ];

    state = '__INIT__';
    visitor.send();
    return { data, state, event, issuedAt, userId, replies, isSkipUser };
  }
  replies = [
    {
      type: 'buttons',
      content: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text:
              '請問您為什麼覺得好心人的回應沒有幫助？請把理由打字傳給我們，幫助闢謠編輯釐清問題所在；若不想填，請按「我不想填理由」按鈕。',
            buttons: [createPostbackAction('我不想填理由', 'n')],
          },
        },
      },
    },
  ];

  state = 'ASKING_NOT_USEFUL_FEEDBACK';
  visitor.send();
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
