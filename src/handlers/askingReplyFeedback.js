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
      query($replyId: String!) {
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
      // Hey someone else says {ellipsis} is {type}!
      title: `網路上有人說「${ellipsis(
        data.selectedArticleText,
        15
      )}」${createTypeWords(GetReply.type)}喔！`,
      // Please refer to {articleURL} to see their replies to this message and references!
      subtitle: `請至 ${articleUrl} 看看鄉親們針對這則訊息的回應、理由，與所找的出處唷！`,
      buttons: [
        {
          type: 'web_url',
          url: articleUrl,
          // See other replies
          title: '看看別人的回應',
        },
      ],
    };

    replies = [
      {
        type: 'text',
        content: {
          text:
            // ? We've received feedback from you and other {count - 1} person(s)!
            // : Thanks. You're the first one who gave feedback on this reply!
            feedbackCount > 1
              ? `We've received feedback from you and ${feedbackCount -
                  1} other user${feedbackCount > 2 ? 's' : ''}!`
              : 'Thanks. You are the first one who gave feedback on this reply :)',
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
                "📲 Don't forget to forward the messages above to others and share with them!\n💁 And feel free to submit your own reply if you have anything to say about this!",
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
                  title: 'Submit a new reply',
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
  } else if (event.input === 'n') {
    replies = [
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text:
                'Why do you find this reply not helpful? Please tell us in messages. If you want to skip this, click the skip button below.',
              buttons: [createPostbackAction('Skip', 'n')],
            },
          },
        },
      },
    ];

    state = 'ASKING_NOT_USEFUL_FEEDBACK';
    visitor.send();
  } else {
    replies = [];
  }
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
